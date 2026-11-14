package com.kobus.superduper.health

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.util.UUID

internal const val SCHEMA_VERSION = 1
internal const val MAX_BATCH_RECORDS = 100
internal const val MAX_BATCH_DELETIONS = 1000
internal const val MAX_BATCH_BYTES = 512 * 1024

internal const val SYNC_MUTATION =
    "mutation HealthSync(\$input: HealthSyncInput!) { health { sync(input: \$input) { batchId replayed acceptedRecords acceptedDeletions } } }"

internal class PendingRecord(val recordType: String, val envelope: JsonObject)

internal class PendingDeletion(val recordType: String, val sourceRecordId: String, val deletedAt: Instant) {
    fun json() = payload {
        string("origin", "HEALTH_CONNECT")
        string("recordType", recordType)
        string("sourceRecordId", sourceRecordId)
        instant("deletedAt", deletedAt)
    }
}

internal class TypeCount(val records: Int, val deletions: Int)

/** One `health.sync` request, serialised once so retries resend exactly the same bytes. */
internal class Batch(
    val batchId: String,
    val body: String,
    val records: Int,
    val deletions: Int,
    val types: Map<String, TypeCount>,
)

internal object Batches {
    fun body(batchId: String, records: List<JsonObject>, deletions: List<JsonObject>): String =
        JsonObject(
            mapOf(
                "query" to JsonPrimitive(SYNC_MUTATION),
                "operationName" to JsonPrimitive("HealthSync"),
                "variables" to JsonObject(
                    mapOf(
                        "input" to JsonObject(
                            mapOf(
                                "batchId" to JsonPrimitive(batchId),
                                "schemaVersion" to JsonPrimitive(SCHEMA_VERSION),
                                "records" to JsonArray(records),
                                "deletions" to JsonArray(deletions),
                            ),
                        ),
                    ),
                ),
            ),
        ).toString()

    /**
     * Splits changes into batches of at most [MAX_BATCH_RECORDS] records, [MAX_BATCH_DELETIONS]
     * deletions and [maxBytes] of request body. A single record larger than [maxBytes] is sent
     * alone; the API accepts bodies up to 4 MB.
     */
    fun build(
        records: List<PendingRecord>,
        deletions: List<PendingDeletion>,
        maxBytes: Int = MAX_BATCH_BYTES,
        newId: () -> String = { UUID.randomUUID().toString() },
    ): List<Batch> {
        val batches = mutableListOf<Batch>()
        val overhead = utf8(body(UUID(0, 0).toString(), emptyList(), emptyList()))
        var recordItems = mutableListOf<JsonObject>()
        var deletionItems = mutableListOf<JsonObject>()
        var types = mutableMapOf<String, IntArray>()
        var bytes = overhead

        fun flush() {
            if (recordItems.isEmpty() && deletionItems.isEmpty()) return
            val id = newId()
            batches += Batch(
                batchId = id,
                body = body(id, recordItems, deletionItems),
                records = recordItems.size,
                deletions = deletionItems.size,
                types = types.mapValues { (_, count) -> TypeCount(count[0], count[1]) },
            )
            recordItems = mutableListOf()
            deletionItems = mutableListOf()
            types = mutableMapOf()
            bytes = overhead
        }

        for (record in records) {
            val size = utf8(record.envelope.toString()) + 1
            if (recordItems.size >= MAX_BATCH_RECORDS || bytes + size > maxBytes) flush()
            recordItems += record.envelope
            types.getOrPut(record.recordType) { IntArray(2) }[0]++
            bytes += size
        }
        for (deletion in deletions) {
            val json = deletion.json()
            val size = utf8(json.toString()) + 1
            if (deletionItems.size >= MAX_BATCH_DELETIONS || bytes + size > maxBytes) flush()
            deletionItems += json
            types.getOrPut(deletion.recordType) { IntArray(2) }[1]++
            bytes += size
        }
        flush()
        return batches
    }

    private fun utf8(text: String) = text.toByteArray(Charsets.UTF_8).size
}
