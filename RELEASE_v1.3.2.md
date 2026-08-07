# Release Notes: v1.3.2 (Manifest Schema Normalization, Quiz Answer Validation & System Resilience)

**Release Date:** August 7, 2026  
**Application:** Amazon Future Engineers (AFE) Learning App / RMS Offline Learning App  
**Version:** `1.3.2`  
**Target OS:** Windows (x64 NSIS Installer)  
**Repository:** [navgurukul/AFE-Learning-App](https://github.com/navgurukul/AFE-Learning-App)  

---

## 🚀 Key Highlights & Major Improvements

### 1. 🛠️ Manifest Schema Normalization & Quiz Answer Validation
- **Correct Answer Index Normalization:** Fixed schema validation crash (`ContentValidationError`) by populating `correctAnswerIndex` across all 219 quiz questions in 14 modules and 7 regional languages (English, Hindi, Telugu, Gujarati, Marathi, Kannada, Tamil).
- **Zod Schema Compliance:** Cleaned up legacy string `answer` fields in `manifest.json` across both `installer-assets` and `dev-data` environments, strictly conforming to the `@backend/content-engine` schema.
- **Defensive Preprocessing:** Enhanced `QuizQuestionSchema` with automatic preprocessing to seamlessly resolve legacy string answers or option indices, preventing runtime initialization crashes.

### 2. 📚 Complete Multilingual Quiz Curriculum & Manifest Cleanup
- **203 Unique Quiz Questions:** Replaced placeholder/repeated quiz questions across all 14 course modules in 7 regional languages with verified, localized question sets matching curriculum specifications (`Career Tours Product Integration Quiz sheet.xlsx`).
- **Manifest Array Deduplication:** Cleaned up duplicate quiz lesson entries in Robotics Fulfillment Center Tour modules in `manifest.json`.

### 3. 🔒 Session Isolation & Media Termination (Picture-in-Picture Safeguard)
- **Automatic PiP Cleanup:** Implemented global media cleanup helper (`exitPictureInPictureAndCleanup`) executed on student logout, module exit, and view transitions.
- **Cross-Session Privacy:** Automatically exits active Picture-in-Picture (PiP) windows and pauses all audio/video playback upon student logout, preventing media persistence between student sessions.

### 4. ⏱️ Engagement-Based Feedback Survey Trigger
- **Minimum Engagement Threshold:** Added `hasMetEngagementThreshold()` check in `SessionManager` requiring a minimum of **60 seconds active video watch time** OR **120 seconds total session duration** before displaying the logout survey.
- **Eliminated Survey Fatigue:** Prevents premature feedback survey prompts for students who log out after very short or accidental sessions.

### 5. 📜 Lesson List Scroll Position Preservation
- **Scroll Restoration:** Preserves `window.scrollY` position when opening a lesson and automatically restores the exact scroll position upon returning to the lesson list view in `ModuleDetail.tsx`.

### 6. 🔄 Dedicated Playback Speed Controls & Live Session Polling
- **Dedicated Speed Control Bar:** Added Neo-Brutalism styled playback speed buttons (`1x`, `1.25x`, `1.5x`, `2x`) directly in the control bar beneath the video player with telemetry logging (`ipc.recordSpeed`), while disabling the native video player options overlay (`nodownload noplaybackrate nopictureinpicture`) to prevent UI desync.
- **Packaged Release Live Session Sync:** Fixed session polling to the server in packaged live executable releases.

### 7. 🛡️ Windows 11 Security, PE Header Metadata & Icon Optimization
- **WMIC Deprecation Fix:** Replaced legacy `wmic` process calls in `device-info.ts` with modern PowerShell CIM queries (`Get-CimInstance`), resolving Defender Living-off-the-Land (LotL) heuristic alerts.
- **Windows PE Metadata Injection:** Updated `electron-builder.config.cjs` to set `publisherName: 'NavGurukul'`, `requestedExecutionLevel: 'requireAdministrator'`, and legal trademark resources in binary PE headers.
- **Multi-Resolution App & NSIS Installer Icons:** Added custom multi-resolution `icon.ico` and `icon.png` assets, setting application window and NSIS installer/uninstaller branding.
- **HTTPS Telemetry Upgrade:** Upgraded unencrypted IP geolocation fallback API calls to `https://`.

---

## 📦 Installation & Deployment Instructions

### For New Installations
Download and run the compiled installer:
`Amazon-Future-Engineer-Setup-1.3.2.exe`

### For Existing Installations
Existing installations will automatically detect `v1.3.2` on launch and update silently in the background via `electron-updater`.

### Silent Enterprise Mass Deployment
```cmd
"Amazon-Future-Engineer-Setup-1.3.2.exe" /S
```

---

### 👥 Authors & Credits
Built with ⚡ by the **NavGurukul Team**.  
© 2026 NavGurukul. All Rights Reserved.
