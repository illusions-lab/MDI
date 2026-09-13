plugins {
    id("com.android.library") version "8.10.1"
    kotlin("android") version "2.1.20"
}
android {
    namespace = "app.illusions.registry"
    compileSdk = 36
    defaultConfig {
        minSdk = 26
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("app.illusions:mdi-android:${providers.gradleProperty("registryVersion").get()}")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    androidTestImplementation("androidx.test:runner:1.6.2")
}
