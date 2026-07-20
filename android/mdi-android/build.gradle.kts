plugins {
    id("com.android.library")
    id("jacoco")
    id("maven-publish")
    kotlin("android")
    kotlin("plugin.serialization")
}

group = "app.illusions"
version = providers.gradleProperty("VERSION_NAME").getOrElse("0.0.0-SNAPSHOT")

android {
    namespace = "app.illusions.mdi"
    compileSdk = 36

    defaultConfig {
        minSdk = 23
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        ndk {
            abiFilters += setOf("arm64-v8a", "x86_64")
        }
    }

    testOptions {
        unitTests.isIncludeAndroidResources = true
    }

    buildTypes {
        debug {
            enableUnitTestCoverage = true
        }
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

val buildNativeLibraries = tasks.register<Exec>("buildNativeLibraries") {
    workingDir = rootProject.projectDir
    commandLine("./scripts/build-native.sh")
}

tasks.named("preBuild").configure {
    dependsOn(buildNativeLibraries)
}

kotlin {
    jvmToolchain(17)
}

dependencies {
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlin:kotlin-test:2.1.20")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}

jacoco {
    toolVersion = "0.8.12"
}

val coverageExclusions = listOf(
    "**/R.class",
    "**/R$*.class",
    "**/BuildConfig.*",
    "**/MdiNative.*",
    "**/NativeMdiBridge.*",
)

val debugKotlinClasses = layout.buildDirectory.dir("tmp/kotlin-classes/debug")
val debugJavaClasses = layout.buildDirectory.dir("intermediates/javac/debug/compileDebugJavaWithJavac/classes")
val debugUnitTestExecution = layout.buildDirectory.file(
    "outputs/unit_test_code_coverage/debugUnitTest/testDebugUnitTest.exec",
)

tasks.register<JacocoReport>("jacocoDebugUnitTestReport") {
    dependsOn("testDebugUnitTest")
    executionData(debugUnitTestExecution)
    classDirectories.setFrom(
        files(debugKotlinClasses, debugJavaClasses).asFileTree.matching { exclude(coverageExclusions) },
    )
    sourceDirectories.setFrom(files("src/main/kotlin", "src/main/java"))
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}

tasks.register<JacocoCoverageVerification>("verifyDebugUnitTestCoverage") {
    dependsOn("jacocoDebugUnitTestReport")
    executionData(debugUnitTestExecution)
    classDirectories.setFrom(
        files(debugKotlinClasses, debugJavaClasses).asFileTree.matching { exclude(coverageExclusions) },
    )
    sourceDirectories.setFrom(files("src/main/kotlin", "src/main/java"))
    violationRules {
        rule {
            limit {
                counter = "LINE"
                value = "COVEREDRATIO"
                minimum = "0.90".toBigDecimal()
            }
        }
    }
}

tasks.named("check").configure {
    dependsOn("verifyDebugUnitTestCoverage")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = project.group.toString()
            artifactId = "mdi-android"
            version = project.version.toString()
            afterEvaluate {
                from(components["release"])
            }
            pom {
                name.set("MDI Android")
                description.set("Kotlin/JNI bindings for illusion Markdown (MDI)")
                url.set("https://github.com/illusions-lab/MDI")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://opensource.org/license/mit")
                    }
                }
                scm {
                    connection.set("scm:git:https://github.com/illusions-lab/MDI.git")
                    developerConnection.set("scm:git:ssh://git@github.com/illusions-lab/MDI.git")
                    url.set("https://github.com/illusions-lab/MDI")
                }
            }
        }
    }
    repositories {
        maven {
            name = "GitHubPackages"
            url = uri("https://maven.pkg.github.com/illusions-lab/MDI")
            credentials {
                username = System.getenv("GITHUB_ACTOR")
                password = System.getenv("GITHUB_TOKEN")
            }
        }
    }
}
