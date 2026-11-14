package com.kobus.superduper.health

import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BasalBodyTemperatureRecord
import androidx.health.connect.client.records.BasalMetabolicRateRecord
import androidx.health.connect.client.records.BloodGlucoseRecord
import androidx.health.connect.client.records.BloodPressureRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.BodyTemperatureMeasurementLocation
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
import androidx.health.connect.client.records.ExerciseSegment
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.IntermenstrualBleedingRecord
import androidx.health.connect.client.records.LeanBodyMassRecord
import androidx.health.connect.client.records.MealType
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
import androidx.health.connect.client.records.metadata.Device
import androidx.health.connect.client.records.metadata.Metadata
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
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset

/**
 * One synthetic record per Health Connect type, mirroring the payload fixtures in
 * contracts/health-connect/v1. Values are invented.
 */
internal object SyntheticRecords {
    private val offset: ZoneOffset = ZoneOffset.ofHours(2)
    private val modified: Instant = Instant.parse("2026-11-10T09:00:00Z")
    private val watch = Device(type = Device.TYPE_WATCH, manufacturer = "Example", model = "Watch 1")
    private val phone = Device(type = Device.TYPE_PHONE, manufacturer = "Example", model = "Phone 1")
    private val scale = Device(type = Device.TYPE_SCALE, manufacturer = "Example", model = "Scale 1")

    private fun t(value: String): Instant = Instant.parse(value)

    private fun meta(
        n: Int,
        origin: String,
        method: Int,
        device: Device? = null,
        clientRecordId: String? = null,
        clientRecordVersion: Long = 0,
    ) = TestMetadata.create(
        method,
        "00000000-0000-4000-8000-%012d".format(n),
        origin,
        modified,
        clientRecordId,
        clientRecordVersion,
        device,
    )

    private const val FITNESS = "com.example.fitness"
    private const val CYCLE = "com.example.cycle"
    private const val SCALE = "com.example.scale"
    private const val DIARY = "com.example.diary"
    private const val ACTIVE = Metadata.RECORDING_METHOD_ACTIVELY_RECORDED
    private const val AUTO = Metadata.RECORDING_METHOD_AUTOMATICALLY_RECORDED
    private const val MANUAL = Metadata.RECORDING_METHOD_MANUAL_ENTRY

