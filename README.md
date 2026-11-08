# Arogya

OPD consultation and prescription tool.

## Current build: 0.2.0

- Consultation notes, medicine search and clinician-created templates.
- Mobile-friendly prescription preview and A4 output.
- Android PDF export through the system file picker; native print service integration.
- Local patient records with independent IDs, allowing shared family mobile numbers.
- JSON backup/restore and CSV export. Backups include the medicine catalogue and custom templates.
- Bundled CSS, icons and PDF library; no CDN requests are needed for these workflows.

No sample patients or sample prescription buttons are included. Built-in treatment packages have been removed. Configure your clinic, doctor details and registration number before exporting a prescription. An empty allergy or vitals field is shown as unrecorded, not normal.

## Run the web app locally

The static web app is in `app/src/main/assets`. Serve it from an HTTP server, for example:

```powershell
python -m http.server 8080 --directory app/src/main/assets
```

Open http://localhost:8080. For a hosted installable web app, use HTTPS. Deployment has not been performed.

## Android

See ANDROID_STUDIO_GUIDE.md. The application ID remains `in.arogyahealth.ehr`, updates require an APK signed with the same signing key as the installed version.

## Storage and recovery

Records remain in this browser or Android WebView's local storage; no patient-record server or cloud sync is implemented. Anyone with access to the unlocked app/browser profile can access these records. Clearing app/browser storage or uninstalling can erase records. Export backups regularly and protect them: JSON and CSV exports are unencrypted.

Legacy mobile-keyed records are migrated to patient IDs. A local pre-migration snapshot is retained in `arogya_before_patient_ids`. Only matching, unchanged prototype demo records and the original fictional clinic profile are removed automatically. Edited patient records are retained. Old backups can be imported after validation; matching IDs require confirmation before replacement.

## Development checks

`scripts/check-ui.cjs` uses Playwright and a local Edge installation. It checks mobile overflow on all four tabs, shared-number patient identity, failed-save rollback, invalid backup rejection, and actual browser PDF download. It writes fictional test artifacts to ignored `verification/`.

`scripts/check-android.cjs` attaches to an emulator WebView through an ADB-forwarded debug socket. It uses fictional fields to exercise Android PDF saving or printing; no test patients are seeded in the app.

This is a prototype. Device acceptance, clinical content review and broader security/accessibility testing remain open. No ABDM integration or comprehensive interaction/allergy checking is implemented.

## License

Arogya project code is available under the MIT License. Bundled dependencies retain their own licenses; see THIRD_PARTY_NOTICES.md and third_party/.
