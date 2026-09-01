# STT Keyboard Shortcut Implementation

## Summary of Changes

Converted the Speech-to-Text (STT) interface from a full-screen voice mode pop-up to a streamlined keyboard shortcut-based input method.

## What Changed

### 1. **Removed Voice Mode Pop-up (VoiceOrb)**
   - ❌ Removed `useVoiceMode` hook import
   - ❌ Removed `VoiceOrb` component import
   - ❌ Removed full-screen voice overlay that appeared when clicking mic
   - ❌ Removed voice mode state variables (`voiceModeActive`, `micBusy`)
   - ❌ Removed `handleSpeak()` and `handleVoiceModeClose()` functions

### 2. **Added Ctrl+Space Hold-to-Talk Shortcut**
   - ✅ Implemented keyboard event listeners for `Ctrl+Space` (Control key + Space bar)
   - ✅ Pressing and **holding** `Ctrl+Space` starts recording
   - ✅ Releasing the keys stops recording automatically
   - ✅ Cannot start a new recording while already recording
   - ✅ Keyboard shortcut is disabled while AI is generating a response

### 3. **Direct Text Input Display**
   - ✅ STT transcribed text now appears **directly in the chat input box**
   - ✅ **Partial transcripts** (real-time) show live as the user speaks
   - ✅ **Final transcripts** replace partial ones when recording stops
   - ✅ Text is appended to existing input (allows combining typed and spoken text)

### 4. **UI Improvements**
   - ✅ Mic button changed to a status indicator (no longer clickable)
   - ✅ Visual indicator shows recording state:
     - 🎙 Normal state = idle (ready for Ctrl+Space)
     - 🔴 Red with pulse animation = actively recording
   - ✅ Tooltip shows: "Press Ctrl+Space to record" when idle, or "Recording... Release Ctrl+Space to stop" when active
   - ✅ Input field shows reduced opacity while recording to indicate it's in use
   - ✅ Input placeholder updated to: "Type your question here... (or press Ctrl+Space to record)"

## How to Use

1. **Start Recording**: Press and hold `Ctrl` + `Space`
2. **Speak**: Say your question while holding the keys
3. **Stop Recording**: Release either key to stop
4. **See Results**: Transcribed text appears in the input box
5. **Send**: Press Enter or click Send button

## Technical Details

### Modified Files
- `apps/renderer/src/pages/AILearningCenter.tsx`
  - Removed voice mode imports and related code
  - Added keyboard event listeners (`keydown`/`keyup`)
  - Added partial transcript state (`partialTranscript`)
  - Updated STT result handlers to show text directly in input
  - Updated UI to reflect keyboard-based operation

### STT Flow
```
Keyboard (Ctrl+Space Hold)
    ↓
useStreamingSTT hook (start/stop)
    ↓
Browser Audio API (getUserMedia, AudioContext, AudioWorklet)
    ↓
Electron IPC (stt:chunk messages)
    ↓
Sherpa-ONNX Engine
    ↓
Partial Transcripts → Input box (live feedback)
    ↓
Final Transcript → Input box (confirmed text)
```

## Benefits

1. **Faster Input**: No modal overlay, direct typing
2. **More Natural**: Hold-to-talk is intuitive and familiar
3. **Real-time Feedback**: See words appear as you speak
4. **Keyboard Friendly**: Works without reaching for mouse
5. **Context Preserved**: Mic indicator stays accessible in input area
6. **Cleaner UI**: No full-screen overlays blocking the conversation

## Compatibility

- Works on macOS, Windows, and Linux
- Requires keyboard support (Ctrl+Space key combo)
- Compatible with all STT languages supported by Sherpa-ONNX
- Works with text input boxes and typing

## Verification

✅ Build completed successfully with no TypeScript errors
✅ All imports and state properly updated
✅ Keyboard listeners properly attached and cleaned up
✅ STT text flows directly to input as intended
