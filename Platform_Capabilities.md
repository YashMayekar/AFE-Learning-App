# 🚀 AFE Learning Platform — Capability Document

---

## Executive Summary

The **AFE Learning Platform** is a next-generation, enterprise-grade **Offline-First Learning Management System (LMS)** designed to revolutionize education delivery in connectivity-challenged environments. Built with cutting-edge technologies and designed for scale, this platform represents a significant investment in educational technology infrastructure capable of transforming how institutions deliver learning content to students across diverse geographical and infrastructural landscapes.

---

# Section 1: Business & Strategic Overview (Non-Technical)

## 🎯 Vision & Mission

The AFE Learning Platform addresses one of the most critical challenges in modern education: **delivering high-quality, interactive learning experiences without dependency on internet connectivity**. This enterprise solution empowers educational institutions to reach learners in remote areas, rural communities, and regions with unreliable network infrastructure.

---

## 💎 Core Value Proposition

### 1. **True Offline-First Architecture**
Unlike conventional web-based learning platforms that merely "cache" content, AFE is engineered from the ground up to operate with **100% functionality without any internet connection**. Students can:
- Access full video libraries and multimedia content
- Complete interactive assessments and quizzes
- Track their learning progress and achievements
- Receive AI-powered tutoring assistance — all completely offline

### 2. **Enterprise-Grade Multi-Student Support**
A single device can support **unlimited student profiles**, making it ideal for:
- Shared classroom laptops
- Community learning centers
- Library computer stations
- Mobile learning labs

Each student maintains their own personalized learning journey, progress tracking, and performance analytics — completely isolated and secure from other users.

### 3. **Integrated AI-Powered Tutoring**
The platform features a revolutionary **on-device AI Tutor** that provides:
- **Personalized learning assistance** with context-aware answers to student queries.
- **Voice Mode**: Natural voice-to-voice interaction using **Whisper** for STT and **Piper** for TTS.
- **Adaptive explanations** based on the student's current module and lesson.
- **Automated Summaries**: Periodic AI-generated reports on student progress and performance.

This AI operates entirely offline using local inference engines (Ollama), ensuring **24/7 availability** regardless of connectivity status.

### 4. **Comprehensive Learning Analytics**
Institutions gain deep visibility into student engagement through:
- Real-time progress tracking across all modules
- Video engagement metrics (watch time, completion rates, re-watch patterns)
- Quiz performance analytics with improvement trends
- Time-on-task measurements for productivity insights
- AI-generated learning summaries at configurable intervals

### 5. **Enterprise Deployment Ready**
Designed for large-scale institutional deployment:
- **Silent Installation** capability for mass deployment via SCCM, Intune, or GPO
- Zero-touch installation requiring no user intervention
- Centralized data synchronization when connectivity becomes available
- Persistent data storage that survives app updates, reinstallations, and user account changes

<!-- ## 📊 Investment Justification

### Development Scope & Complexity

| Component | Description | Investment Value |
|:---|:---|:---|
| **Offline-First Core Engine** | Custom-built architecture ensuring complete functionality without internet | ₹4,00,000 |
| **Multi-Student Database System** | SQLite-based local database with enterprise-grade ORM and migrations | ₹2,50,000 |
| **Custom Video Player** | Bespoke video playback engine with tamper-resistant progress tracking | ₹1,75,000 |
| **Interactive Quiz System** | Comprehensive assessment framework with anti-cheat mechanisms | ₹1,50,000 |
| **AI Tutoring Integration** | Local LLM integration with context-aware response system | ₹3,00,000 |
| **Analytics & Reporting Engine** | Real-time event tracking and aggregation system | ₹1,50,000 |
| **Security Infrastructure** | Sandboxed execution environment with IPC security layer | ₹2,00,000 |
| **Installer & Deployment System** | Enterprise-grade NSIS installer with silent deployment | ₹1,25,000 |
| **UI/UX Design System** | Modern Neo-Brutalism design language with responsive components | ₹1,50,000 |
| **Cloud Sync Framework** | Optional synchronization layer for centralized data collection | ₹1,00,000 |

