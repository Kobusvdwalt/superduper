package com.kobus.superduper.health

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Status fields of docs/shell-contract.md that do not come straight from a setting. */
internal object StatusFields {
    fun routes(granted: Set<String>, supported: Boolean): String = when {
        HealthRecordTypes.EXERCISE_ROUTES_PERMISSION in granted -> "granted"
        supported -> "denied"
        else -> "unsupported"
    }

    fun power(ignoringBatteryOptimizations: Boolean, backgroundRestricted: Boolean?, autostartScreen: Boolean): JsonObject = payload {
        string("batteryOptimization", if (ignoringBatteryOptimizations) "exempt" else "optimized")
        raw("backgroundRestricted", backgroundRestricted?.let(::JsonPrimitive))
        string("autostartSettings", if (autostartScreen) "available" else "unsupported")
    }

    fun reread(state: RereadState?): String? = when (state) {
        RereadState.PENDING -> "pending"
        RereadState.RUNNING -> "running"
        null -> null
    }
}
