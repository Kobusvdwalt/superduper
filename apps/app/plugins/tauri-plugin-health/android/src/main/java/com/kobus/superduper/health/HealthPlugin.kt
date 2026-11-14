package com.kobus.superduper.health

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract
import app.tauri.annotation.ActivityCallback
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private class CommandFailure(val code: String, message: String) : Exception(message)

/** Commands are reached only through the Rust plugin, which authorises the caller first. */
@TauriPlugin
class HealthPlugin(private val activity: Activity) : Plugin(activity) {
    private val context get() = activity.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun load(webView: WebView) {
        scope.launch {
            val db = SyncDatabase.get(context)
            if (db.connection() != null && db.setting("needsRepair") != "true" && SyncEngine.autoSync(db)) {
                HealthSyncWorker.schedule(context)
            }
        }
    }

    private fun fail(invoke: Invoke, error: Exception) = when (error) {
        is CommandFailure -> invoke.reject(error.message, error.code)
        is IllegalArgumentException -> invoke.reject(error.message, "INVALID_ARGUMENT")
        else -> invoke.reject("${error.javaClass.simpleName}: ${error.message ?: ""}".trim(), "INTERNAL")
    }

    private fun respond(invoke: Invoke, action: suspend (shellServerUrl: String?) -> Unit = {}) {
        val shellServerUrl = invoke.getArgs().optString("shellServerUrl").ifEmpty { null }
        scope.launch {
            try {
                action(shellServerUrl)
                invoke.resolve(JSObject(SyncEngine.status(context, shellServerUrl).toString()))
            } catch (error: Exception) {
                fail(invoke, error)
            }
        }
    }

    /** Opens [intent] for a result and resolves with the status once the user returns. */
    private fun openForStatus(invoke: Invoke, intent: Intent, callback: String = "statusResult") {
        activity.runOnUiThread {
            try {
                startActivityForResult(invoke, intent, callback)
            } catch (error: ActivityNotFoundException) {
                invoke.reject("The settings screen could not be opened", "UNSUPPORTED")
            }
        }
    }

    @ActivityCallback
    fun statusResult(invoke: Invoke, @Suppress("UNUSED_PARAMETER") result: ActivityResult) = respond(invoke)

    private fun startSync() {
        scope.launch { SyncEngine.run(context, Trigger.FOREGROUND) }
    }

    @Command
    fun status(invoke: Invoke) = respond(invoke)

