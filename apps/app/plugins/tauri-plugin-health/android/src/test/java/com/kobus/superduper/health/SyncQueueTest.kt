package com.kobus.superduper.health

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.time.Instant

class SyncQueueTest {
    private inline fun <reified T : Throwable> assertFailsWith(block: () -> Unit) {
        try {
            block()
        } catch (error: Throwable) {
            assertTrue("expected ${T::class.simpleName}, got $error", error is T)
            return
        }
        throw AssertionError("expected ${T::class.simpleName}")
    }

    private fun record(id: Int, padding: Int = 0) = PendingRecord(
        "StepsRecord",
        JsonObject(mapOf("sourceRecordId" to JsonPrimitive("r$id"), "pad" to JsonPrimitive("x".repeat(padding)))),
    )

    private fun deletion(id: Int) = PendingDeletion("StepsRecord", "d$id", Instant.parse("2026-11-14T10:00:00Z"))

    private fun ids(): () -> String {
        var n = 0
        return { "batch-${n++}" }
    }

    private fun input(batch: Batch) = Json.parseToJsonElement(batch.body).jsonObject
        .getValue("variables").jsonObject.getValue("input").jsonObject

    @Test
    fun bodyIsTheHealthSyncMutation() {
        val batch = Batches.build(listOf(record(1)), listOf(deletion(1)), newId = ids()).single()
        val body = Json.parseToJsonElement(batch.body).jsonObject
        assertEquals("HealthSync", body.getValue("operationName").jsonPrimitive.content)
        assertTrue(body.getValue("query").jsonPrimitive.content.contains("health { sync(input: \$input) { batchId replayed acceptedRecords acceptedDeletions } }"))
        val input = input(batch)
        assertEquals("batch-0", input.getValue("batchId").jsonPrimitive.content)
        assertEquals(1, input.getValue("schemaVersion").jsonPrimitive.content.toInt())
        assertEquals(
            mapOf(
                "origin" to "HEALTH_CONNECT",
                "recordType" to "StepsRecord",
                "sourceRecordId" to "d1",
                "deletedAt" to "2026-11-14T10:00:00Z",
            ),
            input.getValue("deletions").jsonArray.single().jsonObject.mapValues { it.value.jsonPrimitive.content },
        )
    }

    @Test
    fun atMostOneHundredRecordsPerBatch() {
        val batches = Batches.build((1..250).map { record(it) }, emptyList(), newId = ids())
        assertEquals(listOf(100, 100, 50), batches.map { it.records })
        assertEquals(listOf(100, 100, 50), batches.map { input(it).getValue("records").jsonArray.size })
        assertEquals(listOf("batch-0", "batch-1", "batch-2"), batches.map { it.batchId })
    }

    @Test
    fun atMostOneThousandDeletionsPerBatch() {
        val batches = Batches.build(emptyList(), (1..2500).map { deletion(it) }, maxBytes = Int.MAX_VALUE, newId = ids())
        assertEquals(listOf(1000, 1000, 500), batches.map { it.deletions })
    }

    @Test
    fun bodiesStayWithinTheByteLimit() {
        val batches = Batches.build((1..40).map { record(it, padding = 50_000) }, emptyList(), newId = ids())
        assertTrue(batches.size > 1)
        for (batch in batches) assertTrue(batch.body.toByteArray().size <= MAX_BATCH_BYTES)
        assertEquals(40, batches.sumOf { it.records })
    }

    @Test
    fun anOversizedRecordIsSentAlone() {
        val batches = Batches.build(listOf(record(1), record(2, padding = 600_000), record(3)), emptyList(), newId = ids())
        assertEquals(listOf(1, 1, 1), batches.map { it.records })
    }

    @Test
    fun perTypeCountsAreTracked() {
        val batch = Batches.build(
            listOf(record(1), PendingRecord("HeartRateRecord", JsonObject(emptyMap()))),
            listOf(deletion(1)),
            newId = ids(),
        ).single()
        assertEquals(1, batch.types.getValue("StepsRecord").records)
        assertEquals(1, batch.types.getValue("StepsRecord").deletions)
        assertEquals(1, batch.types.getValue("HeartRateRecord").records)
    }

    @Test
    fun nothingToSendMeansNoBatch() {
        assertEquals(emptyList<Batch>(), Batches.build(emptyList(), emptyList()))
    }

    private class MemoryOutbox(batches: List<QueuedBatch>) : Outbox {
        val pending = ArrayDeque(batches)
        val acknowledged = mutableListOf<String>()
        val rejected = mutableListOf<String>()
        val failures = mutableListOf<String>()
        override fun head() = pending.firstOrNull()
        override fun acknowledge(batchId: String) { acknowledged += batchId; pending.removeAll { it.batchId == batchId } }
        override fun reject(batchId: String, reason: String) { rejected += batchId; pending.removeAll { it.batchId == batchId } }
        override fun attemptFailed(batchId: String, reason: String) { failures += "$batchId: $reason" }
    }

