plugins { id("com.android.application") }

android {
  namespace = "com.stepagent.apps.morskoyboy"
  compileSdk = 36
  defaultConfig {
    applicationId = "com.stepagent.apps.morskoyboy"
    minSdk = 24
    targetSdk = 36
    versionCode = 1
    versionName = "1.0"
  }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  // Web files are copied from the project root by the workflow (see .github/workflows/build-apk.yml).
  sourceSets["main"].assets.srcDirs("src/main/assets")
}

dependencies {
  implementation("androidx.webkit:webkit:1.14.0")
}