### **Total Estimated Investment: ₹20,00,000 (20 Lacs)** -->

---

## 🏆 Competitive Advantages

| Feature | Traditional LMS | AFE Learning Platform |
|:---|:---|:---|
| Internet Dependency | Required (100%) | Not Required (0%) |
| Offline Video Playback | Limited/None | Full Library Access |
| Multi-Student per Device | Rarely Supported | Native Support |
| AI Tutoring | Cloud-Dependent | Fully Offline |
| Deployment Complexity | High (Web Servers) | Low (Desktop Install) |
| Data Ownership | Vendor Controlled | Institution Owned |
| Ongoing Infrastructure Costs | High (Hosting/Bandwidth) | Minimal |

---

## 🔐 Compliance & Security

- **Data Privacy**: All student data remains on-device until explicitly synchronized
- **No Tracking**: Zero external telemetry or third-party data sharing
- **Secure Architecture**: Sandboxed UI with no direct system access
- **Audit Trail**: Complete event logging for compliance requirements
- **GDPR/Privacy Ready**: Institution maintains full data control

---

## 📈 Scalability & Future-Proofing

The platform architecture supports seamless evolution:
- **Content Expansion**: Add new modules without application updates
- **AI Model Upgrades**: Swap AI models as better local models emerge
- **Sync Capabilities**: Enable cloud synchronization when infrastructure permits
- **Cross-Platform Potential**: Architecture supports future macOS/Linux ports
- **API Integration**: Extensible backend for third-party integrations

---

---

# Section 2: Technical Architecture & Implementation Details

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
|:---|:---|:---|:---|
| **Monorepo Manager** | pnpm | v9+ | Workspace management & dependency optimization |
| **Desktop Runtime** | Electron | v28+ | Cross-platform desktop application framework |
| **Frontend Framework** | React | v18+ | Component-based UI rendering |
| **Build Tool** | Vite | v5+ | Fast development server & optimized bundling |
| **Language** | TypeScript | v5+ | Type-safe development across all packages |
| **Styling** | TailwindCSS | v3+ | Utility-first CSS framework |
| **Database Engine** | SQLite | v3.45+ | Embedded relational database |
| **SQLite Binding** | better-sqlite3 | Latest | Synchronous C-binding for high performance |
| **ORM** | Drizzle ORM | Latest | Type-safe SQL queries & migrations |
| **AI Runtime** | Ollama | Latest | Local Large Language Model inference |
| **Installer** | electron-builder (NSIS) | Latest | Windows installer generation |

---

## 🏗️ Monorepo Architecture

```
AFE/
├── apps/
│   ├── desktop/                 # Electron Main Process
│   │   ├── src/
│   │   │   ├── main/           # Application lifecycle, window management
│   │   │   ├── preload/        # Secure IPC bridge (Context Isolation)
│   │   │   └── ipc/            # IPC channel handlers
│   │   └── electron-builder.config.js
│   │
│   └── renderer/                # React Frontend (Sandboxed)
│       └── src/
│           ├── pages/          # Route-based page components
│           ├── components/     # Reusable UI components
│           ├── styles/         # Neo-Brutalism design system
│           └── lib/            # IPC client utilities
│
├── packages/
│   ├── backend/                 # Server-side only packages
│   │   ├── db/                 # Database layer (Drizzle + SQLite)
│   │   ├── content-engine/     # Manifest parsing & validation
│   │   ├── analytics/          # Event tracking & aggregation
│   │   └── ai-tutor/           # Ollama integration layer
│   │
│   └── shared/                  # Cross-process shared code
│       └── src/
│           ├── types/          # TypeScript interfaces
│           ├── constants/      # Shared configuration
│           └── ipc/            # IPC contracts & channel definitions
│
├── dev-data/                    # Development content & database
├── installer-assets/            # Files bundled in installer
└── pnpm-workspace.yaml
```

---

## 🔒 Security Model: Context Isolation Architecture

The application implements Electron's **maximum security configuration**:

### Process Separation

