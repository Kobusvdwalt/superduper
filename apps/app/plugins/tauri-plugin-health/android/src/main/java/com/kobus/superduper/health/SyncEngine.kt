package com.kobus.superduper.health

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.os.Build
import android.util.Log
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.changes.DeletionChange
import androidx.health.connect.client.changes.UpsertionChange
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.request.ChangesTokenRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.util.concurrent.TimeUnit

internal enum class Trigger { FOREGROUND, BACKGROUND }

internal class NeedsRepair(message: String) : Exception(message)
private class QueueBackedUp(message: String) : Exception(message)

internal object SyncEngine {
    private const val TAG = "SuperDuperHealth"
    private const val PAGE_SIZE = 500
    private const val QUEUE_HIGH_WATER = 20L
    private val SLICE_MILLIS = TimeUnit.DAYS.toMillis(30)
    const val DEFAULT_HISTORY_DAYS = 3650

    private val mutex = Mutex()
    @Volatile var running = false
        private set
    @Volatile var phase: String? = null
        private set

    fun debuggable(context: Context) = context.applicationInfo.flags and ApplicationInfo.FLAG_DEBUGGABLE != 0

    fun availability(context: Context): String = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> "available"
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> "update_required"
        else -> "unavailable"
    }

    fun historyDays(db: SyncDatabase) = db.setting("historyDays")?.toIntOrNull() ?: DEFAULT_HISTORY_DAYS

    fun autoSync(db: SyncDatabase) = db.setting("autoSync") != "false"

    private fun featureAvailable(client: HealthConnectClient, feature: Int) =
        client.features.getFeatureStatus(feature) == HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    fun supportedTypes(client: HealthConnectClient) =
        HealthRecordTypes.all.filter { type -> type.feature?.let { featureAvailable(client, it) } ?: true }

    private fun platformDefines(context: Context, permission: String) = try {
        context.packageManager.getPermissionInfo(permission, 0)
        true
    } catch (_: PackageManager.NameNotFoundException) {
        false
    }

    /** Every read permission this device's Health Connect can grant. */
    fun requestablePermissions(context: Context, client: HealthConnectClient): Set<String> = buildSet {
        supportedTypes(client).forEach { add(it.readPermission) }
        if (featureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)) {
            add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
        }
        if (featureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)) {
            add(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
        }
        if (platformDefines(context, HealthRecordTypes.EXERCISE_ROUTES_PERMISSION)) add(HealthRecordTypes.EXERCISE_ROUTES_PERMISSION)
    }

    suspend fun run(context: Context, trigger: Trigger): DrainResult? = mutex.withLock {
        val db = SyncDatabase.get(context)
        val connection = db.connection() ?: return null
        if (db.setting("needsRepair") == "true") return null
        running = true
        val errors = mutableListOf<String>()
        var result: DrainResult? = null
        try {
            db.setSetting("lastAttemptAt", Instant.now().toString())
            val uploader = Uploader(db, HttpTransport(connection.serverUrl + "/api/graphql", connection.token))
            fun drain(): DrainResult {
                phase = "Uploading"
                val drained = uploader.drain()
                result = drained
                if (drained is DrainResult.Unauthenticated) throw NeedsRepair(drained.reason)
                return drained
            }
            drain()
            if (HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE) {
                val client = HealthConnectClient.getOrCreate(context)
                val granted = client.permissionController.getGrantedPermissions()
                val mayRead = trigger == Trigger.FOREGROUND || HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND in granted
                if (!mayRead) errors += "Background read is not granted; open the app to sync new records"
                if (mayRead) {
                    for (type in supportedTypes(client)) {
                        if (type.readPermission !in granted) {
                            db.forgetType(type.name)
                            continue
                        }
                        try {
                            phase = "Reading ${type.name}"
                            syncType(client, db, type, historyDays(db)) {
                                if (db.queueTotals().batches >= QUEUE_HIGH_WATER && drain() !is DrainResult.Drained) {
                                    throw QueueBackedUp("Upload is failing; reading paused until the queue drains")
                                }
                            }
                        } catch (error: NeedsRepair) {
                            throw error
                        } catch (error: QueueBackedUp) {
                            errors += error.message!!
                            break
                        } catch (error: SecurityException) {
                            db.forgetType(type.name)
                            db.setTypeError(type.name, "Permission denied")
                            errors += "${type.name}: permission denied"
                        } catch (error: Exception) {
                            Log.w(TAG, "Reading ${type.name} failed", error)
                            val message = "${error.javaClass.simpleName}: ${error.message ?: ""}".trim()
                            db.setTypeError(type.name, message)
                            errors += "${type.name}: $message"
                        }
                    }
                }
            } else {
                errors += "Health Connect is not available"
            }
            val drained = drain()
            if (drained is DrainResult.Interrupted) errors += "Upload: ${drained.reason}"
            if (drained.rejected > 0) errors += "${drained.rejected} batch(es) rejected by the server"
            if (errors.isEmpty()) db.setSetting("lastSuccessAt", Instant.now().toString())
            db.setSetting("lastError", errors.takeIf { it.isNotEmpty() }?.joinToString("; "))
        } catch (error: NeedsRepair) {
            db.setSetting("needsRepair", "true")
            db.setSetting("lastError", "The server rejected the client token (${error.message}). Pair this phone again.")
            HealthSyncWorker.cancel(context)
        } catch (error: Exception) {
            Log.w(TAG, "Sync failed", error)
            db.setSetting("lastError", "${error.javaClass.simpleName}: ${error.message ?: ""}".trim())
        } finally {
            running = false
            phase = null
        }
        result
    }

    private class Read(val type: HealthRecordType, val record: Record) {
        val envelope = RecordSerializers.envelope(record)
        val entry = IndexEntry(
            record.metadata.id,
            RecordSerializers.startTime(envelope).toEpochMilli(),
            record.metadata.lastModifiedTime.toEpochMilli(),
        )
    }

    /** Records whose `modifiedAt` the index already holds were sent before and are skipped. */
    private fun changed(db: SyncDatabase, reads: List<Read>): List<PendingRecord> {
        if (reads.isEmpty()) return emptyList()
        val known = db.knownModifiedAt(reads[0].type.name, reads.map { it.entry.recordId })
        return reads
            .filter { known[it.entry.recordId] != it.entry.modifiedAt }
            .map { PendingRecord(it.type.name, it.envelope) }
    }

    private suspend fun syncType(
        client: HealthConnectClient,
        db: SyncDatabase,
        type: HealthRecordType,
        historyDays: Int,
        afterCommit: () -> Unit,
    ) {
        var cursor = db.cursor(type.name)
        while (cursor != null) {
            val page = client.getChanges(cursor)
            if (page.changesTokenExpired) {
                db.forgetType(type.name)
                break
            }
            val upserts = page.changes.filterIsInstance<UpsertionChange>().map { Read(type, it.record) }
            val deleted = page.changes.filterIsInstance<DeletionChange>().map { it.recordId }
            val now = Instant.now()
            db.commit(
                type.name,
                Batches.build(changed(db, upserts), deleted.map { PendingDeletion(type.name, it, now) }),
                seen = upserts.map { it.entry },
                scan = null,
                removed = deleted,
                cursor = page.nextChangesToken,
            )
            afterCommit()
            if (!page.hasMore) return
            cursor = page.nextChangesToken
        }
        backfill(client, db, type, historyDays, afterCommit)
    }

    /**
     * Reads the history window newest first in 30-day slices, persisting progress after each
     * slice so a backfill interrupted by quota or process death resumes where it stopped.
     */
    private suspend fun backfill(
        client: HealthConnectClient,
        db: SyncDatabase,
        type: HealthRecordType,
        historyDays: Int,
        afterCommit: () -> Unit,
    ) {
        var state = db.backfill(type.name) ?: run {
            val now = System.currentTimeMillis()
            Backfill(
                token = client.getChangesToken(ChangesTokenRequest(recordTypes = setOf(type.recordClass))),
                scan = now,
                windowStart = now - TimeUnit.DAYS.toMillis(historyDays.toLong()),
                nextEnd = now,
                startedAt = now,
            ).also { db.saveBackfill(type.name, it) }
        }
        while (state.nextEnd > state.windowStart) {
            val sliceStart = maxOf(state.windowStart, state.nextEnd - SLICE_MILLIS)
            var pageToken: String? = null
            do {
                val page = client.readRecords(
                    ReadRecordsRequest(
                        recordType = type.recordClass,
                        timeRangeFilter = TimeRangeFilter.between(Instant.ofEpochMilli(sliceStart), Instant.ofEpochMilli(state.nextEnd)),
                        pageSize = PAGE_SIZE,
                        pageToken = pageToken,
                    ),
                )
                val reads = page.records.map { Read(type, it) }
                db.commit(
                    type.name,
                    Batches.build(changed(db, reads), emptyList()),
                    seen = reads.map { it.entry },
                    scan = state.scan,
                    removed = emptyList(),
                )
                afterCommit()
                pageToken = page.pageToken?.takeIf { it.isNotEmpty() }
            } while (pageToken != null)
            state = Backfill(state.token, state.scan, state.windowStart, sliceStart, state.startedAt)
            db.saveBackfill(type.name, state)
        }
        val missing = db.missing(type.name, state.windowStart, state.startedAt, state.scan)
        val now = Instant.now()
        db.commit(
            type.name,
            Batches.build(emptyList(), missing.map { PendingDeletion(type.name, it, now) }),
            seen = emptyList(),
            scan = null,
            removed = missing,
            cursor = state.token,
            finishBackfill = true,
        )
        afterCommit()
    }

    suspend fun status(context: Context, shellServerUrl: String?): JsonObject {
        val db = SyncDatabase.get(context)
        val availability = availability(context)
        val client = if (availability == "available") HealthConnectClient.getOrCreate(context) else null
        val granted = client?.permissionController?.getGrantedPermissions() ?: emptySet()
        val supported = client?.let(::supportedTypes)?.map { it.name }?.toSet() ?: emptySet()
        val requestable = client?.let { requestablePermissions(context, it) } ?: emptySet()
        fun extra(permission: String) = when {
            permission in granted -> "granted"
            permission in requestable -> "denied"
            else -> "unsupported"
        }
        val connection = db.connection()
        val totals = db.queueTotals()
        val queued = db.queuedByType()
        val rows = db.typeRows()
        val types = HealthRecordTypes.all.map { type ->
            val row = rows.getValue(type.name)
            val isGranted = type.readPermission in granted
            payload {
                string("recordType", type.name)
                string("permission", type.readPermission)
                boolean("supported", type.name in supported)
                boolean("granted", isGranted)
                string(
                    "state",
                    when {
                        type.name !in supported -> "unsupported"
                        !isGranted -> "not_granted"
                        row.backfill != null -> "backfilling"
                        row.cursor -> "incremental"
                        else -> "not_started"
                    },
                )
                raw("backfill", row.backfill?.let {
                    payload {
                        instant("windowStart", Instant.ofEpochMilli(it.windowStart))
                        instant("readBackTo", Instant.ofEpochMilli(it.nextEnd))
                    }
                })
                long("knownRecords", row.knownRecords)
                long("queuedRecords", queued[type.name] ?: 0)
                long("sentRecords", row.sentRecords)
                long("sentDeletions", row.sentDeletions)
                instant("lastReadAt", row.lastReadAt?.let(Instant::ofEpochMilli))
                string("lastError", row.lastError)
            }
        }
        return payload {
            string("platform", "android")
            int("androidSdk", Build.VERSION.SDK_INT)
            string("availability", availability)
            raw("permissions", payload {
                raw("granted", JsonArray(HealthRecordTypes.all.filter { it.readPermission in granted }.map { JsonPrimitive(it.name) }))
                raw("missing", JsonArray(HealthRecordTypes.all.filter { it.name in supported && it.readPermission !in granted }.map { JsonPrimitive(it.name) }))
                raw("unsupported", JsonArray(HealthRecordTypes.all.filter { it.name !in supported }.map { JsonPrimitive(it.name) }))
                boolean("allRecordTypesGranted", supported.isNotEmpty() && supported.all { HealthRecordTypes.named(it)!!.readPermission in granted })
                string("background", extra(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND))
                string("history", extra(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY))
                string("exerciseRoutes", extra(HealthRecordTypes.EXERCISE_ROUTES_PERMISSION))
            })
            raw("pairing", payload {
                boolean("paired", connection != null)
                string("clientId", connection?.clientId)
                boolean("serverMatchesShell", connection != null && connection.serverUrl == shellServerUrl)
                boolean("needsRepair", db.setting("needsRepair") == "true")
            })
            raw("settings", payload {
                boolean("autoSync", autoSync(db))
                int("historyDays", historyDays(db))
            })
            raw("sync", payload {
                boolean("running", running)
                string("phase", phase)
                string("lastSuccessAt", db.setting("lastSuccessAt"))
                string("lastAttemptAt", db.setting("lastAttemptAt"))
                string("lastError", db.setting("lastError"))
                long("queuedBatches", totals.batches)
                long("queuedRecords", totals.records)
                long("queuedDeletions", totals.deletions)
                long("rejectedBatches", totals.rejected)
                raw("types", JsonArray(types))
            })
        }
    }
}
