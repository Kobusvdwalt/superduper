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
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
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

/** [RETRY] is a one-time retry queued by [RetryPolicy]; it reads like [BACKGROUND]. */
internal enum class Trigger { FOREGROUND, BACKGROUND, RETRY }

internal class NeedsRepair(message: String) : Exception(message)
private class QueueBackedUp(message: String) : Exception(message)

internal class RunResult(val drain: DrainResult?, val retry: RetryAction)

// Health Connect reports its read quota as a RemoteException (APK provider) or a
// HealthConnectException (platform) whose message names the quota; there is no typed error.
private fun Throwable.isRateLimit(): Boolean =
    generateSequence(this) { it.cause }.any { it.message?.contains("quota", ignoreCase = true) == true }

/**
 * Without READ_HEALTH_DATA_HISTORY, Health Connect only returns data from 30 days before the
 * first grant, so the last 30 days are the only window that is always readable.
 */
internal class HistoryWindow(private val days: Int, private val historyGranted: Boolean) {
    fun start(now: Long): Long {
        val requested = now - TimeUnit.DAYS.toMillis(days.toLong())
        return if (historyGranted) requested else maxOf(requested, now - TimeUnit.DAYS.toMillis(30))
    }
}

internal object SyncEngine {
    private const val TAG = "SuperDuperHealth"
    private const val PAGE_SIZE = 1000
    private const val QUEUE_HIGH_WATER = 20L
    private const val ROUTE_SEARCH_PAGES = 10
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

