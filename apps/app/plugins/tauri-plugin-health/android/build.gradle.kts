plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.kobus.superduper.health"
    compileSdk = 36

    defaultConfig {
        minSdk = 26
        consumerProguardFiles("consumer-rules.pro")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    testOptions {
        unitTests.isReturnDefaultValues = true
        unitTests.all { test ->
            val fixtures = providers.gradleProperty("superduper.fixtures")
                .orElse(providers.environmentVariable("SUPERDUPER_FIXTURES"))
                .getOrElse(projectDir.resolve("../../../../../contracts/health-connect/v1").canonicalPath)
            test.systemProperty("superduper.fixtures", fixtures)
            // check.sh runs Gradle with -q, so failures are logged at the quiet level.
            test.testLogging.quiet {
                events("failed", "skipped")
                exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
            }
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_1_8
        // MindfulnessSessionRecord is marked experimental in connect-client 1.1.0.
        freeCompilerArgs.add("-opt-in=androidx.health.connect.client.feature.ExperimentalMindfulnessSessionApi")
    }
}

dependencies {
    implementation("androidx.health.connect:connect-client:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.10.5")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation(project(":tauri-android"))
    testImplementation("junit:junit:4.13.2")
}
