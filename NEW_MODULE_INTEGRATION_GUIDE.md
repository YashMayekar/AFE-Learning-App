# 📦 Amazon Future Engineer - New Module Integration Guide

This guide outlines the standard operating procedure for integrating new learning modules (such as the *Music Tour*, *AI Career Tour*, or localized language content) into the offline desktop application without disrupting existing student progress, quiz attempts, or sync analytics.

---

## 🎯 Guiding Principles

1. **Zero Downtime / Zero Data Loss:** Adding new modules must never overwrite or invalidate existing student progress (`video_progress`, `quiz_attempts`, `started_modules`, `afe_sessions`).
2. **Strict Additive Changes:** Module and lesson identifiers (`id` and `contentId`) must be strictly unique and immutable once shipped.
3. **Dynamic Resource Resolution:** Video durations and metadata are dynamically parsed from physical Matroska (`.mkv`) / MP4 (`.mp4`) header files during runtime.
4. **Full 7-Language Support:** Every new module must include language tags matching supported locales (`English`, `Hindi`, `Tamil`, `Telugu`, `Marathi`, `Gujarati`, `Kannada`).

---

## 📁 1. Asset Placement Directory Structure

All module video assets, readings, and manifest definitions reside inside the `installer-assets` directory:

```text
c:\Mukul\Navgurukul\RMS\AFE\installer-assets\
├── content\
│   └── manifest.json                # Master Content Manifest Definition
└── assets\
    ├── videos\
    │   ├── DCT\                      # AWS Data Center Tour Videos
    │   ├── RFT\                      # Robotics Fulfillment Center Tour Videos
    │   └── MUSIC\                    # [NEW] Music Tour Videos (e.g., Module_Chapter_1.mkv)
    └── readings\                     # Reading PDF/Markdown Assets (if applicable)
```

---

## 📜 2. Manifest Schema Definition (`manifest.json`)

New modules are registered inside `installer-assets/content/manifest.json` under the `"modules"` array.

### A. Module Schema Specification
```json
{
  "id": "music-english-001",
  "contentId": "music-english-001",
  "version": "1.0.0",
  "hash": "music-english-v1-hash",
  "title": "Music & Sound Technology Tour",
  "description": "Explore how audio engineering, generative AI music, and acoustics power modern digital media.",
  "language": "English",
  "thumbnailUrl": "",
  "lessons": [ ... ]
}
```

#### Required Module Fields:
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier (e.g., `music-hindi-001`). **Never change after release.** |
| `contentId` | `string` | Matches `id` for content tracking. |
| `version` | `string` | Semantic version string (e.g., `"1.0.0"`). |
| `hash` | `string` | Unique content hash string. |
| `title` | `string` | Human-readable title displayed on Student Dashboard. |
| `description` | `string` | Brief overview paragraph displayed on module card. |
| `language` | `string` | Must match exact locale string: `English`, `Hindi`, `Tamil`, `Telugu`, `Marathi`, `Gujarati`, or `Kannada`. |
| `lessons` | `array` | Array of lesson objects (videos, quizzes, readings). |

---

### B. Lesson Specifications

#### 1. Video Lesson (`"type": "video"`)
```json
{
  "id": "music-en-ch01-video",
  "contentId": "music-en-ch01-video",
  "version": "1.0.0",
  "hash": "music-en-ch01-hash",
  "moduleId": "music-english-001",
  "title": "Introduction to Digital Audio Signal Processing",
  "description": "Watch the video to learn how sound waves are digitized.",
  "type": "video",
  "order": 1,
  "videoUrl": "assets/videos/MUSIC/Module_Chapter_1.mkv"
}
```
*Note: Video duration is automatically computed from Matroska/EBML header metadata via `mkv-parser.ts` upon app startup.*

#### 2. Quiz Lesson (`"type": "quiz"`)
```json
{
  "id": "music-en-ch01-quiz",
  "contentId": "music-en-ch01-quiz",
  "version": "1.0.0",
  "hash": "music-en-ch01-quiz-hash",
  "moduleId": "music-english-001",
  "title": "Audio Engineering Basics Quiz",
  "description": "Take the quiz to test your knowledge about audio signal processing.",
  "type": "quiz",
  "order": 2,
  "quizData": {
    "passingScore": 70,
    "questions": [
      {
        "id": "q1",
        "questionText": "What unit is used to measure sound frequency?",
        "options": ["Decibels (dB)", "Hertz (Hz)", "Watts (W)", "Volts (V)"],
        "correctOptionIndex": 1,
        "explanation": "Frequency is measured in Hertz (Hz), representing cycles per second."
      }
    ]
  }
}
```

#### 3. Reading Lesson (`"type": "reading"`)
```json
{
  "id": "music-en-ch01-read",
  "contentId": "music-en-ch01-read",
  "version": "1.0.0",
  "hash": "music-en-ch01-read-hash",
  "moduleId": "music-english-001",
  "title": "Glossary of Sound Engineering Terms",
  "description": "Read through key terms and acoustic concepts.",
  "type": "reading",
  "order": 3,
  "readingUrl": "assets/readings/MUSIC/glossary.pdf"
}
```

---

## 🌐 3. Multilingual Integration Standard

To ensure seamless language switching on the Student Dashboard:
1. Create separate module entries in `manifest.json` for each language (e.g., `music-english-001`, `music-hindi-001`, `music-tamil-001`).
2. Translate all `title`, `description`, and `quizData` fields into the respective target language.
3. Ensure the `"language"` property matches the profile language dropdown string exactly.

---

## 🛠️ 4. Verification & Testing Workflow

Before building production installers, verify the new module integration locally:

### Step 1: Type Checking
Run the TypeScript compiler to ensure schema interfaces conform:
```cmd
cd c:\Mukul\Navgurukul\RMS\AFE
pnpm tsc -b
```

### Step 2: Local App Testing
Launch the dev server to test module loading, duration parsing, and quiz submission:
```cmd
pnpm run dev
```

Check points to verify:
- [ ] Module appears on Student Dashboard under the correct language filter.
- [ ] Total module duration (in minutes) and video durations display accurately.
- [ ] Video playback loads correctly from `installer-assets/assets/videos/<MODULE_CODE>/`.
- [ ] Quizzes complete successfully and record attempts in SQLite (`quiz_attempts`).
- [ ] Session sync logs contain the updated metrics without throwing database foreign key errors.

### Step 3: Production Packaging
Build the updated Electron standalone installer:
```cmd
pnpm --filter desktop package
```

The resulting executable (`Amazon Future Engineer-Setup-1.2.0.exe`) will include the new module assets bundled in `resources/installer-assets/`.

---

## ⚡ Safety Checklist

| Rule | Details |
| :--- | :--- |
| 🚫 **No Renaming Existing IDs** | Never alter `id` or `contentId` of previously released modules/lessons. |
| 🚫 **No Drizzle Push** | Schema migrations must use `drizzle-kit generate:sqlite` and `drizzle-kit migrate`. |
| 📁 **Lowercase Asset Paths** | Keep relative video and reading paths consistent between Windows and Linux packager runs. |
