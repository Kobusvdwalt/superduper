package com.kobus.superduper.health

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import kotlin.math.abs
import kotlin.math.max

class RecordSerializersTest {
    private val envelopes = SyntheticRecords.all.associate { record ->
        HealthRecordTypes.of(record).name to RecordSerializers.envelope(record)
    }

    @Test
    fun everyRegisteredTypeHasASyntheticRecord() {
        assertEquals(HealthRecordTypes.all.map { it.name }.sorted(), envelopes.keys.sorted())
        assertEquals(41, envelopes.size)
    }

    @Test
    fun envelopeHasExactlyTheHealthRecordInputFields() {
        val expected = listOf(
            "origin", "recordType", "sourceRecordId", "dataOrigin", "startTime", "endTime",
            "startZoneOffsetSeconds", "endZoneOffsetSeconds", "modifiedAt", "payload",
        )
        for ((type, envelope) in envelopes) {
            assertEquals(type, expected, envelope.keys.toList())
            assertEquals(type, "HEALTH_CONNECT", envelope.string("origin"))
            assertEquals(type, envelope.string("sourceRecordId"), envelope.obj("payload").obj("metadata").string("id"))
        }
    }

    @Test
    fun pointRecordsHaveNoEnd() {
        val weight = envelopes.getValue("WeightRecord")
        assertEquals(JsonNull, weight["endTime"])
        assertEquals(JsonNull, weight["endZoneOffsetSeconds"])
        assertEquals("2026-11-10T06:45:00Z", weight.string("startTime"))
        assertEquals(JsonPrimitive(7200), weight["startZoneOffsetSeconds"])
    }

    @Test
    fun payloadsFollowTheContractRules() {
        val units = setOf(
            "meters", "kilograms", "kilocalories", "watts", "liters", "millimetersOfMercury",
            "celsius", "millimolesPerLiter", "metersPerSecond", "percent",
        )
        val metadataKeys = setOf(
            "id", "dataOrigin", "lastModifiedTime", "clientRecordId", "clientRecordVersion",
            "recordingMethod", "recordingMethodName", "device",
        )
        for ((type, envelope) in envelopes) {
            val payload = envelope.obj("payload")
            assertEquals(type, metadataKeys, payload.obj("metadata").keys)
            walk(payload) { key, value ->
                if (value is JsonObject && "unit" in value) {
                    assertTrue("$type.$key unit ${value["unit"]}", value.string("unit") in units)
                    assertEquals("$type.$key", setOf("value", "unit"), value.keys)
                }
                if (key.endsWith("Name") && key != "name") {
                    val constant = key.removeSuffix("Name")
                    assertTrue("$type.$key has no sibling", constant in (parentOf(payload, key) ?: JsonObject(emptyMap())))
                }
                assertTrue("$type.$key looks like a raw Duration/ZoneOffset", !key.endsWith("Offset") && key != "duration")
            }
        }
    }

    @Test
    fun unknownConstantsGetANullName() {
        val json = payload { constant("stage", 999, ConstantNames.sleepStageType) }
        assertEquals(JsonPrimitive(999), json["stage"])
        assertEquals(JsonNull, json["stageName"])
    }

    /**
     * Compares each serialised synthetic record with the shared fixture of the same type.
     * Point `-Psuperduper.fixtures=<dir>` (or SUPERDUPER_FIXTURES) at
     * contracts/health-connect/v1; by default the repository copy is used when present.
     */
    @Test
    fun matchesContractFixtures() {
        val dir = System.getProperty("superduper.fixtures")?.let(::File)
        assumeTrue("Fixture directory not found ($dir); skipping fixture comparison", dir != null && dir.isDirectory)
        val problems = mutableListOf<String>()
        val fixtures = dir!!.listFiles { file -> file.name.endsWith(".json") }!!.associateBy { it.name.removeSuffix(".json") }
        for (missing in envelopes.keys - fixtures.keys) problems += "$missing: no fixture"
        for (extra in fixtures.keys - envelopes.keys) problems += "$extra: fixture for an unknown record type"
        for ((type, file) in fixtures) {
            val actual = envelopes[type] ?: continue
            diff(type, Json.parseToJsonElement(file.readText()), actual, problems)
        }
        assertTrue("Fixture mismatches:\n" + problems.joinToString("\n"), problems.isEmpty())
    }

    private fun diff(path: String, expected: JsonElement, actual: JsonElement, problems: MutableList<String>) {
        when {
            expected is JsonObject && actual is JsonObject -> {
                for (key in expected.keys + actual.keys) {
                    when {
                        key !in actual -> problems += "$path.$key: missing in serialiser output"
                        key !in expected -> problems += "$path.$key: not in fixture"
                        else -> diff("$path.$key", expected.getValue(key), actual.getValue(key), problems)
                    }
                }
            }
            expected is JsonArray && actual is JsonArray -> {
                if (expected.size != actual.size) problems += "$path: ${expected.size} items expected, ${actual.size} produced"
                expected.zip(actual).forEachIndexed { index, (e, a) -> diff("$path[$index]", e, a, problems) }
            }
            expected is JsonPrimitive && actual is JsonPrimitive && !expected.isString && !actual.isString &&
                expected.doubleOrNull != null && actual.doubleOrNull != null -> {
                val e = expected.doubleOrNull!!
                val a = actual.doubleOrNull!!
                if (abs(e - a) > 1e-9 * max(1.0, abs(e))) problems += "$path: expected $e, got $a"
            }
            expected != actual -> problems += "$path: expected $expected, got $actual"
        }
    }

    private fun walk(element: JsonElement, visit: (String, JsonElement) -> Unit) {
        when (element) {
            is JsonObject -> element.forEach { (key, value) -> visit(key, value); walk(value, visit) }
            is JsonArray -> element.forEach { walk(it, visit) }
            else -> Unit
        }
    }

    private fun parentOf(root: JsonElement, key: String): JsonObject? = when (root) {
        is JsonObject -> if (key in root) root else root.values.firstNotNullOfOrNull { parentOf(it, key) }
        is JsonArray -> root.firstNotNullOfOrNull { parentOf(it, key) }
        else -> null
    }

    private fun JsonObject.obj(key: String) = getValue(key) as JsonObject
    private fun JsonObject.string(key: String) = (getValue(key) as JsonPrimitive).content
}
