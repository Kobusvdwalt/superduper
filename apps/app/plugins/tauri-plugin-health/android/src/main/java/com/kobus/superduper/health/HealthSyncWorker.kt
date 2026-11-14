package com.kobus.superduper.health

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import java.time.Instant
import java.util.concurrent.TimeUnit

/** Runs the hourly sync and, with [KEY_RETRY], the one-time retries chosen by [RetryPolicy]. */
class HealthSyncWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val retry = inputData.getBoolean(KEY_RETRY, false)
        val outcome = SyncEngine.run(applicationContext, if (retry) Trigger.RETRY else Trigger.BACKGROUND)
        return if (outcome.retry == RetryAction.CONTINUE) Result.retry() else Result.success()
    }

    companion object {
        private const val NAME = "superduper-health-sync"
        private const val RETRY_NAME = "superduper-health-retry"
        private const val KEY_RETRY = "retry"

        private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<HealthSyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(online)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(NAME, ExistingPeriodicWorkPolicy.UPDATE, request)
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NAME)
            cancelRetry(context)
        }

        /** Called by [SyncEngine.run] while it holds the sync lock, so no other sync is running. */
        internal fun applyRetry(context: Context, action: RetryAction) {
            when (action) {
                RetryAction.CANCEL -> cancelRetry(context)
                RetryAction.START -> enqueueRetry(context, ExistingWorkPolicy.REPLACE)
                RetryAction.START_IF_IDLE -> enqueueRetry(context, ExistingWorkPolicy.KEEP)
                RetryAction.NONE, RetryAction.CONTINUE -> Unit
            }
        }

        private fun enqueueRetry(context: Context, policy: ExistingWorkPolicy) {
            val request = OneTimeWorkRequestBuilder<HealthSyncWorker>()
                .setConstraints(online)
                .setInitialDelay(RetryPolicy.INITIAL_DELAY_SECONDS, TimeUnit.SECONDS)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, RetryPolicy.INITIAL_DELAY_SECONDS, TimeUnit.SECONDS)
                .setInputData(workDataOf(KEY_RETRY to true))
                .build()
            WorkManager.getInstance(context).enqueueUniqueWork(RETRY_NAME, policy, request)
        }

        private fun cancelRetry(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(RETRY_NAME)
        }

        /** When the pending retry is due, or null when none is waiting. */
        fun nextRetryAt(context: Context): Instant? =
            WorkManager.getInstance(context).getWorkInfosForUniqueWork(RETRY_NAME).get()
                .firstOrNull { it.state == WorkInfo.State.ENQUEUED }
                ?.nextScheduleTimeMillis
                ?.takeIf { it != Long.MAX_VALUE }
                ?.let(Instant::ofEpochMilli)
    }
}
