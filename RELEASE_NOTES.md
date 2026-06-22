# Release Notes

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
