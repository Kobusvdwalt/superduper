package com.kobus.superduper.health

import androidx.health.connect.client.units.BloodGlucose
import androidx.health.connect.client.units.Energy
import androidx.health.connect.client.units.Length
import androidx.health.connect.client.units.Mass
import androidx.health.connect.client.units.Percentage
import androidx.health.connect.client.units.Power
import androidx.health.connect.client.units.Pressure
import androidx.health.connect.client.units.Temperature
import androidx.health.connect.client.units.TemperatureDelta
import androidx.health.connect.client.units.Velocity
import androidx.health.connect.client.units.Volume
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/** Builds one JSON object following the payload rules of docs/health-sync-contract.md. */
internal class Payload {
    private val fields = LinkedHashMap<String, JsonElement>()

    fun build() = JsonObject(fields)

    fun raw(name: String, value: JsonElement?) = apply { fields[name] = value ?: JsonNull }

    fun string(name: String, value: String?) = raw(name, value?.let(::JsonPrimitive))

    fun long(name: String, value: Long) = raw(name, JsonPrimitive(value))

    fun int(name: String, value: Int) = raw(name, JsonPrimitive(value))

    fun double(name: String, value: Double) = raw(name, number(value))

    fun boolean(name: String, value: Boolean) = raw(name, JsonPrimitive(value))

    fun instant(name: String, value: Instant?) = string(name, value?.let(::iso))

    fun zoneOffset(name: String, value: ZoneOffset?) =
        raw("${name}Seconds", value?.let { JsonPrimitive(it.totalSeconds) })

    fun duration(name: String, value: Duration?) =
        raw("${name}Millis", value?.let { JsonPrimitive(it.toMillis()) })

    fun constant(name: String, value: Int, names: Map<Int, String>) =
        int(name, value).string("${name}Name", names[value])

    fun objects(name: String, values: List<JsonObject>) = raw(name, JsonArray(values))

    fun length(name: String, value: Length?) = unit(name, value?.inMeters, "meters")

    fun mass(name: String, value: Mass?) = unit(name, value?.inKilograms, "kilograms")

    fun energy(name: String, value: Energy?) = unit(name, value?.inKilocalories, "kilocalories")

    fun power(name: String, value: Power?) = unit(name, value?.inWatts, "watts")

    fun volume(name: String, value: Volume?) = unit(name, value?.inLiters, "liters")

    fun pressure(name: String, value: Pressure?) =
        unit(name, value?.inMillimetersOfMercury, "millimetersOfMercury")

    fun temperature(name: String, value: Temperature?) = unit(name, value?.inCelsius, "celsius")

    fun temperatureDelta(name: String, value: TemperatureDelta?) =
        unit(name, value?.inCelsius, "celsius")

    fun bloodGlucose(name: String, value: BloodGlucose?) =
        unit(name, value?.inMillimolesPerLiter, "millimolesPerLiter")

    fun velocity(name: String, value: Velocity?) =
        unit(name, value?.inMetersPerSecond, "metersPerSecond")

    fun percentage(name: String, value: Percentage?) = unit(name, value?.value, "percent")

    private fun unit(name: String, value: Double?, unit: String) = raw(
        name,
        value?.let { JsonObject(mapOf("value" to number(it), "unit" to JsonPrimitive(unit))) },
    )

    companion object {
        fun iso(instant: Instant): String = instant.toString()

        /** JSON has no NaN or Infinity; such values become null rather than invalid JSON. */
        fun number(value: Double): JsonElement = if (value.isFinite()) JsonPrimitive(value) else JsonNull
    }
}

internal inline fun payload(block: Payload.() -> Unit): JsonObject = Payload().apply(block).build()
