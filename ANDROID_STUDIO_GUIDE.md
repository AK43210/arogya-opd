# Android Studio guide — Arogya 0.2.0

Clone this repository and open its root folder in Android Studio.

Select JDK 17 under Settings > Build, Execution, Deployment > Build Tools > Gradle > Gradle JDK. Choose an installed JDK 17 or download one using Android Studio. The bundled Android Studio JDK 25 is unsuitable for this project's Gradle 8.2.

Sync the project and build a debug APK. Output: app/build/outputs/apk/debug/app-debug.apk.

PowerShell:

```powershell
$env:JAVA_HOME='C:\path\to\jdk-17'
.\gradlew.bat assembleDebug --console=plain
```

The wrapper uses the official direct Gradle host, a 120-second timeout and the official distribution SHA-256 checksum.

## First use

1. Open the settings icon and enter your clinic, doctor details and registration number. There are no fictional defaults.
2. Enter a patient and consultation. Search matches require explicit selection so a shared mobile number does not silently select a family member.
3. Add and review medicines; templates start empty and can be created by the clinician.
4. Open Prescription. Download PDF prepares a PDF and opens Android's Save dialog. Select a folder and Save. Print opens the native print interface; available printers depend on installed print services.
5. Export a backup from History regularly. Files saved through the picker do not need broad storage permissions.

Do not uninstall or clear storage to update: installing a compatible APK over the existing app preserves records. Export a backup before device testing where possible. 

## Verification — 8 November 2026

The source includes browser checks for mobile layout, generated PDF downloads and patient record integrity. Android emulator PDF saving has been exercised and the saved one-page PDF rendered and visually inspected. Physical-phone acceptance and physical printing remain pending. Local verification artifacts are intentionally excluded from the repository.
