package com.kobus.superduper.health

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException

class SyncResilienceTest {
    private fun interrupted(retryable: Boolean) = DrainResult.Interrupted(0, 0, "x", retryable)

    @Test
    fun onlyRetryableUploadFailuresAndIncompleteReadsAreTransient() {
        assertEquals(RunOutcome.TRANSIENT, RetryPolicy.outcome(needsRepair = false, drain = interrupted(true), readIncomplete = false))
        assertEquals(RunOutcome.DONE, RetryPolicy.outcome(needsRepair = false, drain = interrupted(false), readIncomplete = false))
        assertEquals(RunOutcome.TRANSIENT, RetryPolicy.outcome(needsRepair = false, drain = DrainResult.Drained(3, 0), readIncomplete = true))
        assertEquals(RunOutcome.DONE, RetryPolicy.outcome(needsRepair = false, drain = DrainResult.Drained(3, 1), readIncomplete = false))
        assertEquals(RunOutcome.DONE, RetryPolicy.outcome(needsRepair = false, drain = null, readIncomplete = false))
        assertEquals(RunOutcome.NEEDS_REPAIR, RetryPolicy.outcome(needsRepair = true, drain = interrupted(true), readIncomplete = true))
    }

    @Test
    fun successAndPermanentFailuresCancelPendingRetriesAndResetTheStreak() {
        for (outcome in listOf(RunOutcome.DONE, RunOutcome.NEEDS_REPAIR)) {
            for (trigger in listOf(Trigger.FOREGROUND, Trigger.BACKGROUND)) {
                val decision = RetryPolicy.decide(outcome, trigger, previousStreak = 4)
                assertEquals(0, decision.failureStreak)
                assertEquals(RetryAction.CANCEL, decision.action)
            }
            // The retry worker ends its own chain by succeeding; cancelling itself would abort the run.
            assertEquals(RetryAction.NONE, RetryPolicy.decide(outcome, Trigger.RETRY, previousStreak = 4).action)
        }
    }

