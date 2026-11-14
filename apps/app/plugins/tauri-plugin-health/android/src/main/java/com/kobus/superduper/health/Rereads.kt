package com.kobus.superduper.health

import java.security.MessageDigest

internal class KnownRecord(val modifiedAt: Long, val contentHash: String?)

internal enum class RereadState { PENDING, RUNNING }

internal enum class RereadStep {
    /** Read the type as usual. */
    NORMAL,
    /** Forget the type's cursor, then read it as [CONTINUE]. */
    START,
    /** Backfill the whole window and send records whose content changed even at equal `modifiedAt`. */
    CONTINUE,
    /** Leave the type for the next foreground sync. */
    SKIP,
}

/**
 * A re-read sends again every record of one type whose content differs from what was last
 * read, also when its `modifiedAt` did not change, for example once exercise routes become
 * readable. Re-reads run only in foreground syncs: Health Connect withholds other apps' routes
 * from background reads, and a background re-read could replace a full record on the server
 * with a reduced one. A pending re-read does not stop background syncs from reading the type
 * incrementally; one that has started (its cursor is gone) waits for the foreground.
 */
internal object Rereads {
    const val EXERCISE_SESSIONS = "ExerciseSessionRecord"

    fun step(state: RereadState?, trigger: Trigger): RereadStep = when {
        state == null -> RereadStep.NORMAL
        trigger != Trigger.FOREGROUND -> if (state == RereadState.RUNNING) RereadStep.SKIP else RereadStep.NORMAL
        state == RereadState.PENDING -> RereadStep.START
        else -> RereadStep.CONTINUE
    }

    /** Route access widened since the last sync that read Health Connect ([before] null: never recorded). */
    fun routesWidened(before: String?, granted: Boolean) = granted && before != "true"

    fun hash(content: String): String =
        MessageDigest.getInstance("SHA-256").digest(content.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }

    /**
     * Whether a read record must be queued. Normally only a new `modifiedAt` counts; while
     * re-reading, a different content hash (or none recorded yet) counts too.
     */
    fun mustSend(known: KnownRecord?, modifiedAt: Long, contentHash: String, rereading: Boolean): Boolean = when {
        known == null || known.modifiedAt != modifiedAt -> true
        rereading -> known.contentHash != contentHash
        else -> false
    }
}
