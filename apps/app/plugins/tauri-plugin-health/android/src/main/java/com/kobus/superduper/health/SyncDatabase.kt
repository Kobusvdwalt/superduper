package com.kobus.superduper.health

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.ByteArrayOutputStream

internal class Connection(val serverUrl: String, val token: String, val clientId: String)

internal class Backfill(
    val token: String,
    val scan: Long,
    val windowStart: Long,
    val nextEnd: Long,
    val startedAt: Long,
)

internal class IndexEntry(val recordId: String, val startTime: Long, val modifiedAt: Long)

internal class TypeRow(
    val cursor: Boolean,
    val backfill: Backfill?,
    val knownRecords: Long,
    val sentRecords: Long,
    val sentDeletions: Long,
    val lastReadAt: Long?,
    val lastError: String?,
)

internal class QueueTotals(val batches: Long, val records: Long, val deletions: Long, val rejected: Long)

/**
 * Local sync state. Holds no record payloads except inside the encrypted outgoing queue:
 * per-type change cursors and backfill progress, an index of record ids already sent (so a
 * record missing from a later backfill can be reported as deleted), and the queue itself.
 */
internal class SyncDatabase private constructor(context: Context) :
    SQLiteOpenHelper(context, "superduper-health.db", null, MIGRATIONS.size), Outbox {

    override fun onConfigure(db: SQLiteDatabase) {
        db.setForeignKeyConstraintsEnabled(false)
    }

    override fun onCreate(db: SQLiteDatabase) = migrate(db, 0)

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = migrate(db, oldVersion)

    private fun migrate(db: SQLiteDatabase, from: Int) {
        for (step in MIGRATIONS.drop(from)) step.forEach(db::execSQL)
    }

    private val db get() = writableDatabase

    private inline fun <T> transaction(block: SQLiteDatabase.() -> T): T {
        val database = db
        database.beginTransaction()
        try {
            return database.block().also { database.setTransactionSuccessful() }
        } finally {
            database.endTransaction()
        }
    }

    fun setting(key: String): String? =
        db.rawQuery("SELECT value FROM settings WHERE key=?", arrayOf(key)).use { if (it.moveToFirst()) it.getString(0) else null }

    fun setSetting(key: String, value: String?) {
        if (value == null) db.delete("settings", "key=?", arrayOf(key))
        else db.insertWithOnConflict("settings", null, ContentValues().apply { put("key", key); put("value", value) }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun connection(): Connection? {
        val sealed = db.rawQuery("SELECT value FROM secrets WHERE key='connection'", null).use { if (it.moveToFirst()) it.getBlob(0) else null } ?: return null
        val json = Json.parseToJsonElement(Vault.openText(sealed)).jsonObject
        return Connection(
            json.getValue("serverUrl").jsonPrimitive.content,
            json.getValue("token").jsonPrimitive.content,
            json.getValue("clientId").jsonPrimitive.content,
        )
    }

    fun saveConnection(connection: Connection) {
        val json = JsonObject(
            mapOf(
                "serverUrl" to JsonPrimitive(connection.serverUrl),
                "token" to JsonPrimitive(connection.token),
                "clientId" to JsonPrimitive(connection.clientId),
            ),
        )
        db.insertWithOnConflict(
            "secrets", null,
            ContentValues().apply { put("key", "connection"); put("value", Vault.seal(json.toString())) },
            SQLiteDatabase.CONFLICT_REPLACE,
        )
    }

    /** Removes the connection and everything synced under it. Settings are kept. */
    fun wipeSyncState() = transaction {
        for (table in listOf("secrets", "cursors", "backfill", "record_index", "outbox", "type_stats")) delete(table, null, null)
        delete("settings", "key IN ('lastSuccessAt','lastAttemptAt','lastError','needsRepair','historyGranted')", null)
    }

    fun cursor(type: String): String? =
        db.rawQuery("SELECT token FROM cursors WHERE record_type=?", arrayOf(type)).use { if (it.moveToFirst()) it.getString(0) else null }

    fun forgetType(type: String) = transaction {
        delete("cursors", "record_type=?", arrayOf(type))
        delete("backfill", "record_type=?", arrayOf(type))
    }

    fun forgetAllCursors() = transaction {
        delete("cursors", null, null)
        delete("backfill", null, null)
    }

    fun backfill(type: String): Backfill? = db.rawQuery(
        "SELECT token,scan,window_start,next_end,started_at FROM backfill WHERE record_type=?", arrayOf(type),
    ).use { if (it.moveToFirst()) Backfill(it.getString(0), it.getLong(1), it.getLong(2), it.getLong(3), it.getLong(4)) else null }

    fun saveBackfill(type: String, backfill: Backfill) {
        db.insertWithOnConflict("backfill", null, ContentValues().apply {
            put("record_type", type)
            put("token", backfill.token)
            put("scan", backfill.scan)
            put("window_start", backfill.windowStart)
            put("next_end", backfill.nextEnd)
            put("started_at", backfill.startedAt)
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun knownModifiedAt(type: String, ids: Collection<String>): Map<String, Long> {
        val result = HashMap<String, Long>()
        for (chunk in ids.chunked(500)) {
            val marks = chunk.joinToString(",") { "?" }
            db.rawQuery(
                "SELECT record_id,modified_at FROM record_index WHERE record_type=? AND record_id IN ($marks)",
                arrayOf(type, *chunk.toTypedArray()),
            ).use { while (it.moveToNext()) result[it.getString(0)] = it.getLong(1) }
        }
        return result
    }

    /** Ids indexed for [type] that started inside the window but were not seen by [scan]. */
    fun missing(type: String, windowStart: Long, windowEnd: Long, scan: Long): List<String> = db.rawQuery(
        "SELECT record_id FROM record_index WHERE record_type=? AND start_time>=? AND start_time<? AND scan IS NOT ?",
        arrayOf(type, windowStart.toString(), windowEnd.toString(), scan.toString()),
    ).use { buildList { while (it.moveToNext()) add(it.getString(0)) } }

    /**
     * Applies one page of changes atomically: queues [batches], updates the record index and
     * moves the cursor or backfill state, so a crash never advances past unqueued data.
     */
    fun commit(
        type: String,
        batches: List<Batch>,
        seen: List<IndexEntry>,
        scan: Long?,
        removed: Collection<String>,
        cursor: String? = null,
        backfill: Backfill? = null,
        finishBackfill: Boolean = false,
    ) = transaction {
        for (batch in batches) {
            insertOrThrow("outbox", null, ContentValues().apply {
                put("batch_id", batch.batchId)
                put("body", Vault.seal(batch.body))
                put("records", batch.records)
                put("deletions", batch.deletions)
                put("types", JsonObject(batch.types.mapValues { (_, c) ->
                    JsonObject(mapOf("records" to JsonPrimitive(c.records), "deletions" to JsonPrimitive(c.deletions)))
                }).toString())
                put("state", "pending")
                put("attempts", 0)
                put("created_at", System.currentTimeMillis())
            })
        }
        for (entry in seen) {
            insertWithOnConflict("record_index", null, ContentValues().apply {
                put("record_type", type)
                put("record_id", entry.recordId)
                put("start_time", entry.startTime)
                put("modified_at", entry.modifiedAt)
                if (scan != null) put("scan", scan) else putNull("scan")
            }, SQLiteDatabase.CONFLICT_REPLACE)
        }
        for (id in removed) delete("record_index", "record_type=? AND record_id=?", arrayOf(type, id))
        if (backfill != null) saveBackfill(type, backfill)
        if (finishBackfill) delete("backfill", "record_type=?", arrayOf(type))
        if (cursor != null) {
            insertWithOnConflict("cursors", null, ContentValues().apply {
                put("record_type", type); put("token", cursor); put("updated_at", System.currentTimeMillis())
            }, SQLiteDatabase.CONFLICT_REPLACE)
        }
        execSQL("INSERT OR IGNORE INTO type_stats(record_type) VALUES (?)", arrayOf(type))
        execSQL("UPDATE type_stats SET last_read_at=?, last_error=NULL WHERE record_type=?", arrayOf(System.currentTimeMillis(), type))
    }

    fun setTypeError(type: String, error: String?) {
        db.execSQL("INSERT OR IGNORE INTO type_stats(record_type) VALUES (?)", arrayOf(type))
        db.execSQL("UPDATE type_stats SET last_error=? WHERE record_type=?", arrayOf(error, type))
    }

    // CursorWindow limits a row to about 2 MB, so large bodies are read in slices.
    private fun body(seq: Long): ByteArray {
        val size = db.rawQuery("SELECT length(body) FROM outbox WHERE seq=?", arrayOf(seq.toString())).use { it.moveToFirst(); it.getInt(0) }
        val out = ByteArrayOutputStream(size)
        var offset = 1
        while (offset <= size) {
            db.rawQuery("SELECT substr(body,?,?) FROM outbox WHERE seq=?", arrayOf(offset.toString(), SLICE.toString(), seq.toString()))
                .use { it.moveToFirst(); out.write(it.getBlob(0)) }
            offset += SLICE
        }
        return out.toByteArray()
    }

    override fun head(): QueuedBatch? {
        val (seq, id) = db.rawQuery("SELECT seq,batch_id FROM outbox WHERE state='pending' ORDER BY seq LIMIT 1", null)
            .use { if (it.moveToFirst()) it.getLong(0) to it.getString(1) else null } ?: return null
        return QueuedBatch(id, Vault.openText(body(seq)))
    }

    override fun acknowledge(batchId: String) = transaction {
        val types = rawQuery("SELECT types FROM outbox WHERE batch_id=?", arrayOf(batchId)).use { if (it.moveToFirst()) it.getString(0) else null }
        if (types != null) {
            for ((type, counts) in Json.parseToJsonElement(types).jsonObject) {
                val c = counts.jsonObject
                execSQL("INSERT OR IGNORE INTO type_stats(record_type) VALUES (?)", arrayOf(type))
                execSQL(
                    "UPDATE type_stats SET sent_records=sent_records+?, sent_deletions=sent_deletions+? WHERE record_type=?",
                    arrayOf(c.getValue("records").jsonPrimitive.int, c.getValue("deletions").jsonPrimitive.int, type),
                )
            }
        }
        delete("outbox", "batch_id=?", arrayOf(batchId))
        Unit
    }

    override fun reject(batchId: String, reason: String) {
        db.execSQL("UPDATE outbox SET state='rejected', attempts=attempts+1, last_error=? WHERE batch_id=?", arrayOf(reason, batchId))
    }

    fun retryRejected() {
        db.execSQL("UPDATE outbox SET state='pending' WHERE state='rejected'")
    }

    override fun attemptFailed(batchId: String, reason: String) {
        db.execSQL("UPDATE outbox SET attempts=attempts+1, last_error=? WHERE batch_id=?", arrayOf(reason, batchId))
    }

    fun queueTotals(): QueueTotals = db.rawQuery(
        "SELECT COUNT(*),COALESCE(SUM(records),0),COALESCE(SUM(deletions),0),(SELECT COUNT(*) FROM outbox WHERE state='rejected') FROM outbox WHERE state='pending'",
        null,
    ).use { it.moveToFirst(); QueueTotals(it.getLong(0), it.getLong(1), it.getLong(2), it.getLong(3)) }

    fun queuedByType(): Map<String, Long> {
        val result = HashMap<String, Long>()
        db.rawQuery("SELECT types FROM outbox WHERE state='pending'", null).use { cursor ->
            while (cursor.moveToNext()) {
                for ((type, counts) in Json.parseToJsonElement(cursor.getString(0)).jsonObject) {
                    result[type] = (result[type] ?: 0) + counts.jsonObject.getValue("records").jsonPrimitive.int
                }
            }
        }
        return result
    }

    fun typeRows(): Map<String, TypeRow> {
        val cursors = db.rawQuery("SELECT record_type FROM cursors", null).use { buildSet { while (it.moveToNext()) add(it.getString(0)) } }
        val known = db.rawQuery("SELECT record_type,COUNT(*) FROM record_index GROUP BY record_type", null)
            .use { buildMap { while (it.moveToNext()) put(it.getString(0), it.getLong(1)) } }
        val stats = db.rawQuery("SELECT record_type,sent_records,sent_deletions,last_read_at,last_error FROM type_stats", null).use {
            buildMap {
                while (it.moveToNext()) put(it.getString(0), listOf(it.getLong(1), it.getLong(2), if (it.isNull(3)) null else it.getLong(3), it.getString(4)))
            }
        }
        return HealthRecordTypes.all.associate { type ->
            val s = stats[type.name]
            type.name to TypeRow(
                cursor = type.name in cursors,
                backfill = backfill(type.name),
                knownRecords = known[type.name] ?: 0,
                sentRecords = (s?.get(0) as Long?) ?: 0,
                sentDeletions = (s?.get(1) as Long?) ?: 0,
                lastReadAt = s?.get(2) as Long?,
                lastError = s?.get(3) as String?,
            )
        }
    }

    companion object {
        private const val SLICE = 512 * 1024

        /** Append-only: each entry upgrades the schema by one version. */
        private val MIGRATIONS: List<List<String>> = listOf(
            listOf(
                "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
                "CREATE TABLE secrets (key TEXT PRIMARY KEY, value BLOB NOT NULL)",
                "CREATE TABLE cursors (record_type TEXT PRIMARY KEY, token TEXT NOT NULL, updated_at INTEGER NOT NULL)",
                "CREATE TABLE backfill (record_type TEXT PRIMARY KEY, token TEXT NOT NULL, scan INTEGER NOT NULL, window_start INTEGER NOT NULL, next_end INTEGER NOT NULL, started_at INTEGER NOT NULL)",
                "CREATE TABLE record_index (record_type TEXT NOT NULL, record_id TEXT NOT NULL, start_time INTEGER NOT NULL, modified_at INTEGER NOT NULL, scan INTEGER, PRIMARY KEY (record_type, record_id)) WITHOUT ROWID",
                "CREATE TABLE outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, batch_id TEXT NOT NULL UNIQUE, body BLOB NOT NULL, records INTEGER NOT NULL, deletions INTEGER NOT NULL, types TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL, last_error TEXT, created_at INTEGER NOT NULL)",
                "CREATE TABLE type_stats (record_type TEXT PRIMARY KEY, sent_records INTEGER NOT NULL DEFAULT 0, sent_deletions INTEGER NOT NULL DEFAULT 0, last_read_at INTEGER, last_error TEXT)",
            ),
        )

        @Volatile private var instance: SyncDatabase? = null

        fun get(context: Context): SyncDatabase =
            instance ?: synchronized(this) { instance ?: SyncDatabase(context.applicationContext).also { instance = it } }
    }
}