```
┌─────────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS (Trusted)                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │   SQLite    │ │   Content   │ │  Analytics  │ │  AI Tutor  │ │
│  │   Database  │ │   Engine    │ │   Engine    │ │  Service   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │
│                            ▲                                     │
│                            │ IPC Handlers                        │
└────────────────────────────┼────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │      PRELOAD SCRIPT         │
              │   (Context Bridge Layer)    │
              │                             │
              │  - Channel Whitelisting     │
              │  - API Exposure Control     │
              │  - Security Boundary        │
              └──────────────┬──────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                      RENDERER PROCESS (Sandboxed)                │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    React Application                         │ │
│  │  - No Node.js access (nodeIntegration: false)               │ │
│  │  - No require() capability                                   │ │
│  │  - Communicates ONLY via window.electronAPI                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Security Enforcement

| Setting | Value | Implication |
|:---|:---|:---|
| `nodeIntegration` | `false` | Renderer cannot access Node.js APIs |
| `contextIsolation` | `true` | Preload runs in isolated context |
| `sandbox` | `true` | Chromium sandbox fully enabled |
| `webSecurity` | `true` | Same-origin policy enforced |

---

## 📡 Inter-Process Communication (IPC) Protocol

### Channel Categories

```typescript
// packages/shared/src/ipc/channels.ts

export const IPC_CHANNELS = {
  // Student Management
  STUDENT_CREATE: 'student:create',
  STUDENT_GET_ALL: 'student:getAll',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',
  
  // Content Access
  CONTENT_GET_MANIFEST: 'content:getManifest',
  CONTENT_GET_MODULE: 'content:getModule',
  CONTENT_GET_ASSET_PATH: 'content:getAssetPath',
  
  // Progress Tracking
  PROGRESS_UPDATE_VIDEO: 'progress:updateVideo',
  PROGRESS_GET_VIDEO: 'progress:getVideo',
  PROGRESS_UPDATE_READING: 'progress:updateReading',
  PROGRESS_GET_READING: 'progress:getReading',
  
  // Quiz System
  QUIZ_SUBMIT_ATTEMPT: 'quiz:submitAttempt',
  QUIZ_GET_ATTEMPTS: 'quiz:getAttempts',
  
  // Analytics
  ANALYTICS_TRACK_EVENT: 'analytics:trackEvent',
  ANALYTICS_GET_SUMMARY: 'analytics:getSummary',
  
  // AI Tutor
  AI_SEND_MESSAGE: 'ai:sendMessage',
  AI_GET_HISTORY: 'ai:getHistory',
  AI_STREAM_CHUNK: 'ai:streamChunk',          // New: streaming tokens
  AI_VOICE_MESSAGE: 'ai:voice-message',      // New: voice-enabled chat
  AI_VOICE_DONE: 'ai:voice-done',            // New: voice session finished
  
  // Voice Engines (STT/TTS)
  STT_START: 'stt:start',
  STT_STOP: 'stt:stop',
  STT_CHUNK: 'stt:chunk',
  STT_FINAL: 'stt:final',
  TTS_SPEAK: 'tts:speak',
  TTS_STOP: 'tts:stop',
  TTS_SENTENCE_READY: 'tts:sentence-ready',  // New: sentence-boundary synthesis
  
  // Sync
  SYNC_PUSH_DATA: 'sync:pushData',
  SYNC_GET_STATUS: 'sync:getStatus',
} as const;
```

### Type-Safe Contracts

```typescript
// Request/Response type definitions
export interface StudentCreateRequest {
  name: string;
  avatar?: string;
}

export interface StudentCreateResponse {
  id: string;
  name: string;
  avatar: string;
  createdAt: Date;
}

// Handler registration (Main Process)
ipcMain.handle(IPC_CHANNELS.STUDENT_CREATE, async (event, data: StudentCreateRequest): Promise<StudentCreateResponse> => {
  return await studentService.create(data);
});

