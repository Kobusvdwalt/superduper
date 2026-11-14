package com.kobus.superduper.health

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import androidx.activity.result.ActivityResult
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
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

    private fun respond(invoke: Invoke, action: suspend (shellServerUrl: String?) -> Unit = {}) {
        val shellServerUrl = invoke.getArgs().optString("shellServerUrl").ifEmpty { null }
        scope.launch {
            try {
                action(shellServerUrl)
                invoke.resolve(JSObject(SyncEngine.status(context, shellServerUrl).toString()))
            } catch (failure: CommandFailure) {
                invoke.reject(failure.message, failure.code)
            } catch (error: IllegalArgumentException) {
                invoke.reject(error.message, "INVALID_ARGUMENT")
            } catch (error: Exception) {
                invoke.reject("${error.javaClass.simpleName}: ${error.message ?: ""}".trim(), "INTERNAL")
            }
        }
    }

    private fun startSync() {
        scope.launch { SyncEngine.run(context, Trigger.FOREGROUND) }
    }

    @Command
    fun status(invoke: Invoke) = respond(invoke)

    @Command
    fun requestPermissions(invoke: Invoke) {
        scope.launch {
            try {
                if (SyncEngine.availability(context) != "available") {
                    throw CommandFailure("UNAVAILABLE", "Health Connect is not installed or needs an update")
                }
                val client = HealthConnectClient.getOrCreate(context)
                val permissions = SyncEngine.requestablePermissions(context, client)
                val intent = PermissionController.createRequestPermissionResultContract().createIntent(activity, permissions)
                activity.runOnUiThread { startActivityForResult(invoke, intent, "permissionsResult") }
            } catch (failure: CommandFailure) {
                invoke.reject(failure.message, failure.code)
            } catch (error: Exception) {
                invoke.reject("${error.javaClass.simpleName}: ${error.message ?: ""}".trim(), "INTERNAL")
            }
        }
    }

    @ActivityCallback
    fun permissionsResult(invoke: Invoke, @Suppress("UNUSED_PARAMETER") result: ActivityResult) = respond(invoke) {
        if (SyncDatabase.get(context).connection() != null) startSync()
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
    }
}
