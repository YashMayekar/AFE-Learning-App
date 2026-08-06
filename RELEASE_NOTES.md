# Release Notes

## Release Notes: v1.2.2 (Quiz Curriculum Update, Engagement Thresholds & Session Isolation) - August 6, 2026

This release introduces **203 Unique Multilingual Quiz Questions**, **Manifest Array Deduplication**, **Picture-in-Picture Session Cleanup**, **Engagement-Based Logout Survey Triggers**, and **Lesson List Scroll Restoration**.

### 🚀 Key Highlights & Major Features

#### 1. **Complete Multilingual Quiz Curriculum & Manifest Cleanup**
- **203 Unique Quiz Questions:** Replaced placeholder/repeated quiz questions across all 14 course modules in 7 regional languages (English, Hindi, Telugu, Gujarati, Marathi, Kannada, Tamil) with unique, localized question sets matching the official curriculum specifications (`Career Tours Product Integration Quiz sheet.xlsx`).
- **Manifest Array Deduplication:** Cleaned up 49 duplicate quiz lesson entries in Robotics Fulfillment Center Tour modules in `manifest.json` across `dev-data` and `installer-assets`.

#### 2. **Session Isolation & Media Termination (Picture-in-Picture Safeguard)**
- **Automatic PiP Cleanup:** Implemented global media cleanup helper (`exitPictureInPictureAndCleanup`) executed on student logout, module exit, and view transitions.
- **Cross-Session Privacy:** Automatically exits active Picture-in-Picture (PiP) windows and pauses all audio/video playback upon student logout, preventing Student A's media window from persisting into Student B's session.

#### 3. **Engagement-Based Feedback Survey Trigger**
- **Minimum Engagement Threshold:** Added `hasMetEngagementThreshold()` check in `SessionManager` requiring a minimum of **60 seconds active video watch time** OR **120 seconds total session duration** before displaying the logout survey.
- **Eliminated Survey Fatigue:** Prevents premature feedback survey prompts for students who log out after very short or accidental sessions.

#### 4. **Lesson List Scroll Position Preservation**
- **Scroll Restoration:** Preserves `window.scrollY` position when opening a lesson and automatically restores the exact scroll position upon returning to the lesson list view in `ModuleDetail.tsx`.

#### 5. **Player Controls Synchronization & Live Session Polling**
- **Playback Speed Sync:** Aligned HTML5 video player configuration (`nodownload noplaybackrate nopictureinpicture`) to prevent UI playback speed desynchronization.
- **Packaged Release Live Session Sync:** Fixed session polling to the server in packaged live executable releases.

---

## Release Notes: v1.2.0 (Auto-Updater, Multilingual Telemetry & Single-File Deployment) - July 28, 2026

This release introduces **Auto-Updater Support via `electron-updater`**, **Single-File Installer Packaging**, **Student Language Preference Persistence**, **Expanded 5-Question Feedback Survey in 7 Regional Languages**, and **IP Geolocation Telemetry**.

### 🚀 Key Highlights & Major Features

#### 1. **Automatic Updates (`electron-updater`)**
- **Background Auto-Updates:** Integrated `electron-updater` to check for, download, and apply updates directly from GitHub Releases without user intervention.
- **Single-File Deployment:** Optimized `electron-builder` configuration for single-file installer creation (`Amazon Future Engineer-Setup-1.2.0.exe`) and automatic release publishing (`-p always`).

#### 2. **Student Language Preference & 7-Language Extended Feedback Survey**
- **Persistent Language Selection:** Persists student language choice across English, Hindi, Marathi, Gujarati, Kannada, Tamil, and Telugu into SQLite (`students.preferredLanguage`).
- **5-Question Logout Feedback Modal:** Expanded feedback survey covering CSAT, ITP, course comprehension, laptop accessibility, and learning preference in 7 regional languages.

#### 3. **Geolocation Telemetry & Session Metrics**
- **IP Geolocation:** Fetches device location dynamically when internet connection is active.
- **SQLite Database Upgrades:** Drizzle migrations (`0009` & `0010`) for session tracking, location tagging, and hardware fingerprinting.

#### 4. **UI/UX Overhaul & Video Rules**
- **Neo-Brutalism Design Polish:** High contrast, accessible UI updates for student dashboards and lesson viewers.
- **Video Playback Restrictions:** Enforced video duration and progress rules to ensure complete lesson viewing.

---

## Release Notes: v1.0.3 (Session-Level Tracking & Offline Sync) - June 22, 2026

This release introduces comprehensive **Session-Level Telemetry Tracking** and a robust **Offline-First Synchronization Engine**, aligning the application with **Method 2 (Individual Tracking)** of the **Amazon Future Engineer (AFE) Partner Data Collection Guide**.

### 🚀 Key Highlights & Features