// Client invocation (Renderer Process)
const student = await window.electronAPI.invoke<StudentCreateResponse>(
  IPC_CHANNELS.STUDENT_CREATE, 
  { name: 'John Doe' }
);
```

---

## 🗄️ Database Schema (Drizzle ORM)

### Core Tables

```typescript
// packages/backend/db/src/schema.ts

// Student Profiles
export const students = sqliteTable('students', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  avatar: text('avatar').default('default'),
  uuid: text('uuid').unique(),  // For cloud sync identification
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Video Progress Tracking
export const videoProgress = sqliteTable('video_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: text('student_id').references(() => students.id),
  lessonId: text('lesson_id').notNull(),
  moduleId: text('module_id').notNull(),
  watchedSeconds: integer('watched_seconds').default(0),
  totalSeconds: integer('total_seconds'),
  completed: integer('completed', { mode: 'boolean' }).default(false),
  lastPosition: integer('last_position').default(0),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// Reading Progress (PDFs)
export const readingProgress = sqliteTable('reading_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: text('student_id').references(() => students.id),
  lessonId: text('lesson_id').notNull(),
  moduleId: text('module_id').notNull(),
  readPercentage: integer('read_percentage').default(0),
  totalReadDuration: integer('total_read_duration').default(0),
  currentPage: integer('current_page').default(1),
  lastReadAt: integer('last_read_at', { mode: 'timestamp' }),
});

// Quiz Attempts
export const quizAttempts = sqliteTable('quiz_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: text('student_id').references(() => students.id),
  quizId: text('quiz_id').notNull(),
  score: integer('score').notNull(),
  maxScore: integer('max_score').notNull(),
  answers: text('answers', { mode: 'json' }),
  attemptedAt: integer('attempted_at', { mode: 'timestamp' }),
});

