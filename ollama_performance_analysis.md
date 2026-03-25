# Ollama Performance Analysis Report (Updated 2026-03-25)

## Executive Summary
The perceived slowness (up to 2 minutes for a cold start/response) remains a challenge, though **hardware-aware optimizations** have been partially implemented. The core issue is still **resource contention**; while low-end devices now see a 60-second delay for background tasks, standard systems still trigger multiple heavy Ollama calls immediately upon startup, leading to significant queueing.

## Identified Issues

### 1. Startup Background AI Summarization (Partially Mitigated)
Upon startup, the application triggers `checkAndGenerateSummaries`.
- **Current State**: A 60-second delay has been implemented for low-end devices. However, standard hardware still triggers this immediately.
- **The Problem**: This function iterates through all students and generates a "Learning Summary" and "Progress Note".
- **Impact**: These are **non-streaming** calls that process up to 50 messages of context. If triggered immediately, they queue up behind the user's first chat interaction.
- **Location**: [`apps/desktop/src/main/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/apps/desktop/src/main/index.ts) (Trigger) and [`packages/backend/analytics/src/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/analytics/src/index.ts) (Implementation).

### 2. Concurrent Title Generation
When the first message of a session is sent (Chat or Voice):
- **The Problem**: The app triggers the main response (streaming) AND `generateSessionTitle` (non-streaming) simultaneously.
- **Impact**: Ollama handles two separate requests for the same model. On non-GPU hardware, this causes the streaming response to "stutter" or hang until the title generation (non-streaming) is complete.
- **Location**: [`packages/backend/ai-tutor/src/index.ts`](file:///c:/Mukul/Navgurukul/RMS/AFE/packages/backend/ai-tutor/src/index.ts) inside `sendMessage` and `sendVoiceMessage`.

### 3. Non-Streaming Bottlenecks
Background tasks (`generateLearningSummary`, `generateSessionTitle`) still do not use the `stream: true` parameter.
- **Impact**: Ollama must compute the *entire* response before returning anything, locking the process for several seconds.

### 4. General Resource Contention (Partially Mitigated)
The AFE app runs multiple AI engines (STT, TTS, Ollama).
- **Current State**: Whisper (STT) now throttles to 2 threads on low-end devices (4 threads on standard).
- **The Problem**: All engines compete for CPU/RAM during the initial "User -> Chat" flow.

---

## Progress & Remaining Fixes

### 🟢 Status: Partially Implemented
- **Hardware-Aware Delay**: `checkAndGenerateSummaries` is delayed by 60s on low-end hardware.
- **Resource Throttling**: Whisper threads reduced for low-end devices.
- **Keep-Alive Management**: Ollama `keep_alive` is reduced to 1m (or 0) on low-end devices to save RAM.

### 🔴 Status: Pending / Critical
1.  **AI Task Queue**: A central coordinator is still needed to ensure "User Chat" (High Priority) can pre-empt or block "Background Tasks" (Low Priority).
2.  **Universal Streaming**: Switch `generateSessionTitle` and `generateLearningSummary` to streaming to reduce contiguous locking of the Ollama process.
3.  **Title Generation Optimization**: Delay title generation until *after* the first AI response has finished streaming completely.
4.  **Global Background Delay**: Extend the 60-second startup delay to *all* devices, or implement an "idle-only" trigger.
5.  **Ollama Pre-warming**: Implement a lightweight "ping" at startup to ensure the model is loaded before the user starts chatting.