    @Test
    fun aForegroundFailureStartsAFreshChain() {
        val decision = RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.FOREGROUND, previousStreak = 50)
        assertEquals(1, decision.failureStreak)
        assertEquals(RetryAction.START, decision.action)
    }

    @Test
    fun anHourlyFailureStartsAChainOnlyWhenNoneIsPending() {
        val decision = RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.BACKGROUND, previousStreak = 0)
        assertEquals(1, decision.failureStreak)
        assertEquals(RetryAction.START_IF_IDLE, decision.action)
    }

    @Test
    fun theRetryChainBacksOffUntilTheStreakIsUsedUp() {
        var streak = RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.FOREGROUND, 0).failureStreak
        var retries = 0
        while (true) {
            val decision = RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.RETRY, streak)
            streak = decision.failureStreak
            if (decision.action != RetryAction.CONTINUE) {
                assertEquals(RetryAction.NONE, decision.action)
                break
            }
            retries++
        }
        assertEquals(RetryPolicy.MAX_STREAK - 1, retries)
    }

    @Test
    fun aServerUnreachableForDaysCostsNoExtraRunsOnceTheStreakIsUsedUp() {
        var streak = RetryPolicy.MAX_STREAK
        repeat(48) {
            val decision = RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.BACKGROUND, streak)
            assertEquals(RetryAction.NONE, decision.action)
            streak = decision.failureStreak
        }
        val recovered = RetryPolicy.decide(RunOutcome.DONE, Trigger.BACKGROUND, streak)
        assertEquals(0, recovered.failureStreak)
        assertEquals(RetryAction.START_IF_IDLE, RetryPolicy.decide(RunOutcome.TRANSIENT, Trigger.BACKGROUND, recovered.failureStreak).action)
    }

    private class OneBatch : Outbox {
        override fun head() = QueuedBatch("a", "body")
        override fun acknowledge(batchId: String) = Unit
        override fun reject(batchId: String, reason: String) = Unit
        override fun attemptFailed(batchId: String, reason: String) = Unit
    }

    private fun retryable(transport: Transport) = (Uploader(OneBatch(), transport).drain() as DrainResult.Interrupted).retryable

    @Test
    fun networkAndServerSideFailuresAreRetryableClientSideOnesAreNot() {
        assertTrue(retryable { throw IOException("Failed to connect to localhost/127.0.0.1:4401") })
        assertTrue(retryable { HttpReply(502, "") })
        assertTrue(retryable { HttpReply(429, "") })
        assertTrue(retryable { HttpReply(200, "not json") })
        assertTrue(retryable { HttpReply(200, """{"errors":[{"message":"Unexpected error.","extensions":{"code":"INTERNAL_SERVER_ERROR"}}]}""") })
        assertFalse(retryable { HttpReply(404, "") })
        assertFalse(retryable { HttpReply(403, "") })
        assertFalse(retryable { HttpReply(200, """{"errors":[{"message":"no","extensions":{"code":"FORBIDDEN"}}]}""") })
    }

    @Test
    fun rereadsRunOnlyInTheForeground() {
        assertEquals(RereadStep.NORMAL, Rereads.step(null, Trigger.FOREGROUND))
        assertEquals(RereadStep.NORMAL, Rereads.step(null, Trigger.BACKGROUND))
        assertEquals(RereadStep.START, Rereads.step(RereadState.PENDING, Trigger.FOREGROUND))
        assertEquals(RereadStep.CONTINUE, Rereads.step(RereadState.RUNNING, Trigger.FOREGROUND))
        for (trigger in listOf(Trigger.BACKGROUND, Trigger.RETRY)) {
            assertEquals(RereadStep.NORMAL, Rereads.step(RereadState.PENDING, trigger))
            assertEquals(RereadStep.SKIP, Rereads.step(RereadState.RUNNING, trigger))
        }
    }

    @Test
    fun routesWideningIsDetectedOnceAndAlsoOnTheFirstSyncAfterAnUpgrade() {
        assertTrue(Rereads.routesWidened(before = "false", granted = true))
        assertTrue(Rereads.routesWidened(before = null, granted = true))
        assertFalse(Rereads.routesWidened(before = "true", granted = true))
        assertFalse(Rereads.routesWidened(before = "false", granted = false))
        assertFalse(Rereads.routesWidened(before = "true", granted = false))
    }

    @Test
    fun aRereadSendsChangedContentAtAnEqualModifiedAt() {
        val withoutRoute = Rereads.hash("""{"exerciseRouteResult":{"type":"ConsentRequired","exerciseRoute":null}}""")
        val withRoute = Rereads.hash("""{"exerciseRouteResult":{"type":"Data","exerciseRoute":{"route":[]}}}""")
        assertNotEquals(withoutRoute, withRoute)
        val sent = KnownRecord(modifiedAt = 100, contentHash = withoutRoute)
        val indexedBeforeHashes = KnownRecord(modifiedAt = 100, contentHash = null)

        assertFalse(Rereads.mustSend(sent, 100, withRoute, rereading = false))
        assertTrue(Rereads.mustSend(sent, 100, withRoute, rereading = true))
        assertTrue(Rereads.mustSend(indexedBeforeHashes, 100, withRoute, rereading = true))
        assertFalse(Rereads.mustSend(KnownRecord(100, withRoute), 100, withRoute, rereading = true))
    }

    @Test
    fun newAndModifiedRecordsAreAlwaysSent() {
        val hash = Rereads.hash("x")
        for (rereading in listOf(false, true)) {
            assertTrue(Rereads.mustSend(null, 100, hash, rereading))
            assertTrue(Rereads.mustSend(KnownRecord(99, hash), 100, hash, rereading))
        }
    }

    @Test
    fun theHashIsStableSha256Hex() {
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Rereads.hash("abc"))
    }

    @Test
    fun routeAccessIsReportedAsAGrant() {
        assertEquals("granted", StatusFields.routes(setOf(HealthRecordTypes.EXERCISE_ROUTES_PERMISSION), supported = true))
        assertEquals("denied", StatusFields.routes(emptySet(), supported = true))
        assertEquals("unsupported", StatusFields.routes(emptySet(), supported = false))
    }

    @Test
    fun powerStatusFollowsTheContract() {
        val restricted = StatusFields.power(ignoringBatteryOptimizations = false, backgroundRestricted = true, autostartScreen = true)
        assertEquals(listOf("batteryOptimization", "backgroundRestricted", "autostartSettings"), restricted.keys.toList())
        assertEquals(JsonPrimitive("optimized"), restricted["batteryOptimization"])
        assertEquals(JsonPrimitive(true), restricted["backgroundRestricted"])
        assertEquals(JsonPrimitive("available"), restricted["autostartSettings"])

        val free = StatusFields.power(ignoringBatteryOptimizations = true, backgroundRestricted = null, autostartScreen = false)
        assertEquals(JsonPrimitive("exempt"), free["batteryOptimization"])
        assertEquals(JsonNull, free["backgroundRestricted"])
        assertEquals(JsonPrimitive("unsupported"), free["autostartSettings"])
    }

    @Test
    fun rereadStateIsReportedPerType() {
        assertEquals("pending", StatusFields.reread(RereadState.PENDING))
        assertEquals("running", StatusFields.reread(RereadState.RUNNING))
        assertNull(StatusFields.reread(null))
    }
}
