# EntryCore — Local MVP

EntryCore is a working **single-browser MVP** built from the supplied EntryCore/GateLog interface. It keeps the existing visual direction while adding functional local workflows.

## Implemented in this build
- Organisation name, tagline, logo, accent colour, light/dark theme, density, and gate name settings.
- Local browser persistence for settings, people, visitor sessions, and gate events.
- People register with unique identifiers, arbitrary custom fields, CSV import/export.
- Separate visitor registration with host, purpose, contact details, check-in and check-out.
- Gate console with IN/OUT mode, Dynamsoft Barcode Reader JavaScript SDK v11 camera integration, and manual-ID fallback.
- Gate activity history and CSV export; report downloads for people, visitors and events.
- JSON backup download and local-record clearing.
- Search across the active module.

## Run on Windows
1. Install a current Node.js LTS release.
2. Open PowerShell in the extracted project directory.
3. Run:
   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```
4. Open the local URL Vite prints. Use a current Chrome or Edge browser and allow camera access when prompted.

## Dynamsoft
The scanner loads `dynamsoft-barcode-reader-bundle` v11 from jsDelivr when the scanner is started. The app uses Dynamsoft's documented public 24-hour test license if you have not entered your own. For extended evaluation, configure your own trial license in Workspace settings. Production use requires a valid commercial license and appropriate deployment configuration.

## Important limits — this is not production-ready
This is a local MVP, **not the complete multi-gate production application**:
- Data is stored in the current browser's `localStorage`. It is not shared between computers, is not a secure database, and can be cleared by the browser.
- There is no real authentication, role/permission enforcement, organization isolation, server-side audit protection, or server backup.
- It has not been security-tested or validated for operational use.
- The demo license and browser-loaded SDK require internet access.

Before real deployment, build and deploy a secured API/backend with a database, server-side authorization, password hashing, audit trails, backup/restore, organization isolation, HTTPS, and managed Dynamsoft licensing. Do not store sensitive real-world records in this MVP.

## CSV import
The first row must include an identifier column (`ID`, `Identifier`, `Admission Number`, `Student ID`, `Employee ID`, `QR`, or `Code`) and a name column (`Name`, `Full Name`, or `Person Name`). Other columns become custom fields. Save Excel sheets as CSV UTF-8 before importing.