    // Named apart from Plugin.requestPermissions, which Tauri uses for Android runtime permissions.
    @Command
    fun requestHealthPermissions(invoke: Invoke) {
        scope.launch {
            try {
                if (SyncEngine.availability(context) != "available") {
                    throw CommandFailure("UNAVAILABLE", "Health Connect is not installed or needs an update")
                }
                val client = HealthConnectClient.getOrCreate(context)
                val permissions = SyncEngine.requestablePermissions(client)
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, permissions)
                activity.runOnUiThread { startActivityForResult(invoke, intent, "permissionsResult") }
            } catch (error: Exception) {
                fail(invoke, error)
            }
        }
    }

    @ActivityCallback
    fun permissionsResult(invoke: Invoke, @Suppress("UNUSED_PARAMETER") result: ActivityResult) = respond(invoke) {
        if (SyncDatabase.get(context).connection() != null) startSync()
    }

    /**
     * READ_EXERCISE_ROUTES is outside Health Connect's permission screen. Its route dialog,
     * opened for one workout whose route is withheld, offers to allow all routes; without
     * such a workout only Health Connect's settings for this app can grant it.
     */
    @Command
    fun requestExerciseRoutes(invoke: Invoke) {
        scope.launch {
            try {
                if (SyncEngine.availability(context) != "available") {
                    throw CommandFailure("UNAVAILABLE", "Health Connect is not installed or needs an update")
                }
                val client = HealthConnectClient.getOrCreate(context)
                if (HealthRecordTypes.EXERCISE_ROUTES_PERMISSION in client.permissionController.getGrantedPermissions()) {
                    respond(invoke)
                    return@launch
                }
                if (!SyncEngine.routesSupported(context)) {
                    throw CommandFailure("UNSUPPORTED", "This Android version shares exercise routes only one workout at a time")
                }
                val sessionId = SyncEngine.sessionAwaitingRouteConsent(context, client)
                val intent = sessionId?.let { ExerciseRouteRequestContract().createIntent(activity, it) } ?: healthConnectAppSettings()
                openForStatus(invoke, intent, "exerciseRoutesResult")
            } catch (error: Exception) {
                fail(invoke, error)
            }
        }
    }

    @ActivityCallback
    fun exerciseRoutesResult(invoke: Invoke, @Suppress("UNUSED_PARAMETER") result: ActivityResult) = respond(invoke) {
        if (SyncDatabase.get(context).connection() != null) startSync()
    }

    private fun healthConnectAppSettings(): Intent {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val intent = Intent(MANAGE_HEALTH_PERMISSIONS).putExtra(Intent.EXTRA_PACKAGE_NAME, context.packageName)
            if (intent.resolveActivity(context.packageManager) != null) return intent
        }
        return Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
    }

    @Command
    fun requestBatteryExemption(invoke: Invoke) {
        if (BackgroundAccess.ignoringBatteryOptimizations(context)) return respond(invoke)
        val intent = BackgroundAccess.batteryExemptionIntent(context)
            ?: return invoke.reject("This device has no battery optimisation settings", "UNSUPPORTED")
        openForStatus(invoke, intent)
    }

    @Command
    fun openAutostartSettings(invoke: Invoke) {
        val candidates = BackgroundAccess.autostartIntents(context)
        activity.runOnUiThread {
            val opened = candidates.any { intent ->
                try {
                    activity.startActivity(intent)
                    true
                } catch (_: ActivityNotFoundException) {
                    false
                } catch (_: SecurityException) {
                    false
                }
            }
            if (opened) respond(invoke) else invoke.reject("This device has no autostart settings screen", "UNSUPPORTED")
        }
    }

    @Command
    fun openHealthConnect(invoke: Invoke) = respond(invoke) {
        val intent = if (SyncEngine.availability(context) == "available") {
            Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS)
        } else {
            Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$PROVIDER&url=healthconnect%3A%2F%2Fonboarding"))
                .setPackage("com.android.vending")
        }
        activity.runOnUiThread {
            try {
                activity.startActivity(intent)
            } catch (_: ActivityNotFoundException) {
                activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/apps/details?id=$PROVIDER")))
            }
        }
    }

    @Command
    fun pair(invoke: Invoke) = respond(invoke) {
        val args = invoke.getArgs()
        val serverUrl = ServerPolicy.origin(args.getString("serverUrl"), SyncEngine.debuggable(context))
        val token = args.getString("token")
        val clientId = args.getString("clientId")
        val db = SyncDatabase.get(context)
        val previous = db.connection()
        if (previous != null && (previous.clientId != clientId || previous.serverUrl != serverUrl)) db.wipeSyncState()
        db.saveConnection(Connection(serverUrl, token, clientId))
        db.setSetting("needsRepair", null)
        db.setSetting("lastError", null)
        if (SyncEngine.autoSync(db)) HealthSyncWorker.schedule(context)
        startSync()
    }

    @Command
    fun unpair(invoke: Invoke) = respond(invoke) {
        HealthSyncWorker.cancel(context)
        SyncDatabase.get(context).wipeSyncState()
    }

    @Command
    fun syncNow(invoke: Invoke) = respond(invoke) {
        val db = SyncDatabase.get(context)
        if (db.connection() == null) throw CommandFailure("NOT_PAIRED", "Pair this phone with the server first")
        if (db.setting("needsRepair") == "true") throw CommandFailure("UNAUTHENTICATED", "The client token was rejected; pair again")
        startSync()
    }

    @Command
    fun setAutoSync(invoke: Invoke) = respond(invoke) {
        val enabled = invoke.getArgs().getBoolean("enabled")
        val db = SyncDatabase.get(context)
        db.setSetting("autoSync", enabled.toString())
        if (enabled && db.connection() != null && db.setting("needsRepair") != "true") HealthSyncWorker.schedule(context)
        if (!enabled) HealthSyncWorker.cancel(context)
    }

    @Command
    fun setHistoryDays(invoke: Invoke) = respond(invoke) {
        val days = invoke.getArgs().getInt("days")
        require(days in 1..36500) { "days must be between 1 and 36500" }
        val db = SyncDatabase.get(context)
        if (days != SyncEngine.historyDays(db)) {
            db.setSetting("historyDays", days.toString())
            db.forgetAllCursors()
        }
    }

    private companion object {
        const val PROVIDER = "com.google.android.apps.healthdata"
        // HealthConnectManager.ACTION_MANAGE_HEALTH_PERMISSIONS, Android 14+.
        const val MANAGE_HEALTH_PERMISSIONS = "android.health.connect.action.MANAGE_HEALTH_PERMISSIONS"
    }
}