// AI Chat Sessions
export const aiSessions = sqliteTable('ai_sessions', {
  id: text('id').primaryKey(),
  studentId: text('student_id').references(() => students.id),
  title: text('title').default('New Chat'),
  mode: text('mode'),  // 'tutor' | 'general'
  moduleId: text('module_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

// AI Chat History
export const aiChatHistory = sqliteTable('ai_chat_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sessionId: text('session_id').references(() => aiSessions.id),
  role: text('role').notNull(),  // 'user' | 'assistant'
  content: text('content').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// Analytics Events (Append-Only)
export const analyticsEvents = sqliteTable('analytics_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: text('student_id').references(() => students.id),
  eventType: text('event_type').notNull(),
  eventData: text('event_data', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

// Sync Queue
export const syncQueue = sqliteTable('sync_queue', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  operation: text('operation').notNull(),
  tableName: text('table_name').notNull(),
  recordId: text('record_id').notNull(),
  payload: text('payload', { mode: 'json' }),
  synced: integer('synced', { mode: 'boolean' }).default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }),
});
```

---

## 🎨 Content Manifest Structure

```json
{
  "version": "1.0.0",
  "lastUpdated": "2026-01-15T00:00:00Z",
  "modules": [
    {
      "id": "module-001",
      "title": "Introduction to Programming",
      "description": "Learn the fundamentals of programming",
      "thumbnail": "assets/thumbnails/module-001.webp",
      "lessons": [
        {
          "id": "lesson-001-01",
          "title": "What is Programming?",
          "type": "video",
          "duration": 600,
          "asset": "assets/videos/lesson-001-01.mp4",
          "hash": "sha256:abc123..."
        },
        {
          "id": "lesson-001-02",
          "title": "Setting Up Your Environment",
          "type": "reading",
          "asset": "assets/pdfs/lesson-001-02.pdf",
          "hash": "sha256:def456..."
        },
        {
          "id": "lesson-001-quiz",
          "title": "Module 1 Quiz",
          "type": "quiz",
          "questions": [...]
        }
      ]
    }
  ]
}
```

---

## 🤖 AI Tutor Integration (Ollama)

### Architecture

```
┌─────────────────────────────────────────┐
│           AI Tutor Service              │
│  (packages/backend/ai-tutor/src)        │
├─────────────────────────────────────────┤
│  - Context Management                   │
│  - Prompt Engineering                   │
│  - Streaming Response Handler           │
│  - Session Management                   │
└────────────────┬────────────────────────┘
                 │ HTTP (localhost:11434)
                 ▼
┌─────────────────────────────────────────┐
│              Ollama Service             │
│         (Local LLM Runtime)             │
├─────────────────────────────────────────┤
│  Supported Models:                      │
│  - llama3.2 (Default)                   │
│  - mistral                              │
│  - phi3                                 │
│  - Custom fine-tuned models             │
└─────────────────────────────────────────┘
```

### Features
- **Streaming Responses**: Real-time token-by-token delivery for responsive UX
- **Context Injection**: Automatic injection of current lesson content
- **Session Memory**: Conversation history maintained throughout session
- **Graceful Degradation**: Friendly fallback when Ollama is unavailable

---

## 📦 Installer Configuration (NSIS)

```javascript
// apps/desktop/electron-builder.config.js

module.exports = {
  appId: 'com.navgurukul.offlinelearning',
  productName: 'Offline Learning App',
  
  win: {
    target: 'nsis',
    icon: 'installer-assets/icon.ico',
  },
  
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: false,
    installerIcon: 'installer-assets/icon.ico',
    uninstallerIcon: 'installer-assets/icon.ico',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    
    // Silent install support
    allowElevation: true,
    perMachine: true,
    
    // Custom installation script
    include: 'installer-assets/installer.nsh',
  },
  
  extraResources: [
    {
      from: 'installer-assets/content',
      to: 'content',
    },
  ],
  
  // Data persistence location
  directories: {
    output: 'release',
  },
};
```

### File System Layout (Post-Installation)

```
C:\Program Files\Offline Learning App\
├── OfflineLearningApp.exe
├── resources/
│   ├── app.asar              # Bundled application code
│   └── content/              # Bundled content (read-only)

C:\ProgramData\OfflineLearningApp\
├── data.db                    # SQLite database (read/write)
├── content/
│   ├── manifest.json          # Content manifest
│   └── assets/                # Videos, PDFs, images
└── logs/                      # Application logs
```

---

## 🔄 Data Synchronization Architecture

### Sync Queue Mechanism

```typescript
// Sync flow when connectivity is restored

1. Application Startup
   └── Check network connectivity
       └── If online:
           └── Query sync_queue WHERE synced = false
               └── For each record:
                   ├── POST to central server (idempotent upsert)
                   ├── On success: UPDATE synced = true
                   └── On failure: Retry with exponential backoff

2. Data Modification (Offline)
   └── Write to local database
       └── INSERT into sync_queue
           └── Await next sync opportunity
```

### AI Summary Generation

```typescript
// Configurable interval (default: 10 days)
// Generates learning progress summary via local LLM

interface LearningProgress {
  modulesStarted: number;
  modulesCompleted: number;
  totalWatchTime: number;
  totalReadTime: number;
  averageQuizScore: number;
  aiSummary: string;      // Generated by Ollama
  lastSummaryAt: Date;
}
```

---

## 🧪 Development & Build Commands

```powershell
# Install dependencies
pnpm install

# Development mode (hot-reload)
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Build all packages
pnpm build

# Generate Windows installer
pnpm build:installer

# Run database migrations
pnpm --filter @backend/db migrate
```

---

## 📋 System Requirements

| Requirement | Minimum | Recommended |
|:---|:---|:---|
| **Operating System** | Windows 10 (64-bit) | Windows 11 |
| **RAM** | 4 GB | 8 GB |
| **Storage** | 2 GB + Content | 10 GB + Content |
| **Display** | 1366 × 768 | 1920 × 1080 |
| **AI Tutor (Optional)** | 8 GB RAM, 6 GB VRAM | 16 GB RAM, 8 GB VRAM |

---

## 📞 Contact & Support

**Developed by**: NavGurukul Technology Team  
**Platform Version**: 1.0.0  
**Last Updated**: February 2026

---

*This document covers the complete technical and business capabilities of the AFE Learning Platform. For implementation details or customization inquiries, please contact the development team.*