    /**
     * Every read permission this device's Health Connect grants through its permission screen.
     * READ_EXERCISE_ROUTES is not among them: Health Connect grants it only in its settings or
     * from the route dialog ([HealthPlugin.requestExerciseRoutes]).
     */
    fun requestablePermissions(client: HealthConnectClient): Set<String> = buildSet {
        supportedTypes(client).forEach { add(it.readPermission) }
        if (featureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND)) {
            add(HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND)
        }
        if (featureAvailable(client, HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_HISTORY)) {
            add(HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY)
        }
    }

    fun routesSupported(context: Context) = platformDefines(context, HealthRecordTypes.EXERCISE_ROUTES_PERMISSION)

    suspend fun run(context: Context, trigger: Trigger): RunResult = mutex.withLock {
        val db = SyncDatabase.get(context)
        val connection = db.connection() ?: return RunResult(null, RetryAction.NONE)
        if (db.setting("needsRepair") == "true") return RunResult(null, RetryAction.NONE)
        running = true
        val errors = mutableListOf<String>()
        var result: DrainResult? = null
        var readIncomplete = false
        var needsRepair = false
        try {
            db.setSetting("lastAttemptAt", Instant.now().toString())
            if (trigger == Trigger.FOREGROUND) db.retryRejected()
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
                    val historyGranted = HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY in granted
                    if (db.setting("historyGranted") != historyGranted.toString()) {
                        // The readable window changed, so every type is read again; the record
                        // index keeps already-sent records from being queued twice.
                        db.forgetAllCursors()
                        db.setSetting("historyGranted", historyGranted.toString())
                    }
                    val routesGranted = HealthRecordTypes.EXERCISE_ROUTES_PERMISSION in granted
                    if (Rereads.routesWidened(db.setting("routesGranted"), routesGranted)) db.requestReread(Rereads.EXERCISE_SESSIONS)
                    db.setSetting("routesGranted", routesGranted.toString())
                    for (type in supportedTypes(client)) {
                        if (type.readPermission !in granted) {
                            db.forgetType(type.name)
                            continue
                        }
                        val step = Rereads.step(db.reread(type.name), trigger)
                        if (step == RereadStep.SKIP) continue
                        if (step == RereadStep.START) db.startReread(type.name)
                        try {
                            phase = "${if (step == RereadStep.NORMAL) "Reading" else "Re-reading"} ${type.name}"
                            val reading = TypeRead(type, HistoryWindow(historyDays(db), historyGranted), rereading = step != RereadStep.NORMAL)
                            syncType(client, db, reading) {
                                if (db.queueTotals().batches >= QUEUE_HIGH_WATER && drain() !is DrainResult.Drained) {
                                    throw QueueBackedUp("Upload is failing; reading paused until the queue drains")
                                }
                            }
                            if (routesGranted && reading.routesWithheld && trigger != Trigger.FOREGROUND) db.requestReread(type.name)
                        } catch (error: NeedsRepair) {
                            throw error
                        } catch (error: QueueBackedUp) {
                            errors += error.message!!
                            readIncomplete = (result as? DrainResult.Interrupted)?.retryable == true
                            break
                        } catch (error: SecurityException) {
                            db.forgetType(type.name)
                            db.setTypeError(type.name, "Permission denied")
                            errors += "${type.name}: permission denied"
                        } catch (error: Exception) {
                            if (error.isRateLimit()) {
                                db.setTypeError(type.name, "Health Connect read quota reached")
                                errors += "Health Connect read quota reached; reading resumes on the next sync"
                                readIncomplete = true
                                break
                            }
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
            needsRepair = true
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
        val outcome = RetryPolicy.outcome(needsRepair, result, readIncomplete)
        val decision = RetryPolicy.decide(outcome, trigger, db.setting("retryStreak")?.toIntOrNull() ?: 0)
        db.setSetting("retryStreak", decision.failureStreak.takeIf { it > 0 }?.toString())
        try {
            HealthSyncWorker.applyRetry(context, decision.action)
        } catch (error: Exception) {
            Log.w(TAG, "Scheduling the retry failed", error)
        }
        RunResult(result, decision.action)
    }

    private class TypeRead(val type: HealthRecordType, val window: HistoryWindow, val rereading: Boolean) {
        /** An exercise session came back with its route withheld (`ConsentRequired`). */
        var routesWithheld = false
    }

    private class Read(val type: HealthRecordType, val record: Record) {
        val envelope = RecordSerializers.envelope(record)
        val entry = IndexEntry(
            record.metadata.id,
            RecordSerializers.startTime(envelope).toEpochMilli(),
            record.metadata.lastModifiedTime.toEpochMilli(),
            Rereads.hash(envelope.toString()),
        )
    }

    /** Records the index already holds unchanged were sent before and are skipped (see [Rereads.mustSend]). */
    private fun changed(db: SyncDatabase, reading: TypeRead, reads: List<Read>): List<PendingRecord> {
        if (reads.isEmpty()) return emptyList()
        if (reads.any { (it.record as? ExerciseSessionRecord)?.exerciseRouteResult is ExerciseRouteResult.ConsentRequired }) {
            reading.routesWithheld = true
        }
        val known = db.known(reading.type.name, reads.map { it.entry.recordId })
        return reads
            .filter { Rereads.mustSend(known[it.entry.recordId], it.entry.modifiedAt, it.entry.contentHash, reading.rereading) }
            .map { PendingRecord(it.type.name, it.envelope) }
    }

    private suspend fun syncType(
        client: HealthConnectClient,
        db: SyncDatabase,
        reading: TypeRead,
        afterCommit: () -> Unit,
    ) {
        val type = reading.type
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
                Batches.build(changed(db, reading, upserts), deleted.map { PendingDeletion(type.name, it, now) }),
                seen = upserts.map { it.entry },
                scan = null,
                removed = deleted,
                cursor = page.nextChangesToken,
            )
            afterCommit()
            if (!page.hasMore) return
            cursor = page.nextChangesToken
        }
        backfill(client, db, reading, afterCommit)
    }

    /**
     * Reads the history window newest first in one paged query. After each page the oldest
     * start time read is saved, so a backfill interrupted by quota or process death resumes
     * from there with a new query (records at that instant are read again and deduplicated).
     */
    private suspend fun backfill(
        client: HealthConnectClient,
        db: SyncDatabase,
        reading: TypeRead,
        afterCommit: () -> Unit,
    ) {
        val type = reading.type
        val window = reading.window
        var state = db.backfill(type.name) ?: run {
            val now = System.currentTimeMillis()
            Backfill(
                token = client.getChangesToken(ChangesTokenRequest(recordTypes = setOf(type.recordClass))),
                scan = now,
                windowStart = window.start(now),
                nextEnd = now,
                startedAt = now,
            ).also { db.saveBackfill(type.name, it) }
        }
        var pageToken: String? = null
        do {
            val page = client.readRecords(
                ReadRecordsRequest(
                    recordType = type.recordClass,
                    timeRangeFilter = TimeRangeFilter.between(Instant.ofEpochMilli(state.windowStart), Instant.ofEpochMilli(state.nextEnd)),
                    ascendingOrder = false,
                    pageSize = PAGE_SIZE,
                    pageToken = pageToken,
                ),
            )
            val reads = page.records.map { Read(type, it) }
            pageToken = page.pageToken?.takeIf { it.isNotEmpty() }
            val oldest = reads.minOfOrNull { it.entry.startTime }
            if (pageToken != null && oldest != null) {
                state = Backfill(state.token, state.scan, state.windowStart, minOf(state.nextEnd, oldest + 1), state.startedAt)
            }
            db.commit(
                type.name,
                Batches.build(changed(db, reading, reads), emptyList()),
                seen = reads.map { it.entry },
                scan = state.scan,
                removed = emptyList(),
                backfill = state,
            )
            afterCommit()
        } while (pageToken != null)
        // A record outside what this scan could read must not be reported as deleted: the API
        // never lets an older record undo a deletion.
        val missing = db.missing(type.name, maxOf(state.windowStart, window.start(state.startedAt)), state.startedAt, state.scan)
        val now = Instant.now()
        db.commit(
            type.name,
            Batches.build(emptyList(), missing.map { PendingDeletion(type.name, it, now) }),
            seen = emptyList(),
            scan = null,
            removed = missing,
            cursor = state.token,
            finishBackfill = true,
            finishReread = reading.rereading,
        )
        afterCommit()
    }

    /** The newest readable workout whose route Health Connect withholds, or null. */
    suspend fun sessionAwaitingRouteConsent(context: Context, client: HealthConnectClient): String? {
        val db = SyncDatabase.get(context)
        val granted = client.permissionController.getGrantedPermissions()
        if (HealthPermission.getReadPermission(ExerciseSessionRecord::class) !in granted) return null
        val now = System.currentTimeMillis()
        val window = HistoryWindow(historyDays(db), HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY in granted)
        var pageToken: String? = null
        repeat(ROUTE_SEARCH_PAGES) {
            val page = client.readRecords(
                ReadRecordsRequest(
                    recordType = ExerciseSessionRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(Instant.ofEpochMilli(window.start(now)), Instant.ofEpochMilli(now)),
                    ascendingOrder = false,
                    pageSize = 100,
                    pageToken = pageToken,
                ),
            )
            page.records.firstOrNull { it.exerciseRouteResult is ExerciseRouteResult.ConsentRequired }?.let { return it.metadata.id }
            pageToken = page.pageToken?.takeIf { it.isNotEmpty() } ?: return null
        }
        return null
    }

    suspend fun status(context: Context, shellServerUrl: String?): JsonObject {
        val db = SyncDatabase.get(context)
        val availability = availability(context)
        val client = if (availability == "available") HealthConnectClient.getOrCreate(context) else null
        val granted = client?.permissionController?.getGrantedPermissions() ?: emptySet()
        val supported = client?.let(::supportedTypes)?.map { it.name }?.toSet() ?: emptySet()
        val requestable = client?.let { requestablePermissions(it) } ?: emptySet()
        fun extra(permission: String) = when {
            permission in granted -> "granted"
            permission in requestable -> "denied"
            else -> "unsupported"
        }
        val connection = db.connection()
        val totals = db.queueTotals()
        val queued = db.queuedByType()
        val rows = db.typeRows()
        val rereads = db.rereads()
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
                string("reread", StatusFields.reread(rereads[type.name]))
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
                string("exerciseRoutes", StatusFields.routes(granted, client != null && routesSupported(context)))
            })
            raw(
                "power",
                StatusFields.power(
                    BackgroundAccess.ignoringBatteryOptimizations(context),
                    BackgroundAccess.backgroundRestricted(context),
                    BackgroundAccess.autostartIntents(context).isNotEmpty(),
                ),
            )
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
                instant("nextRetryAt", runCatching { HealthSyncWorker.nextRetryAt(context) }.getOrNull())
                raw("types", JsonArray(types))
            })
        }
    }
}
