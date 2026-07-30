# Release Notes: v1.2.0 (Auto-Updater, Multilingual Telemetry & Single-File Deployment)

**Release Date:** July 28, 2026  
**Application:** Amazon Future Engineers (AFE) Learning App / RMS Offline Learning App  
**Version:** `1.2.0`  
**Target OS:** Windows (x64 NSIS Installer)  
**Repository:** [navgurukul/AFE-Learning-App](https://github.com/navgurukul/AFE-Learning-App)  

---

## 🚀 Key Highlights & Major Features

### 1. 🔄 Automatic Updates (`electron-updater`)
- **Seamless Auto-Updates:** Integrated `electron-updater` to automatically check for, download, and apply updates from GitHub Releases in the background.
- **Single-File Installer Deployment:** Streamlined build configuration in `electron-builder.config.cjs` (`-p always`) to produce a single self-contained installer (`Amazon Future Engineer-Setup-1.2.0.exe`).
- **Reliable Release Publishing:** Automated publishing pipeline via GitHub token authentication (`GH_TOKEN`), ensuring smooth release deployment to all student devices across partner hubs.

### 2. 🌐 Multi-Language Preference & Extended 5-Question Survey
- **Persistent Language Preferences:** Saved student language choices (English, Hindi, Marathi, Gujarati, Kannada, Tamil, Telugu) directly to SQLite DB (`students.preferredLanguage`).
- **7-Language Feedback Modal:** Extended the logout survey into a comprehensive 5-question feedback modal fully translated across 7 regional languages with a modern Neo-Brutalism theme:
  1. **CSAT:** Overall learning experience and satisfaction rating (1–5 scale).
  2. **ITP (Interest to Participate):** Student interest in pursuing tech/CS learning.
  3. **Comprehension & Clarity:** Clarity of lesson content and explanations.
  4. **Device Accessibility:** App smoothness on shared laptops.
  5. **Learning Preference:** Preference for self-paced vs. guided learning modules.
- **IPC Whitelist Safeguards:** Updated renderer-to-main IPC contracts to securely pass student language preferences and survey responses to backend storage.

### 3. 📍 Geolocation Telemetry & Enhanced Metrics Collection
- **Automated IP Geolocation:** Automatically fetches location metadata (city, region, country, latitude/longitude) upon internet connectivity to tag session logs accurately.
- **Enhanced Telemetry Schema:** Drizzle SQLite migrations (`0009_many_cerebro` & `0010_happy_silverclaw`) added support for location tracking, hardware fingerprints, network state reporting, and NGO key validation payloads.

### 4. 🎨 UI/UX Revamp & Media Restriction Safeguards
- **Modernized Neo-Brutalism UI:** Redesigned interface elements across Avatar Selection, Student Dashboard, Begin Learning, and Module Detail screens for enhanced clarity and contrast on low-resolution laptop displays.
- **Video Completion Restrictions:** Enforced strict video watch-time rules and playback controls to prevent skipping and accurately measure student engagement.
- **MKV/WebM Media Support:** Integrated native MKV/WebM parser (`mkv-parser.ts`) for precise media duration calculation and playback handling of bundled offline videos.

---

## 🛠️ Technical & Database Updates

- **SQLite Database Migrations:**
  - `0009_many_cerebro.sql`: Column updates for language preferences and expanded session metrics.
  - `0010_happy_silverclaw.sql`: Added geolocation fields to sync payload tables.
- **Dependencies Added:**
  - `electron-updater`: `^6.8.9`
  - `builder-util-runtime`: `^9.7.0`
- **Build Configurations:**
  - Updated `electron-builder.config.cjs` for auto-update checks and single executable packaging.

---

## 📦 Installation & Deployment Instructions

### For New Installations
Download and run the compiled installer:
`Amazon Future Engineer-Setup-1.2.0.exe`

### For Existing Installations
Existing `v1.1.0` or `v1.0.6` installations will automatically detect `v1.2.0` on launch and update silently in the background.

### Silent Enterprise Mass Deployment
```cmd
"Amazon Future Engineer-Setup-1.2.0.exe" /S
```

---

### 👥 Authors & Credits
Built with ⚡ by the **NavGurukul Team**.  
© 2026 NavGurukul. All Rights Reserved.
