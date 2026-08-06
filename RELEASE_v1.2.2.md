# Release Notes: v1.2.2 (Quiz Curriculum Update, Engagement Thresholds & Session Isolation)

**Release Date:** August 6, 2026  
**Application:** Amazon Future Engineers (AFE) Learning App / RMS Offline Learning App  
**Version:** `1.2.2`  
**Target OS:** Windows (x64 NSIS Installer)  
**Repository:** [navgurukul/AFE-Learning-App](https://github.com/navgurukul/AFE-Learning-App)  

---

## 🚀 Key Highlights & Major Improvements

### 1. 📚 Complete Multilingual Quiz Curriculum & Manifest Cleanup
- **203 Unique Quiz Questions:** Replaced placeholder/repeated quiz questions across all 14 course modules in 7 regional languages (English, Hindi, Telugu, Gujarati, Marathi, Kannada, Tamil) with unique, localized question sets matching the official curriculum specifications (`Career Tours Product Integration Quiz sheet.xlsx`).
- **Manifest Array Deduplication:** Cleaned up 49 duplicate quiz lesson entries in Robotics Fulfillment Center Tour modules in `manifest.json` across `dev-data` and `installer-assets`.

### 2. 🔒 Session Isolation & Media Termination (Picture-in-Picture Safeguard)
- **Automatic PiP Cleanup:** Implemented global media cleanup helper (`exitPictureInPictureAndCleanup`) executed on student logout, module exit, and view transitions.
- **Cross-Session Privacy:** Automatically exits active Picture-in-Picture (PiP) windows and pauses all audio/video playback upon student logout, preventing Student A's media window from persisting into Student B's session.

### 3. ⏱️ Engagement-Based Feedback Survey Trigger
- **Minimum Engagement Threshold:** Added `hasMetEngagementThreshold()` check in `SessionManager` requiring a minimum of **60 seconds active video watch time** OR **120 seconds total session duration** before displaying the logout survey.
- **Eliminated Survey Fatigue:** Prevents premature feedback survey prompts for students who log out after very short or accidental sessions.

### 4. 📜 Lesson List Scroll Position Preservation
- **Scroll Restoration:** Preserves `window.scrollY` position when opening a lesson and automatically restores the exact scroll position upon returning to the lesson list view in `ModuleDetail.tsx`.

### 5. 🔄 Player Controls Synchronization & Live Session Polling
- **Playback Speed Sync:** Aligned HTML5 video player configuration (`nodownload noplaybackrate nopictureinpicture`) to prevent UI playback speed desynchronization.
- **Packaged Release Live Session Sync:** Fixed session polling to the server in packaged live executable releases.

---

## 📦 Installation & Deployment Instructions

### For New Installations
Download and run the compiled installer:
`Amazon-Future-Engineer-Setup-1.2.2.exe`

### For Existing Installations
Existing `v1.2.0` or earlier installations will automatically detect `v1.2.2` on launch and update silently in the background via `electron-updater`.

### Silent Enterprise Mass Deployment
```cmd
"Amazon-Future-Engineer-Setup-1.2.2.exe" /S
```

---

### 👥 Authors & Credits
Built with ⚡ by the **NavGurukul Team**.  
© 2026 NavGurukul. All Rights Reserved.