    val all: List<Record> = listOf(
        ActiveCaloriesBurnedRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            energy = Energy.kilocalories(212.5),
            metadata = meta(1, FITNESS, AUTO, watch),
        ),
        BasalBodyTemperatureRecord(
            time = t("2026-11-10T04:30:00Z"), zoneOffset = offset,
            temperature = Temperature.celsius(36.42),
            measurementLocation = BodyTemperatureMeasurementLocation.MEASUREMENT_LOCATION_MOUTH,
            metadata = meta(2, CYCLE, MANUAL),
        ),
        BasalMetabolicRateRecord(
            time = t("2026-11-10T00:00:00Z"), zoneOffset = offset,
            basalMetabolicRate = Power.watts(80.5),
            metadata = meta(3, SCALE, AUTO, scale),
        ),
        BloodGlucoseRecord(
            time = t("2026-11-10T07:15:00Z"), zoneOffset = offset,
            level = BloodGlucose.millimolesPerLiter(5.4),
            specimenSource = BloodGlucoseRecord.SPECIMEN_SOURCE_CAPILLARY_BLOOD,
            mealType = MealType.MEAL_TYPE_BREAKFAST,
            relationToMeal = BloodGlucoseRecord.RELATION_TO_MEAL_BEFORE_MEAL,
            metadata = meta(4, DIARY, MANUAL),
        ),
        BloodPressureRecord(
            time = t("2026-11-10T07:20:00Z"), zoneOffset = offset,
            systolic = Pressure.millimetersOfMercury(118.0),
            diastolic = Pressure.millimetersOfMercury(76.0),
            bodyPosition = BloodPressureRecord.BODY_POSITION_SITTING_DOWN,
            measurementLocation = BloodPressureRecord.MEASUREMENT_LOCATION_LEFT_UPPER_ARM,
            metadata = meta(5, DIARY, MANUAL),
        ),
        BodyFatRecord(
            time = t("2026-11-10T06:45:00Z"), zoneOffset = offset,
            percentage = Percentage(18.3),
            metadata = meta(6, SCALE, AUTO, scale),
        ),
        BodyTemperatureRecord(
            time = t("2026-11-10T08:00:00Z"), zoneOffset = offset,
            temperature = Temperature.celsius(36.8),
            measurementLocation = BodyTemperatureMeasurementLocation.MEASUREMENT_LOCATION_ARMPIT,
            metadata = meta(7, DIARY, MANUAL),
        ),
        BodyWaterMassRecord(
            time = t("2026-11-10T06:45:00Z"), zoneOffset = offset,
            mass = Mass.kilograms(42.1),
            metadata = meta(8, SCALE, AUTO, scale),
        ),
        BoneMassRecord(
            time = t("2026-11-10T06:45:00Z"), zoneOffset = offset,
            mass = Mass.kilograms(3.2),
            metadata = meta(9, SCALE, AUTO, scale),
        ),
        CervicalMucusRecord(
            time = t("2026-11-10T08:00:00Z"), zoneOffset = offset,
            appearance = CervicalMucusRecord.APPEARANCE_EGG_WHITE,
            sensation = CervicalMucusRecord.SENSATION_MEDIUM,
            metadata = meta(10, CYCLE, MANUAL),
        ),
        CyclingPedalingCadenceRecord(
            startTime = t("2026-11-10T16:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T16:01:00Z"), endZoneOffset = offset,
            samples = listOf(
                CyclingPedalingCadenceRecord.Sample(t("2026-11-10T16:00:00Z"), 82.0),
                CyclingPedalingCadenceRecord.Sample(t("2026-11-10T16:00:30Z"), 88.5),
            ),
            metadata = meta(11, FITNESS, ACTIVE, watch),
        ),
        DistanceRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            distance = Length.meters(4210.0),
            metadata = meta(12, FITNESS, AUTO, phone),
        ),
        ElevationGainedRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            elevation = Length.meters(36.5),
            metadata = meta(13, FITNESS, AUTO, watch),
        ),
        ExerciseSessionRecord(
            startTime = t("2026-11-10T05:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T06:10:00Z"), endZoneOffset = offset,
            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            title = "Morning run",
            notes = "Synthetic example",
            segments = listOf(
                ExerciseSegment(t("2026-11-10T05:30:00Z"), t("2026-11-10T06:05:00Z"), ExerciseSegment.EXERCISE_SEGMENT_TYPE_RUNNING),
                ExerciseSegment(t("2026-11-10T06:05:00Z"), t("2026-11-10T06:10:00Z"), ExerciseSegment.EXERCISE_SEGMENT_TYPE_WALKING),
            ),
            laps = listOf(
                ExerciseLap(t("2026-11-10T05:30:00Z"), t("2026-11-10T05:36:00Z"), Length.meters(1000.0)),
                ExerciseLap(t("2026-11-10T05:36:00Z"), t("2026-11-10T05:42:10Z"), Length.meters(1000.0)),
            ),
            exerciseRoute = ExerciseRoute(
                listOf(
                    ExerciseRoute.Location(
                        time = t("2026-11-10T05:30:00Z"), latitude = -33.9249, longitude = 18.4241,
                        horizontalAccuracy = Length.meters(4.0), verticalAccuracy = Length.meters(6.0),
                        altitude = Length.meters(12.0),
                    ),
                    ExerciseRoute.Location(
                        time = t("2026-11-10T05:30:10Z"), latitude = -33.9251, longitude = 18.4244,
                        horizontalAccuracy = Length.meters(3.5),
                    ),
                ),
            ),
            plannedExerciseSessionId = null,
            metadata = meta(14, FITNESS, ACTIVE, watch),
        ),
        FloorsClimbedRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            floors = 3.0,
            metadata = meta(15, FITNESS, AUTO, phone),
        ),
        HeartRateRecord(
            startTime = t("2026-11-10T05:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T05:31:00Z"), endZoneOffset = offset,
            samples = listOf(
                HeartRateRecord.Sample(t("2026-11-10T05:30:00Z"), 92),
                HeartRateRecord.Sample(t("2026-11-10T05:30:30Z"), 118),
                HeartRateRecord.Sample(t("2026-11-10T05:31:00Z"), 131),
            ),
            metadata = meta(16, FITNESS, ACTIVE, watch),
        ),
        HeartRateVariabilityRmssdRecord(
            time = t("2026-11-10T03:00:00Z"), zoneOffset = offset,
            heartRateVariabilityMillis = 48.2,
            metadata = meta(17, FITNESS, AUTO, watch),
        ),
        HeightRecord(
            time = t("2026-11-01T08:00:00Z"), zoneOffset = offset,
            height = Length.meters(1.82),
            metadata = meta(18, DIARY, MANUAL),
        ),
        HydrationRecord(
            startTime = t("2026-11-10T10:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T10:05:00Z"), endZoneOffset = offset,
            volume = Volume.liters(0.33),
            metadata = meta(19, DIARY, MANUAL, clientRecordId = "hydration-2026-11-10-1", clientRecordVersion = 3),
        ),
        IntermenstrualBleedingRecord(
            time = t("2026-11-10T08:00:00Z"), zoneOffset = offset,
            metadata = meta(20, CYCLE, MANUAL),
        ),
        LeanBodyMassRecord(
            time = t("2026-11-10T06:45:00Z"), zoneOffset = offset,
            mass = Mass.kilograms(64.4),
            metadata = meta(21, SCALE, AUTO, scale),
        ),
        MenstruationFlowRecord(
            time = t("2026-11-10T08:00:00Z"), zoneOffset = offset,
            flow = MenstruationFlowRecord.FLOW_MEDIUM,
            metadata = meta(22, CYCLE, MANUAL),
        ),
        MenstruationPeriodRecord(
            startTime = t("2026-11-08T00:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-12T00:00:00Z"), endZoneOffset = offset,
            metadata = meta(23, CYCLE, MANUAL),
        ),
        MindfulnessSessionRecord(
            startTime = t("2026-11-10T20:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T20:10:00Z"), endZoneOffset = offset,
            mindfulnessSessionType = MindfulnessSessionRecord.MINDFULNESS_SESSION_TYPE_MEDITATION,
            title = "Evening meditation",
            notes = null,
            metadata = meta(24, DIARY, ACTIVE, phone),
        ),
        NutritionRecord(
            startTime = t("2026-11-10T06:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T06:45:00Z"), endZoneOffset = offset,
            caffeine = Mass.kilograms(9e-05),
            calcium = Mass.kilograms(0.00025),
            cholesterol = Mass.kilograms(0.000185),
            dietaryFiber = Mass.kilograms(0.004),
            iron = Mass.kilograms(2.1e-06),
            monounsaturatedFat = Mass.kilograms(0.0045),
            polyunsaturatedFat = Mass.kilograms(0.0018),
            potassium = Mass.kilograms(0.00042),
            protein = Mass.kilograms(0.0182),
            saturatedFat = Mass.kilograms(0.0036),
            sodium = Mass.kilograms(0.00051),
            sugar = Mass.kilograms(0.0062),
            totalCarbohydrate = Mass.kilograms(0.0415),
            totalFat = Mass.kilograms(0.0121),
            transFat = Mass.kilograms(0.0),
            vitaminC = Mass.kilograms(1.2e-05),
            vitaminD = Mass.kilograms(2.5e-09),
            energy = Energy.kilocalories(356.0),
            energyFromFat = Energy.kilocalories(108.9),
            name = "Oats with yoghurt",
            mealType = MealType.MEAL_TYPE_BREAKFAST,
            metadata = meta(25, DIARY, MANUAL),
        ),
        OvulationTestRecord(
            time = t("2026-11-10T08:00:00Z"), zoneOffset = offset,
            result = OvulationTestRecord.RESULT_NEGATIVE,
            metadata = meta(26, CYCLE, MANUAL),
        ),
        OxygenSaturationRecord(
            time = t("2026-11-10T03:10:00Z"), zoneOffset = offset,
            percentage = Percentage(97.0),
            metadata = meta(27, FITNESS, AUTO, watch),
        ),
        PlannedExerciseSessionRecord(
            startTime = t("2026-11-11T05:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-11T06:15:00Z"), endZoneOffset = offset,
            exerciseType = ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
            blocks = listOf(
                PlannedExerciseBlock(
                    repetitions = 1,
                    description = "Warm-up",
                    steps = listOf(
                        PlannedExerciseStep(
                            exerciseType = ExerciseSegment.EXERCISE_SEGMENT_TYPE_WALKING,
                            exercisePhase = PlannedExerciseStep.EXERCISE_PHASE_WARMUP,
                            completionGoal = ExerciseCompletionGoal.DurationGoal(Duration.ofMinutes(10)),
                            performanceTargets = listOf(ExercisePerformanceTarget.HeartRateTarget(90.0, 120.0)),
                            description = "Brisk walk",
                        ),
                    ),
                ),
                PlannedExerciseBlock(
                    repetitions = 4,
                    description = "Intervals",
                    steps = listOf(
                        PlannedExerciseStep(
                            exerciseType = ExerciseSegment.EXERCISE_SEGMENT_TYPE_RUNNING,
                            exercisePhase = PlannedExerciseStep.EXERCISE_PHASE_ACTIVE,
                            completionGoal = ExerciseCompletionGoal.DistanceGoal(Length.meters(800.0)),
                            performanceTargets = listOf(
                                ExercisePerformanceTarget.SpeedTarget(Velocity.metersPerSecond(3.8), Velocity.metersPerSecond(4.2)),
                                ExercisePerformanceTarget.RateOfPerceivedExertionTarget(7),
                            ),
                            description = "Fast 800 m",
                        ),
                        PlannedExerciseStep(
                            exerciseType = ExerciseSegment.EXERCISE_SEGMENT_TYPE_REST,
                            exercisePhase = PlannedExerciseStep.EXERCISE_PHASE_REST,
                            completionGoal = ExerciseCompletionGoal.ManualCompletion,
                            performanceTargets = emptyList(),
                            description = null,
                        ),
                    ),
                ),
            ),
            title = "Interval session",
            notes = null,
            metadata = meta(28, FITNESS, MANUAL),
        ),
        PowerRecord(
            startTime = t("2026-11-10T16:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T16:01:00Z"), endZoneOffset = offset,
            samples = listOf(
                PowerRecord.Sample(t("2026-11-10T16:00:00Z"), Power.watts(185.0)),
                PowerRecord.Sample(t("2026-11-10T16:00:30Z"), Power.watts(240.5)),
            ),
            metadata = meta(29, FITNESS, ACTIVE, watch),
        ),
        RespiratoryRateRecord(
            time = t("2026-11-10T03:00:00Z"), zoneOffset = offset,
            rate = 14.5,
            metadata = meta(30, FITNESS, AUTO, watch),
        ),
        RestingHeartRateRecord(
            time = t("2026-11-10T04:00:00Z"), zoneOffset = offset,
            beatsPerMinute = 54,
            metadata = meta(31, FITNESS, AUTO, watch),
        ),
        SexualActivityRecord(
            time = t("2026-11-09T21:00:00Z"), zoneOffset = offset,
            protectionUsed = SexualActivityRecord.PROTECTION_USED_UNKNOWN,
            metadata = meta(32, CYCLE, MANUAL),
        ),
        SkinTemperatureRecord(
            startTime = t("2026-11-09T22:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T05:00:00Z"), endZoneOffset = offset,
            deltas = listOf(
                SkinTemperatureRecord.Delta(t("2026-11-09T23:00:00Z"), TemperatureDelta.celsius(-0.2)),
                SkinTemperatureRecord.Delta(t("2026-11-10T02:00:00Z"), TemperatureDelta.celsius(0.35)),
            ),
            baseline = Temperature.celsius(33.9),
            measurementLocation = SkinTemperatureRecord.MEASUREMENT_LOCATION_WRIST,
            metadata = meta(33, FITNESS, AUTO, watch),
        ),
        SleepSessionRecord(
            startTime = t("2026-11-09T21:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T04:45:00Z"), endZoneOffset = offset,
            stages = listOf(
                SleepSessionRecord.Stage(t("2026-11-09T21:30:00Z"), t("2026-11-09T21:45:00Z"), SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED),
                SleepSessionRecord.Stage(t("2026-11-09T21:45:00Z"), t("2026-11-09T23:15:00Z"), SleepSessionRecord.STAGE_TYPE_LIGHT),
                SleepSessionRecord.Stage(t("2026-11-09T23:15:00Z"), t("2026-11-10T00:30:00Z"), SleepSessionRecord.STAGE_TYPE_DEEP),
                SleepSessionRecord.Stage(t("2026-11-10T00:30:00Z"), t("2026-11-10T01:30:00Z"), SleepSessionRecord.STAGE_TYPE_REM),
                SleepSessionRecord.Stage(t("2026-11-10T01:30:00Z"), t("2026-11-10T01:35:00Z"), SleepSessionRecord.STAGE_TYPE_AWAKE),
                SleepSessionRecord.Stage(t("2026-11-10T01:35:00Z"), t("2026-11-10T04:45:00Z"), SleepSessionRecord.STAGE_TYPE_LIGHT),
            ),
            metadata = meta(34, FITNESS, AUTO, watch),
        ),
        SpeedRecord(
            startTime = t("2026-11-10T05:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T05:31:00Z"), endZoneOffset = offset,
            samples = listOf(
                SpeedRecord.Sample(t("2026-11-10T05:30:00Z"), Velocity.metersPerSecond(2.9)),
                SpeedRecord.Sample(t("2026-11-10T05:30:30Z"), Velocity.metersPerSecond(3.1)),
            ),
            metadata = meta(35, FITNESS, ACTIVE, watch),
        ),
        StepsCadenceRecord(
            startTime = t("2026-11-10T05:30:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T05:31:00Z"), endZoneOffset = offset,
            samples = listOf(
                StepsCadenceRecord.Sample(t("2026-11-10T05:30:00Z"), 162.0),
                StepsCadenceRecord.Sample(t("2026-11-10T05:30:30Z"), 168.0),
            ),
            metadata = meta(36, FITNESS, ACTIVE, watch),
        ),
        StepsRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            count = 5321,
            metadata = meta(37, FITNESS, AUTO, phone),
        ),
        TotalCaloriesBurnedRecord(
            startTime = t("2026-11-10T06:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T07:00:00Z"), endZoneOffset = offset,
            energy = Energy.kilocalories(298.0),
            metadata = meta(38, FITNESS, AUTO, watch),
        ),
        Vo2MaxRecord(
            time = t("2026-11-10T06:10:00Z"), zoneOffset = offset,
            vo2MillilitersPerMinuteKilogram = 47.5,
            measurementMethod = Vo2MaxRecord.MEASUREMENT_METHOD_HEART_RATE_RATIO,
            metadata = meta(39, FITNESS, AUTO, watch),
        ),
        WeightRecord(
            time = t("2026-11-10T06:45:00Z"), zoneOffset = offset,
            weight = Mass.kilograms(78.4),
            metadata = meta(40, SCALE, AUTO, scale),
        ),
        WheelchairPushesRecord(
            startTime = t("2026-11-10T09:00:00Z"), startZoneOffset = offset,
            endTime = t("2026-11-10T10:00:00Z"), endZoneOffset = offset,
            count = 412,
            metadata = meta(41, FITNESS, AUTO, watch),
        ),
    )
}
