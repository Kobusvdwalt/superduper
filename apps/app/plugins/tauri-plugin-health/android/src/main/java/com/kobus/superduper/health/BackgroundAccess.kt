package com.kobus.superduper.health

import android.app.ActivityManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * What lets the hourly WorkManager job run on vendor builds that stop background apps.
 * Neither Android nor the vendors offer a way to read the autostart switch, so only whether
 * a settings screen for it exists is reported.
 */
internal object BackgroundAccess {
    /**
     * Vendor autostart screens, tried in order. Each package is listed under `<queries>` in the
     * plugin manifest; Android 11+ hides other packages' activities otherwise.
     */
    val AUTOSTART_SCREENS = listOf(
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
    )

    fun ignoringBatteryOptimizations(context: Context): Boolean =
        (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)

    /** "Restricted" in the app's battery settings (Android 9+); null before that. */
    fun backgroundRestricted(context: Context): Boolean? =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            (context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager).isBackgroundRestricted
        } else {
            null
        }

    // An explicit component resolves without intent-filter matching, so flags 0 there.
    private fun resolves(context: Context, intent: Intent) =
        context.packageManager.resolveActivity(intent, if (intent.component == null) PackageManager.MATCH_DEFAULT_ONLY else 0)
            ?.activityInfo?.exported == true

    /** The system dialog asking to exempt this app, or the exemption list where the dialog is missing. */
    fun batteryExemptionIntent(context: Context): Intent? = listOf(
        Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")),
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
    ).firstOrNull { resolves(context, it) }

    fun autostartIntents(context: Context): List<Intent> =
        AUTOSTART_SCREENS.map { Intent().setComponent(it) }.filter { resolves(context, it) }
}
