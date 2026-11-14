package com.kobus.superduper.health

import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureRecord
import androidx.health.connect.client.records.BodyWaterMassRecord
import androidx.health.connect.client.records.BoneMassRecord
import androidx.health.connect.client.records.CervicalMucusRecord
import androidx.health.connect.client.records.CyclingPedalingCadenceRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ElevationGainedRecord
import androidx.health.connect.client.records.ExerciseCompletionGoal
import androidx.health.connect.client.records.ExerciseLap
import androidx.health.connect.client.records.ExercisePerformanceTarget
import androidx.health.connect.client.records.ExerciseRoute
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.IntermenstrualBleedingRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.MenstruationFlowRecord
import androidx.health.connect.client.records.MenstruationPeriodRecord
import androidx.health.connect.client.records.MindfulnessSessionRecord
import androidx.health.connect.client.records.NutritionRecord
import androidx.health.connect.client.records.OvulationTestRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.PlannedExerciseBlock
import androidx.health.connect.client.records.PlannedExerciseSessionRecord
import androidx.health.connect.client.records.PlannedExerciseStep
import androidx.health.connect.client.records.PowerRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RespiratoryRateRecord
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SexualActivityRecord
import androidx.health.connect.client.records.SkinTemperatureRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.SpeedRecord
import androidx.health.connect.client.records.StepsCadenceRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.Vo2MaxRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.WheelchairPushesRecord
import androidx.health.connect.client.records.metadata.Metadata
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.time.ZoneOffset

/**
 * Explicit serialisers, one per Health Connect record type, following the payload rules of
 * docs/health-sync-contract.md. Sealed values (route results, completion goals, performance
 * targets) carry their subclass name under `type`, which the contract does not cover.
 */
internal object RecordSerializers {
    /**
     * The `HealthRecordInput` for [record]. Times are taken from the payload because
     * connect-client keeps the interval/instantaneous record interfaces internal.
     */
    fun envelope(record: Record): JsonObject {
        val type = HealthRecordTypes.of(record)
        val metadata = record.metadata
        val body = serialize(record)
        val point = "time" in body
        return payload {
            string("origin", "HEALTH_CONNECT")
            string("recordType", type.name)
            string("sourceRecordId", metadata.id)
            string("dataOrigin", metadata.dataOrigin.packageName.ifEmpty { null })
            raw("startTime", body[if (point) "time" else "startTime"])
            raw("endTime", if (point) null else body["endTime"])
            raw("startZoneOffsetSeconds", body[if (point) "zoneOffsetSeconds" else "startZoneOffsetSeconds"])
            raw("endZoneOffsetSeconds", if (point) null else body["endZoneOffsetSeconds"])
            instant("modifiedAt", metadata.lastModifiedTime)
            raw("payload", body)
        }
    }

    fun startTime(envelope: JsonObject): Instant =
        Instant.parse((envelope.getValue("startTime") as JsonPrimitive).content)

