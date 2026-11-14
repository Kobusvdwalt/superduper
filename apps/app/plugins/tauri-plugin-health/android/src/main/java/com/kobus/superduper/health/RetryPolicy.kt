package com.kobus.superduper.health

internal enum class RunOutcome {
    /** Finished, or failed in a way a quick retry cannot fix. */
    DONE,
    /** Network error, server error or Health Connect quota: worth trying again soon. */
    TRANSIENT,
    NEEDS_REPAIR,
}

internal enum class RetryAction {
    NONE,
    /** Drop any pending retry. */
    CANCEL,
    /** Start a retry chain, replacing a pending one (its backoff restarts). */
    START,
    /** Start a retry chain unless one is already pending. */
    START_IF_IDLE,
    /** The retry worker asks WorkManager to back off and run it again. */
    CONTINUE,
}

internal class RetryDecision(val failureStreak: Int, val action: RetryAction)

/**
 * One-time retries after a transient failure, on top of the hourly job. [failureStreak] counts
 * consecutive transient failures across every trigger; once it passes [MAX_STREAK] no further
 * retry is queued and only the hourly job runs until a sync succeeds, so a server that stays
 * unreachable costs at most [MAX_STREAK] extra runs. A foreground sync starts a fresh streak.
 */
internal object RetryPolicy {
    const val MAX_STREAK = 7
    const val INITIAL_DELAY_SECONDS = 60L

    fun decide(outcome: RunOutcome, trigger: Trigger, previousStreak: Int): RetryDecision {
        if (outcome != RunOutcome.TRANSIENT) {
            return RetryDecision(0, if (trigger == Trigger.RETRY) RetryAction.NONE else RetryAction.CANCEL)
        }
        val streak = if (trigger == Trigger.FOREGROUND) 1 else previousStreak + 1
        if (streak > MAX_STREAK) return RetryDecision(streak, RetryAction.NONE)
        return RetryDecision(
            streak,
            when (trigger) {
                Trigger.FOREGROUND -> RetryAction.START
                Trigger.BACKGROUND -> RetryAction.START_IF_IDLE
                Trigger.RETRY -> RetryAction.CONTINUE
            },
        )
    }

    /** [readIncomplete]: reading stopped early on the read quota or a retryable upload failure. */
    fun outcome(needsRepair: Boolean, drain: DrainResult?, readIncomplete: Boolean): RunOutcome = when {
        needsRepair -> RunOutcome.NEEDS_REPAIR
        readIncomplete -> RunOutcome.TRANSIENT
        drain is DrainResult.Interrupted && drain.retryable -> RunOutcome.TRANSIENT
        else -> RunOutcome.DONE
    }
}