    private fun ack(batchId: String) =
        HttpReply(200, """{"data":{"health":{"sync":{"batchId":"$batchId","replayed":false,"acceptedRecords":1,"acceptedDeletions":0}}}}""")

    private fun error(code: String) =
        HttpReply(200, """{"errors":[{"message":"nope","extensions":{"code":"$code"}}],"data":null}""")

    @Test
    fun drainsOldestFirstUntilAcknowledged() {
        val outbox = MemoryOutbox(listOf(QueuedBatch("a", "body-a"), QueuedBatch("b", "body-b")))
        val sent = mutableListOf<String>()
        val result = Uploader(outbox) { body -> sent += body; ack(body.removePrefix("body-")) }.drain()
        assertTrue(result is DrainResult.Drained)
        assertEquals(listOf("body-a", "body-b"), sent)
        assertEquals(listOf("a", "b"), outbox.acknowledged)
    }

    @Test
    fun aMismatchedAcknowledgementKeepsTheBatchAndRetriesTheSameBytes() {
        val outbox = MemoryOutbox(listOf(QueuedBatch("a", "body-a")))
        val sent = mutableListOf<String>()
        var reply = ack("other")
        val uploader = Uploader(outbox) { body -> sent += body; reply }
        assertTrue(uploader.drain() is DrainResult.Interrupted)
        assertEquals(1, outbox.pending.size)
        reply = ack("a")
        assertTrue(uploader.drain() is DrainResult.Drained)
        assertEquals(listOf("body-a", "body-a"), sent)
    }

    @Test
    fun networkAndServerErrorsAreTransient() {
        for (transport in listOf(
            Transport { throw IOException("offline") },
            Transport { HttpReply(503, "") },
            Transport { error("INTERNAL_SERVER_ERROR") },
            Transport { HttpReply(200, "not json") },
        )) {
            val outbox = MemoryOutbox(listOf(QueuedBatch("a", "body-a")))
            assertTrue(Uploader(outbox, transport).drain() is DrainResult.Interrupted)
            assertEquals(listOf("a"), outbox.pending.map { it.batchId })
        }
    }

    @Test
    fun unauthenticatedStopsSyncing() {
        for (reply in listOf(error("UNAUTHENTICATED"), HttpReply(401, ""))) {
            val outbox = MemoryOutbox(listOf(QueuedBatch("a", "body-a"), QueuedBatch("b", "body-b")))
            var calls = 0
            val result = Uploader(outbox) { calls++; reply }.drain()
            assertTrue(result is DrainResult.Unauthenticated)
            assertEquals(1, calls)
            assertEquals(2, outbox.pending.size)
        }
    }

    @Test
    fun permanentRejectionsAreSetAsideSoTheQueueKeepsMoving() {
        val outbox = MemoryOutbox(listOf(QueuedBatch("a", "body-a"), QueuedBatch("b", "body-b")))
        val result = Uploader(outbox) { body -> if (body == "body-a") error("CONFLICT") else ack("b") }.drain()
        assertTrue(result is DrainResult.Drained)
        assertEquals(1, result.rejected)
        assertEquals(listOf("a"), outbox.rejected)
        assertEquals(listOf("b"), outbox.acknowledged)
    }

    @Test
    fun serverPolicyAllowsHttpsAndDebugLoopbackOnly() {
        assertEquals("https://sd.example.com", ServerPolicy.origin("https://SD.example.com/", debuggable = false))
        assertEquals("http://localhost:4401", ServerPolicy.origin("http://localhost:4401", debuggable = true))
        assertFailsWith<IllegalArgumentException> { ServerPolicy.origin("http://localhost:4401", debuggable = false) }
        assertFailsWith<IllegalArgumentException> { ServerPolicy.origin("http://192.168.1.2:4401", debuggable = true) }
        assertFailsWith<IllegalArgumentException> { ServerPolicy.origin("https://sd.example.com/app", debuggable = false) }
    }

    @Test
    fun historyWindowIsClampedWithoutTheHistoryPermission() {
        val day = 86_400_000L
        val now = 1_000 * day
        assertEquals(now - 365 * day, HistoryWindow(365, historyGranted = true).start(now))
        assertEquals(now - 30 * day, HistoryWindow(365, historyGranted = false).start(now))
        assertEquals(now - 7 * day, HistoryWindow(7, historyGranted = false).start(now))
    }
}