    fun serialize(record: Record): JsonObject = when (record) {
        is ActiveCaloriesBurnedRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { energy("energy", record.energy) }
        is BasalBodyTemperatureRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            temperature("temperature", record.temperature)
            constant("measurementLocation", record.measurementLocation, ConstantNames.bodyTemperatureMeasurementLocation)
        }
        is BasalMetabolicRateRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { power("basalMetabolicRate", record.basalMetabolicRate) }
        is BloodGlucoseRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            bloodGlucose("level", record.level)
            constant("specimenSource", record.specimenSource, ConstantNames.specimenSource)
            constant("mealType", record.mealType, ConstantNames.mealType)
            constant("relationToMeal", record.relationToMeal, ConstantNames.relationToMeal)
        }
        is BloodPressureRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            pressure("systolic", record.systolic)
            pressure("diastolic", record.diastolic)
            constant("bodyPosition", record.bodyPosition, ConstantNames.bodyPosition)
            constant("measurementLocation", record.measurementLocation, ConstantNames.bloodPressureMeasurementLocation)
        }
        is BodyFatRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { percentage("percentage", record.percentage) }
        is BodyTemperatureRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            temperature("temperature", record.temperature)
            constant("measurementLocation", record.measurementLocation, ConstantNames.bodyTemperatureMeasurementLocation)
        }
        is BodyWaterMassRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { mass("mass", record.mass) }
        is BoneMassRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { mass("mass", record.mass) }
        is CervicalMucusRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            constant("appearance", record.appearance, ConstantNames.cervicalMucusAppearance)
            constant("sensation", record.sensation, ConstantNames.cervicalMucusSensation)
        }
        is CyclingPedalingCadenceRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("samples", record.samples.map {
                payload { instant("time", it.time); double("revolutionsPerMinute", it.revolutionsPerMinute) }
            })
        }
        is DistanceRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { length("distance", record.distance) }
        is ElevationGainedRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { length("elevation", record.elevation) }
        is ExerciseSessionRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            constant("exerciseType", record.exerciseType, ConstantNames.exerciseType)
            string("title", record.title)
            string("notes", record.notes)
            objects("segments", record.segments.map(::segment))
            objects("laps", record.laps.map(::lap))
            raw("exerciseRouteResult", routeResult(record.exerciseRouteResult))
            string("plannedExerciseSessionId", record.plannedExerciseSessionId)
        }
        is FloorsClimbedRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { double("floors", record.floors) }
        is HeartRateRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("samples", record.samples.map {
                payload { instant("time", it.time); long("beatsPerMinute", it.beatsPerMinute) }
            })
        }
        is HeartRateVariabilityRmssdRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            double("heartRateVariabilityMillis", record.heartRateVariabilityMillis)
        }
        is HeightRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { length("height", record.height) }
        is HydrationRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { volume("volume", record.volume) }
        is IntermenstrualBleedingRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {}
        is LeanBodyMassRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { mass("mass", record.mass) }
        is MenstruationFlowRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            constant("flow", record.flow, ConstantNames.menstruationFlow)
        }
        is MenstruationPeriodRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {}
        is MindfulnessSessionRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            constant("mindfulnessSessionType", record.mindfulnessSessionType, ConstantNames.mindfulnessSessionType)
            string("title", record.title)
            string("notes", record.notes)
        }
        is NutritionRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { nutrition(record) }
        is OvulationTestRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            constant("result", record.result, ConstantNames.ovulationTestResult)
        }
        is OxygenSaturationRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { percentage("percentage", record.percentage) }
        is PlannedExerciseSessionRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            boolean("hasExplicitTime", record.hasExplicitTime)
            constant("exerciseType", record.exerciseType, ConstantNames.exerciseType)
            string("completedExerciseSessionId", record.completedExerciseSessionId)
            objects("blocks", record.blocks.map(::block))
            string("title", record.title)
            string("notes", record.notes)
        }
        is PowerRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("samples", record.samples.map {
                payload { instant("time", it.time); power("power", it.power) }
            })
        }
        is RespiratoryRateRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { double("rate", record.rate) }
        is RestingHeartRateRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { long("beatsPerMinute", record.beatsPerMinute) }
        is SexualActivityRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            constant("protectionUsed", record.protectionUsed, ConstantNames.protectionUsed)
        }
        is SkinTemperatureRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("deltas", record.deltas.map {
                payload { instant("time", it.time); temperatureDelta("delta", it.delta) }
            })
            temperature("baseline", record.baseline)
            constant("measurementLocation", record.measurementLocation, ConstantNames.skinTemperatureMeasurementLocation)
        }
        is SleepSessionRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            string("title", record.title)
            string("notes", record.notes)
            objects("stages", record.stages.map {
                payload {
                    instant("startTime", it.startTime)
                    instant("endTime", it.endTime)
                    constant("stage", it.stage, ConstantNames.sleepStageType)
                }
            })
        }
        is SpeedRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("samples", record.samples.map {
                payload { instant("time", it.time); velocity("speed", it.speed) }
            })
        }
        is StepsCadenceRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) {
            objects("samples", record.samples.map {
                payload { instant("time", it.time); double("rate", it.rate) }
            })
        }
        is StepsRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { long("count", record.count) }
        is TotalCaloriesBurnedRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { energy("energy", record.energy) }
        is Vo2MaxRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) {
            double("vo2MillilitersPerMinuteKilogram", record.vo2MillilitersPerMinuteKilogram)
            constant("measurementMethod", record.measurementMethod, ConstantNames.vo2MaxMeasurementMethod)
        }
        is WeightRecord -> instantaneous(record.time, record.zoneOffset, record.metadata) { mass("weight", record.weight) }
        is WheelchairPushesRecord -> interval(record.startTime, record.startZoneOffset, record.endTime, record.endZoneOffset, record.metadata) { long("count", record.count) }
        else -> error("No serialiser for ${record.javaClass.name}")
    }

    fun metadata(metadata: Metadata): JsonObject = payload {
        string("id", metadata.id)
        string("dataOrigin", metadata.dataOrigin.packageName)
        instant("lastModifiedTime", metadata.lastModifiedTime)
        string("clientRecordId", metadata.clientRecordId)
        long("clientRecordVersion", metadata.clientRecordVersion)
        constant("recordingMethod", metadata.recordingMethod, ConstantNames.recordingMethod)
        raw("device", metadata.device?.let { device ->
            payload {
                string("manufacturer", device.manufacturer)
                string("model", device.model)
                constant("type", device.type, ConstantNames.deviceType)
            }
        })
    }

    private inline fun interval(
        startTime: Instant,
        startZoneOffset: ZoneOffset?,
        endTime: Instant,
        endZoneOffset: ZoneOffset?,
        metadata: Metadata,
        fields: Payload.() -> Unit,
    ) = payload {
        instant("startTime", startTime)
        zoneOffset("startZoneOffset", startZoneOffset)
        instant("endTime", endTime)
        zoneOffset("endZoneOffset", endZoneOffset)
        fields()
        raw("metadata", metadata(metadata))
    }

    private inline fun instantaneous(time: Instant, zoneOffset: ZoneOffset?, metadata: Metadata, fields: Payload.() -> Unit) = payload {
        instant("time", time)
        zoneOffset("zoneOffset", zoneOffset)
        fields()
        raw("metadata", metadata(metadata))
    }

    private fun segment(segment: ExerciseSegment) = payload {
        instant("startTime", segment.startTime)
        instant("endTime", segment.endTime)
        constant("segmentType", segment.segmentType, ConstantNames.exerciseSegmentType)
        int("repetitions", segment.repetitions)
    }

    private fun lap(lap: ExerciseLap) = payload {
        instant("startTime", lap.startTime)
        instant("endTime", lap.endTime)
        length("length", lap.length)
    }

    private fun routeResult(result: ExerciseRouteResult) = when (result) {
        is ExerciseRouteResult.Data -> payload {
            string("type", "Data")
            raw("exerciseRoute", route(result.exerciseRoute))
        }
        is ExerciseRouteResult.ConsentRequired -> payload {
            string("type", "ConsentRequired")
            raw("exerciseRoute", null)
        }
        is ExerciseRouteResult.NoData -> payload {
            string("type", "NoData")
            raw("exerciseRoute", null)
        }
        else -> payload {
            string("type", result.javaClass.simpleName)
            raw("exerciseRoute", null)
        }
    }

    private fun route(route: ExerciseRoute) = payload {
        objects("route", route.route.map {
            payload {
                instant("time", it.time)
                double("latitude", it.latitude)
                double("longitude", it.longitude)
                length("horizontalAccuracy", it.horizontalAccuracy)
                length("verticalAccuracy", it.verticalAccuracy)
                length("altitude", it.altitude)
            }
        })
    }

    private fun block(block: PlannedExerciseBlock) = payload {
        int("repetitions", block.repetitions)
        objects("steps", block.steps.map(::step))
        string("description", block.description)
    }

    private fun step(step: PlannedExerciseStep) = payload {
        constant("exerciseType", step.exerciseType, ConstantNames.exerciseSegmentType)
        constant("exercisePhase", step.exercisePhase, ConstantNames.exercisePhase)
        raw("completionGoal", completionGoal(step.completionGoal))
        objects("performanceTargets", step.performanceTargets.map(::performanceTarget))
        string("description", step.description)
    }

    private fun completionGoal(goal: ExerciseCompletionGoal): JsonObject = when (goal) {
        is ExerciseCompletionGoal.DistanceGoal -> typed("DistanceGoal") { length("distance", goal.distance) }
        is ExerciseCompletionGoal.DistanceAndDurationGoal -> typed("DistanceAndDurationGoal") {
            length("distance", goal.distance)
            duration("duration", goal.duration)
        }
        is ExerciseCompletionGoal.StepsGoal -> typed("StepsGoal") { int("steps", goal.steps) }
        is ExerciseCompletionGoal.DurationGoal -> typed("DurationGoal") { duration("duration", goal.duration) }
        is ExerciseCompletionGoal.RepetitionsGoal -> typed("RepetitionsGoal") { int("repetitions", goal.repetitions) }
        is ExerciseCompletionGoal.TotalCaloriesBurnedGoal -> typed("TotalCaloriesBurnedGoal") {
            energy("totalCalories", goal.totalCalories)
        }
        is ExerciseCompletionGoal.ActiveCaloriesBurnedGoal -> typed("ActiveCaloriesBurnedGoal") {
            energy("activeCalories", goal.activeCalories)
        }
        is ExerciseCompletionGoal.ManualCompletion -> typed("ManualCompletion") {}
        is ExerciseCompletionGoal.UnknownGoal -> typed("UnknownGoal") {}
        else -> typed(goal.javaClass.simpleName) {}
    }

    private fun performanceTarget(target: ExercisePerformanceTarget): JsonObject = when (target) {
        is ExercisePerformanceTarget.PowerTarget -> typed("PowerTarget") {
            power("minPower", target.minPower)
            power("maxPower", target.maxPower)
        }
        is ExercisePerformanceTarget.SpeedTarget -> typed("SpeedTarget") {
            velocity("minSpeed", target.minSpeed)
            velocity("maxSpeed", target.maxSpeed)
        }
        is ExercisePerformanceTarget.CadenceTarget -> typed("CadenceTarget") {
            double("minCadence", target.minCadence)
            double("maxCadence", target.maxCadence)
        }
        is ExercisePerformanceTarget.HeartRateTarget -> typed("HeartRateTarget") {
            double("minHeartRate", target.minHeartRate)
            double("maxHeartRate", target.maxHeartRate)
        }
        is ExercisePerformanceTarget.WeightTarget -> typed("WeightTarget") { mass("mass", target.mass) }
        is ExercisePerformanceTarget.RateOfPerceivedExertionTarget -> typed("RateOfPerceivedExertionTarget") {
            int("rpe", target.rpe)
        }
        is ExercisePerformanceTarget.AmrapTarget -> typed("AmrapTarget") {}
        is ExercisePerformanceTarget.UnknownTarget -> typed("UnknownTarget") {}
        else -> typed(target.javaClass.simpleName) {}
    }

    private inline fun typed(type: String, fields: Payload.() -> Unit) = payload {
        raw("type", JsonPrimitive(type))
        fields()
    }

    private fun Payload.nutrition(record: NutritionRecord) {
        mass("biotin", record.biotin)
        mass("caffeine", record.caffeine)
        mass("calcium", record.calcium)
        energy("energy", record.energy)
        energy("energyFromFat", record.energyFromFat)
        mass("chloride", record.chloride)
        mass("cholesterol", record.cholesterol)
        mass("chromium", record.chromium)
        mass("copper", record.copper)
        mass("dietaryFiber", record.dietaryFiber)
        mass("folate", record.folate)
        mass("folicAcid", record.folicAcid)
        mass("iodine", record.iodine)
        mass("iron", record.iron)
        mass("magnesium", record.magnesium)
        mass("manganese", record.manganese)
        mass("molybdenum", record.molybdenum)
        mass("monounsaturatedFat", record.monounsaturatedFat)
        mass("niacin", record.niacin)
        mass("pantothenicAcid", record.pantothenicAcid)
        mass("phosphorus", record.phosphorus)
        mass("polyunsaturatedFat", record.polyunsaturatedFat)
        mass("potassium", record.potassium)
        mass("protein", record.protein)
        mass("riboflavin", record.riboflavin)
        mass("saturatedFat", record.saturatedFat)
        mass("selenium", record.selenium)
        mass("sodium", record.sodium)
        mass("sugar", record.sugar)
        mass("thiamin", record.thiamin)
        mass("totalCarbohydrate", record.totalCarbohydrate)
        mass("totalFat", record.totalFat)
        mass("transFat", record.transFat)
        mass("unsaturatedFat", record.unsaturatedFat)
        mass("vitaminA", record.vitaminA)
        mass("vitaminB12", record.vitaminB12)
        mass("vitaminB6", record.vitaminB6)
        mass("vitaminC", record.vitaminC)
        mass("vitaminD", record.vitaminD)
        mass("vitaminE", record.vitaminE)
        mass("vitaminK", record.vitaminK)
        mass("zinc", record.zinc)
        string("name", record.name)
        constant("mealType", record.mealType, ConstantNames.mealType)
    }
}