#### 1. **Granular Session-Level Tracking**
- **Isolated Telemetry:** Track learning progress, video interactions, and quiz attempts on a per-student, per-session basis to ensure accurate reporting on shared devices.
- **48-Field Session Data:** Compiles comprehensive data points including CSAT (Customer Satisfaction), ITP (Interest to Participate), overall video completion rate, quiz accuracy, average playback speed, pause/seek counts, and network type.
- **Neo-Brutalism Feedback Survey Modal:** Prompts students for enjoyment (CSAT) and future career interest (ITP) ratings (1–5 scale) directly within a beautiful Neo-Brutalism styled popup upon logging out.

#### 2. **Exit Safety & Close Interception Safeguards**
- **Window Close Interception:** Overrides default window closure (`Alt + F4` or clicking the "X" button) to prevent orphaned sessions and data loss. Prompts the student to properly log out and submit their feedback survey first.
- **Crash/Quit Safeguards:** Registers a hook on `app.on('quit')` to run session termination routines synchronously, preserving all uncommitted watched seconds and quiz telemetry.

#### 3. **Offline-First Background Sync Engine**
- **Automatic Sync Loop:** Background worker executes every 30 seconds to upload local SQLite session records.
- **NGO Key Validation:** Automatically validates partner keys via `/api/afe/validate-key` prior to synchronization.
- **Graceful Queueing:** Sync payloads include unique hardware IDs, MAC addresses, and fingerprints. If the device is offline, sessions queue securely in the local SQLite database and retry automatically once connection is established.

#### 4. **Curriculum, Language & Media Upgrades**
- **New Learning Modules:** Integrated Amazon computing modules, Career Tour lessons, and computing basics.
- **Pre-bundled Videos:** Added and configured high-definition video assets (`laptop-basics.mp4`, `chatgpt-basics.mp4`, `google-docs-part1.mp4`) directly inside the local assets directory.
- **Bug Fixes:** Resolved issues in multilingual language-switching, video player event tracking, and PDF document rendering.
- **UI Cleanup:** Removed experimental "Learn with AI" content buttons to streamline the student dashboard.

---

## Release Notes: v1.0.0 (First Stable Release)
## Amazon Future Engineers (AFE) Learning App

We are excited to announce the first stable release of the **Amazon Future Engineers (AFE) Learning App**! This release marks the completion of the core offline-first architecture, installer generation, and AI-powered tutor integration.

---

### 🚀 Major Features

#### 1. **True Offline Learning**
- **Zero-Dependency Runtime:** The app bundles its own Node.js and Chromium runtime. Students do not need to install anything.
- **Local Persistence:** All student profiles, progress (video, PDF, quizzes), and AI chat history are saved in a local SQLite database that survives application updates.

#### 2. **AI-Powered Tutor (Ollama Integration)**
- **Conversational Learning:** Interactive AI tutor powered by **Qwen 2.5:1.5b**.
- **Context Awareness:** The AI knows what lesson the student is currently viewing and provides relevant guidance.
- **Learning Summaries:** Automatically generates periodic summaries of student progress for NGOs and teachers.

#### 3. **Advanced Voice Interactions**
- **Multilingual STT (Speech-to-Text):** Integrated **Whisper.cpp** with the **`ggml-base-q5_1.bin`** multilingual model. Supports auto-language detection (Hindi, English, etc.).
- **Natural TTS (Text-to-Speech):** Integrated **Piper** with a natural **Indian-accented English** voice model for a familiar student experience.
- **Push-to-Talk:** Simple voice interaction interface with an animated "Voice Orb."

#### 4. **Modern Neo-Brutalism UI**
- A high-contrast, energetic, and playful design system built with **React** and **TailwindCSS**.
- Designed for engagement on shared laptops in low-connectivity environments.

#### 5. **Silent Installer & Enterprise Deployment**
- **NSIS Installer:** Supports fully silent installation using the `/S` flag for mass deployment by NGOs.
- **System-Wide Install:** Installs to `Program Files` and stores data in `ProgramData` for shared access across multiple Windows users.

---

### 🛠️ Recent Technical Fixes
- **Installer Bundling:** Fixed 7 major issues in `electron-builder` configuration to ensure all voice binaries and AI models are correctly packaged.
- **Dependency Clean-up:** Resolved workspace dependency conflicts and removed legacy daemonization code.
- **Multilingual Support:** Switched from English-only to the full multilingual Whisper base model.

---

### 📋 Prerequisites for New PCs
To use the AI Tutor features on a new machine:
1.  **Install the App:** Run the generated `Amazon Future Engineer-Setup.exe`.
2.  **Install Ollama:** Download from [ollama.com](https://ollama.com).
3.  **Pull Model:** Run `ollama pull qwen2.5:1.5b` in the terminal.

---

### 👥 Authors
Build with ⚡ by the **NavGurukul Team**.
© 2026 NavGurukul. All Rights Reserved.
