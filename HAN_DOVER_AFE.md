# Amazon Future Engineers (AFE) — Project Handover

## 1. 📄 Project Overview & Vision

**AFE (Amazon Future Engineers)** is an enterprise-grade, **offline-first Learning Management System (LMS)** designed to deliver high-quality, interactive education in environments with limited or no internet connectivity.

### The Problem
Traditional LMS platforms are 100% network-dependent. In rural areas, community centers, or shared classroom settings with unreliable power and network, students are excluded from digital learning.

### The Solution
A standalone Windows desktop application that bundles all content (videos, PDFs, quizzes) and intelligence (AI Tutor) locally. It ensures a consistent, high-performance learning experience regardless of the surrounding infrastructure.

---

## 2. 🏗️ High-Level Architecture

The project is built as a **pnpm monorepo**, ensuring modularity, type safety, and clean separation between the frontend UI and backend services.

### Core Anatomy
-   **`apps/renderer`**: A React 18 frontend with a **Neo-Brutalism** design system. It is fully sandboxed for security.
-   **`apps/desktop`**: An Electron-based main process that manages window lifecycles and provides secure access to system resources.
-   **`packages/backend/*`**: A collection of specialized services:
    -   `db`: SQLite (better-sqlite3) + Drizzle ORM for schema and migrations.
    -   `content-engine`: Validates JSON manifests and resolves local asset paths.
    -   `analytics`: Tracks student engagement (watch time, quiz scores) in real-time.
    -   `ai-tutor`: Manages offline LLM interactions via **Ollama**.
    -   `stt-engine`: Speech-to-Text using **Whisper.cpp**.
    -   `tts-engine`: Text-to-Speech using **Piper (ONNX)**.
-   **`packages/shared`**: Shared TypeScript contracts and constants used by both frontend and backend.

---

## 3. 🎯 Key Capabilities

### 🛡️ Multi-Student Support
A single device can host multiple local student profiles. Each student's progress, AI chat history, and analytics are isolated and persistent.

### 📚 Offline Content Delivery
-   **Video Player**: Custom-built player with tamper-resistant progress tracking.
-   **PDF Reader**: Tracks reading duration and page-level progress.
-   **Interactive Quizzes**: Comprehensive assessment framework with score tracking.

### 🤖 AI-Powered Tutoring (Offline)
-   **Chat Mode**: Context-aware tutoring using local LLMs (e.g., `llama3`, `qwen2.5`).
-   **Voice Mode**: A hands-free, voice-to-voice interaction loop using Whisper for STT and Piper for TTS.
-   **Learning Summaries**: Automated AI-generated progress reports for students and mentors.

### 📊 Local Analytics & Sync
-   Detailed telemetry on every student interaction.
-   **Sync Queue**: An idempotent sync engine that pushes local data to a central cloud server whenever internet is available.

---

## 4. 🗄️ Persistence & Deployment

### Data Locations
-   **Installation**: `C:\Program Files\Offline Learning App\`
-   **User Data**: `C:\ProgramData\OfflineLearningApp\`
    -   `data.db`: SQLite database.
    -   `content\manifest.json`: The source of truth for all learning materials.
    -   `assets\`: All bundled video and document files.

### Installer Logic
The application uses **electron-builder (NSIS)** to generate specialized Windows installers:
-   Supports **Silent Installation** (`/S`) for mass deployment.
-   **Data Persistence**: The installer is configured to preserve `C:\ProgramData` during upgrades or uninstalls.

---

## 🛠️ 5. Developer Checklist (Quick Start)

### Environment Setup
1.  **Node.js**: v20+ and **pnpm** v9+.
2.  **Ollama**: Install locally for AI features. Pull models: `ollama pull qwen2.5:1.5b`.
3.  **Local Assets**:
    -   **Whisper**: Download `ggml-base.en-q5_1.bin` into `packages/backend/stt-engine/`.
    -   **Piper**: Add `piper.exe` and voice models (`.onnx`) to `packages/backend/tts-engine/`.

### Development Commands
-   `pnpm install`: Install monorepo dependencies.
-   `pnpm dev`: Start the desktop and renderer apps in watch mode.
-   `pnpm build`: Compile all packages.
-   `pnpm build:installer`: Generate the production Windows `.exe` installer.

---

## 📝 6. Future Roadmap

1.  **Multi-language Expansion**: Integrating models for regional Indian languages (Hindi, Marathi, etc.).
2.  **Performance Optimization**: Exploring smaller quantized models to reduce RAM/CPU usage on legacy devices.
3.  **Offline-to-Cloud Sync**: Completion of the `sync_push` service for periodic telemetry reporting.
4.  **Content Management System (CMS)**: Building a tool for mentors to update local manifests and assets easily.

---

**Handover prepared by Antigravity**  
*Date: 2026-04-02*
