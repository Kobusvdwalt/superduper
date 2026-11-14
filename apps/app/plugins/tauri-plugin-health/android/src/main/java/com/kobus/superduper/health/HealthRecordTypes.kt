package com.kobus.superduper.health

import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.*
import kotlin.reflect.KClass

/**
 * Every record type in connect-client 1.1.0. `name` is spelled out rather than taken from the
 * class because release builds may rename classes.
 */
internal class HealthRecordType(
    val name: String,
    val recordClass: KClass<out Record>,
    val feature: Int? = null,
) {
    val readPermission: String get() = HealthPermission.getReadPermission(recordClass)
}

internal object HealthRecordTypes {
    const val EXERCISE_ROUTES_PERMISSION = "android.permission.health.READ_EXERCISE_ROUTES"

    val all: List<HealthRecordType> = listOf(
        HealthRecordType("ActiveCaloriesBurnedRecord", ActiveCaloriesBurnedRecord::class),
        HealthRecordType("BasalBodyTemperatureRecord", BasalBodyTemperatureRecord::class),
        HealthRecordType("BasalMetabolicRateRecord", BasalMetabolicRateRecord::class),
        HealthRecordType("BloodGlucoseRecord", BloodGlucoseRecord::class),
        HealthRecordType("BloodPressureRecord", BloodPressureRecord::class),
        HealthRecordType("BodyFatRecord", BodyFatRecord::class),
        HealthRecordType("BodyTemperatureRecord", BodyTemperatureRecord::class),
        HealthRecordType("BodyWaterMassRecord", BodyWaterMassRecord::class),
        HealthRecordType("BoneMassRecord", BoneMassRecord::class),
        HealthRecordType("CervicalMucusRecord", CervicalMucusRecord::class),
        HealthRecordType("CyclingPedalingCadenceRecord", CyclingPedalingCadenceRecord::class),
        HealthRecordType("DistanceRecord", DistanceRecord::class),
        HealthRecordType("ElevationGainedRecord", ElevationGainedRecord::class),
        HealthRecordType("ExerciseSessionRecord", ExerciseSessionRecord::class),
        HealthRecordType("FloorsClimbedRecord", FloorsClimbedRecord::class),
        HealthRecordType("HeartRateRecord", HeartRateRecord::class),
        HealthRecordType("HeartRateVariabilityRmssdRecord", HeartRateVariabilityRmssdRecord::class),
        HealthRecordType("HeightRecord", HeightRecord::class),
        HealthRecordType("HydrationRecord", HydrationRecord::class),
        HealthRecordType("IntermenstrualBleedingRecord", IntermenstrualBleedingRecord::class),
        HealthRecordType("LeanBodyMassRecord", LeanBodyMassRecord::class),
        HealthRecordType("MenstruationFlowRecord", MenstruationFlowRecord::class),
        HealthRecordType("MenstruationPeriodRecord", MenstruationPeriodRecord::class),
        HealthRecordType(
            "MindfulnessSessionRecord",
            MindfulnessSessionRecord::class,
            HealthConnectFeatures.FEATURE_MINDFULNESS_SESSION,
        ),
        HealthRecordType("NutritionRecord", NutritionRecord::class),
        HealthRecordType("OvulationTestRecord", OvulationTestRecord::class),
        HealthRecordType("OxygenSaturationRecord", OxygenSaturationRecord::class),
        HealthRecordType(
            "PlannedExerciseSessionRecord",
            PlannedExerciseSessionRecord::class,
            HealthConnectFeatures.FEATURE_PLANNED_EXERCISE,
        ),
        HealthRecordType("PowerRecord", PowerRecord::class),
        HealthRecordType("RespiratoryRateRecord", RespiratoryRateRecord::class),
        HealthRecordType("RestingHeartRateRecord", RestingHeartRateRecord::class),
        HealthRecordType("SexualActivityRecord", SexualActivityRecord::class),
        HealthRecordType(
            "SkinTemperatureRecord",
            SkinTemperatureRecord::class,
            HealthConnectFeatures.FEATURE_SKIN_TEMPERATURE,
        ),
        HealthRecordType("SleepSessionRecord", SleepSessionRecord::class),
        HealthRecordType("SpeedRecord", SpeedRecord::class),
        HealthRecordType("StepsCadenceRecord", StepsCadenceRecord::class),
        HealthRecordType("StepsRecord", StepsRecord::class),
        HealthRecordType("TotalCaloriesBurnedRecord", TotalCaloriesBurnedRecord::class),
        HealthRecordType("Vo2MaxRecord", Vo2MaxRecord::class),
        HealthRecordType("WeightRecord", WeightRecord::class),
        HealthRecordType("WheelchairPushesRecord", WheelchairPushesRecord::class),
    )

    private val byClass = all.associateBy { it.recordClass }
    private val byName = all.associateBy { it.name }

    fun of(record: Record): HealthRecordType =
        byClass[record::class] ?: error("Unregistered record class ${record.javaClass.name}")

    fun named(name: String): HealthRecordType? = byName[name]
}
