.
├── AFE_Developer_Guide.md
├── AFE_Interactive_Demo_and_Architecture_Guide.md
├── AFE_Session_Tracking_Architecture.md
├── ARCHITECTURE.md
├── HAN_DOVER_AFE.md
├── LATENCY_MEASUREMENT_GUIDE.md
├── MACOS_INTEL_OFFLINE_SPEECH_LIMITATIONS.md
├── NEW_MODULE_INTEGRATION_GUIDE.md
├── Platform_Capabilities.md
├── README.md
├── RELEASE_NOTES.md
├── RELEASE_v1.3.2.md
├── STT_ACCURACY_INTEL_ANALYSIS.md
├── STT_COMPLETE_WORK_HISTORY.md
├── STT_KEYBOARD_SHORTCUT_CHANGES.md
├── STT_KEY_CHALLENGES_AND_SOLUTIONS.md
├── STT_PERFORMANCE_CHANGES.md
├── STT_SYSTEM_IMPLEMENTATION_GUIDE_FOR_AI.md
├── SYSTEM_ISSUES_REPORT.md
├── WINDOWS_INSTALLATION_GUIDE.md
├── apps
│   ├── desktop
│   │   ├── dist
│   │   │   ├── ipc
│   │   │   │   ├── handlers.d.ts
│   │   │   │   └── handlers.js
│   │   │   ├── main
│   │   │   │   ├── content-sync.d.ts
│   │   │   │   ├── content-sync.js
│   │   │   │   ├── device-info.d.ts
│   │   │   │   ├── device-info.js
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.js
│   │   │   │   ├── logger.d.ts
│   │   │   │   ├── logger.js
│   │   │   │   ├── mkv-parser.d.ts
│   │   │   │   ├── mkv-parser.js
│   │   │   │   ├── mp4-parser.d.ts
│   │   │   │   ├── mp4-parser.js
│   │   │   │   ├── paths.d.ts
│   │   │   │   ├── paths.js
│   │   │   │   ├── session-manager.d.ts
│   │   │   │   └── session-manager.js
│   │   │   └── preload
│   │   │       ├── secure.cjs
│   │   │       └── secure.d.cts
│   │   ├── electron-builder.config.cjs
│   │   ├── node_modules
│   │   │   ├── @afe
│   │   │   │   └── shared -> ../../../../packages/shared
│   │   │   ├── @backend
│   │   │   │   ├── ai-tutor -> ../../../../packages/backend/ai-tutor
│   │   │   │   ├── analytics -> ../../../../packages/backend/analytics
│   │   │   │   ├── content-engine -> ../../../../packages/backend/content-engine
│   │   │   │   ├── db -> ../../../../packages/backend/db
│   │   │   │   ├── rag-engine -> ../../../../packages/backend/rag-engine
│   │   │   │   ├── stt-engine -> ../../../../packages/backend/stt-engine
│   │   │   │   └── tts-engine -> ../../../../packages/backend/tts-engine
│   │   │   ├── @types
│   │   │   │   └── node -> ../../../../node_modules/.pnpm/@types+node@20.19.43/node_modules/@types/node
│   │   │   ├── better-sqlite3 -> ../../../node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3
│   │   │   ├── bindings -> ../../../node_modules/.pnpm/bindings@1.5.0/node_modules/bindings
│   │   │   ├── builder-util-runtime -> ../../../node_modules/.pnpm/builder-util-runtime@9.7.0/node_modules/builder-util-runtime
│   │   │   ├── concurrently -> ../../../node_modules/.pnpm/concurrently@8.2.2/node_modules/concurrently
│   │   │   ├── cross-env -> ../../../node_modules/.pnpm/cross-env@10.1.0/node_modules/cross-env
│   │   │   ├── drizzle-orm -> ../../../node_modules/.pnpm/drizzle-orm@0.29.5_@types+better-sqlite3@7.6.13_@types+react@18.3.31_better-sqlite3@9.6.0_react@18.3.1/node_modules/drizzle-orm
│   │   │   ├── electron -> ../../../node_modules/.pnpm/electron@28.3.3/node_modules/electron
│   │   │   ├── electron-builder -> ../../../node_modules/.pnpm/electron-builder@24.13.3_electron-builder-squirrel-windows@24.13.3/node_modules/electron-builder
│   │   │   ├── electron-log -> ../../../node_modules/.pnpm/electron-log@5.4.4/node_modules/electron-log
│   │   │   ├── electron-updater -> ../../../node_modules/.pnpm/electron-updater@6.8.9/node_modules/electron-updater
│   │   │   ├── file-uri-to-path -> ../../../node_modules/.pnpm/file-uri-to-path@2.0.0/node_modules/file-uri-to-path
│   │   │   ├── fs-extra -> ../../../node_modules/.pnpm/fs-extra@11.4.0/node_modules/fs-extra
│   │   │   ├── js-yaml -> ../../../node_modules/.pnpm/js-yaml@5.4.2/node_modules/js-yaml
│   │   │   ├── lazy-val -> ../../../node_modules/.pnpm/lazy-val@1.0.5/node_modules/lazy-val
│   │   │   ├── lodash.escaperegexp -> ../../../node_modules/.pnpm/lodash.escaperegexp@4.1.2/node_modules/lodash.escaperegexp
│   │   │   ├── lodash.isequal -> ../../../node_modules/.pnpm/lodash.isequal@4.5.0/node_modules/lodash.isequal
│   │   │   ├── node-record-lpcm16 -> ../../../node_modules/.pnpm/node-record-lpcm16@1.0.1/node_modules/node-record-lpcm16
│   │   │   ├── ollama -> ../../../node_modules/.pnpm/ollama@0.5.18/node_modules/ollama
│   │   │   ├── pdf-parse -> ../../../node_modules/.pnpm/pdf-parse@1.1.4/node_modules/pdf-parse
│   │   │   ├── prebuild-install -> ../../../node_modules/.pnpm/prebuild-install@7.1.3/node_modules/prebuild-install
│   │   │   ├── semver -> ../../../node_modules/.pnpm/semver@7.8.5/node_modules/semver
│   │   │   ├── tiny-typed-emitter -> ../../../node_modules/.pnpm/tiny-typed-emitter@2.1.0/node_modules/tiny-typed-emitter
│   │   │   ├── typescript -> ../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   ├── whatwg-fetch -> ../../../node_modules/.pnpm/whatwg-fetch@3.6.20/node_modules/whatwg-fetch
│   │   │   └── zod -> ../../../node_modules/.pnpm/zod@3.25.76/node_modules/zod
│   │   ├── package.json
│   │   ├── src
│   │   │   ├── ipc
│   │   │   │   └── handlers.ts
│   │   │   ├── main
│   │   │   │   ├── content-sync.ts
│   │   │   │   ├── device-info.ts
│   │   │   │   ├── external.d.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── logger.ts
│   │   │   │   ├── mkv-parser.ts
│   │   │   │   ├── mp4-parser.ts
│   │   │   │   ├── paths.ts
│   │   │   │   └── session-manager.ts
│   │   │   └── preload
│   │   │       └── secure.cjs
│   │   ├── tsconfig.json
│   │   └── tsconfig.tsbuildinfo
│   ├── dev-data
│   │   └── config.json
│   ├── poc
│   │   └── sherpa-stt
│   │       ├── models
│   │       │   └── tokens.txt
│   │       ├── test-online.js
│   │       ├── test.js
│   │       ├── wer-test-indian.mjs
│   │       └── wer-test.mjs
│   └── renderer
│       ├── dist
│       │   ├── assets
│       │   │   ├── index-Biy0pB79.css
│       │   │   └── index-BuT11qz-.js
│       │   ├── index.html
│       │   ├── pdf.worker.min.mjs
│       │   ├── pdf.worker.wrapper.mjs
│       │   └── stt-worklet.js
│       ├── index.html
│       ├── node_modules
│       │   ├── @afe
│       │   │   └── shared -> ../../../../packages/shared
│       │   ├── @remix-run
│       │   │   └── router -> ../../../../node_modules/.pnpm/@remix-run+router@1.23.4/node_modules/@remix-run/router
│       │   ├── @types
│       │   │   ├── react -> ../../../../node_modules/.pnpm/@types+react@18.3.31/node_modules/@types/react
│       │   │   └── react-dom -> ../../../../node_modules/.pnpm/@types+react-dom@18.3.7_@types+react@18.3.31/node_modules/@types/react-dom
│       │   ├── @vitejs
│       │   │   └── plugin-react -> ../../../../node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@20.19.43_/node_modules/@vitejs/plugin-react
│       │   ├── react -> ../../../node_modules/.pnpm/react@18.3.1/node_modules/react
│       │   ├── react-dom -> ../../../node_modules/.pnpm/react-dom@18.3.1_react@18.3.1/node_modules/react-dom
│       │   ├── react-markdown -> ../../../node_modules/.pnpm/react-markdown@10.1.0_@types+react@18.3.31_react@18.3.1/node_modules/react-markdown
│       │   ├── react-pdf -> ../../../node_modules/.pnpm/react-pdf@10.5.0_@types+react@18.3.31_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/react-pdf
│       │   ├── react-router -> ../../../node_modules/.pnpm/react-router@6.30.6_react@18.3.1/node_modules/react-router
│       │   ├── react-router-dom -> ../../../node_modules/.pnpm/react-router-dom@6.30.6_react-dom@18.3.1_react@18.3.1__react@18.3.1/node_modules/react-router-dom
│       │   ├── remark-gfm -> ../../../node_modules/.pnpm/remark-gfm@4.0.1/node_modules/remark-gfm
│       │   ├── typescript -> ../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│       │   └── vite -> ../../../node_modules/.pnpm/vite@5.4.21_@types+node@20.19.43/node_modules/vite
│       ├── package.json
│       ├── public
│       │   ├── pdf.worker.min.mjs
│       │   ├── pdf.worker.wrapper.mjs
│       │   └── stt-worklet.js
│       ├── src
│       │   ├── App.tsx
│       │   ├── components
│       │   │   ├── AITutor.tsx
│       │   │   ├── ConfirmModal.tsx
│       │   │   ├── FeedbackSurveyModal.tsx
│       │   │   ├── PDFViewer.tsx
│       │   │   ├── QuizViewer.tsx
│       │   │   ├── VideoPlayer.tsx
│       │   │   ├── VoiceOrb.css
│       │   │   └── VoiceOrb.tsx
│       │   ├── env.d.ts
│       │   ├── lib
│       │   │   ├── ipc.ts
│       │   │   └── mediaCleanup.ts
│       │   ├── main.tsx
│       │   ├── pages
│       │   │   ├── AILearningCenter.tsx
│       │   │   ├── AvatarSelection.tsx
│       │   │   ├── BeginLearning.tsx
│       │   │   ├── ModuleDetail.tsx
│       │   │   ├── StudentDashboard.tsx
│       │   │   ├── useStreamingSTT.ts
│       │   │   └── useVoiceMode.ts
│       │   └── styles
│       │       └── neo-brutalism.css
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── vite.config.ts.timestamp-1774356446318-7a79b4d913c3e.mjs
├── dev-data
│   ├── assets
│   │   ├── avatars
│   │   │   └── README.md
│   │   ├── readables
│   │   │   └── Python-Tutorial.pdf
│   │   └── videos
│   │       ├── README.md
│   │       ├── chatgpt-basics.mp4
│   │       ├── google-docs-part1.mp4
│   │       ├── laptop-basics.mp4
│   │       └── python-video.mp4
│   ├── content
│   │   └── manifest.json
│   ├── data.db
│   ├── data.db-shm
│   ├── data.db-wal
│   ├── logs
│   │   ├── main copy.log
│   │   ├── main.log
│   │   ├── main.old.log
│   │   └── script.zsh
│   └── rag
│       ├── rag-index.db
│       ├── rag-index.db-shm
│       ├── rag-index.db-wal
│       └── rag-vectors.hnsw
├── folder-tree.txt
├── installer-assets
│   ├── assets
│   │   ├── avatars
│   │   │   └── README.md
│   │   ├── readables
│   │   │   └── Python-Tutorial.pdf
│   │   └── videos2
│   │       └── README.md
│   └── content
│       └── manifest.json
├── node_modules
│   ├── @electron
│   │   └── rebuild -> ../.pnpm/@electron+rebuild@4.2.0/node_modules/@electron/rebuild
│   ├── @eslint
│   │   ├── eslintrc -> ../.pnpm/@eslint+eslintrc@2.1.4/node_modules/@eslint/eslintrc
│   │   └── js -> ../.pnpm/@eslint+js@8.57.1/node_modules/@eslint/js
│   ├── @eslint-community
│   │   ├── eslint-utils -> ../.pnpm/@eslint-community+eslint-utils@4.10.1_eslint@8.57.1/node_modules/@eslint-community/eslint-utils
│   │   └── regexpp -> ../.pnpm/@eslint-community+regexpp@4.12.2/node_modules/@eslint-community/regexpp
│   ├── @types
│   │   └── node -> ../.pnpm/@types+node@20.19.43/node_modules/@types/node
│   ├── @typescript-eslint
│   │   ├── eslint-plugin -> ../.pnpm/@typescript-eslint+eslint-plugin@6.21.0_@typescript-eslint+parser@6.21.0_eslint@8.57.1_typesc_gzbyut7go2tyzgipl5ponv5dva/node_modules/@typescript-eslint/eslint-plugin
│   │   ├── parser -> ../.pnpm/@typescript-eslint+parser@6.21.0_eslint@8.57.1_typescript@5.9.3/node_modules/@typescript-eslint/parser
│   │   ├── scope-manager -> ../.pnpm/@typescript-eslint+scope-manager@6.21.0/node_modules/@typescript-eslint/scope-manager
│   │   ├── type-utils -> ../.pnpm/@typescript-eslint+type-utils@6.21.0_eslint@8.57.1_typescript@5.9.3/node_modules/@typescript-eslint/type-utils
│   │   ├── types -> ../.pnpm/@typescript-eslint+types@6.21.0/node_modules/@typescript-eslint/types
│   │   ├── typescript-estree -> ../.pnpm/@typescript-eslint+typescript-estree@6.21.0_typescript@5.9.3/node_modules/@typescript-eslint/typescript-estree
│   │   ├── utils -> ../.pnpm/@typescript-eslint+utils@6.21.0_eslint@8.57.1_typescript@5.9.3/node_modules/@typescript-eslint/utils
│   │   └── visitor-keys -> ../.pnpm/@typescript-eslint+visitor-keys@6.21.0/node_modules/@typescript-eslint/visitor-keys
│   ├── eslint -> .pnpm/eslint@8.57.1/node_modules/eslint
│   ├── eslint-plugin-react -> .pnpm/eslint-plugin-react@7.37.5_eslint@8.57.1/node_modules/eslint-plugin-react
│   ├── eslint-plugin-react-hooks -> .pnpm/eslint-plugin-react-hooks@4.6.2_eslint@8.57.1/node_modules/eslint-plugin-react-hooks
│   ├── eslint-scope -> .pnpm/eslint-scope@7.2.2/node_modules/eslint-scope
│   ├── eslint-visitor-keys -> .pnpm/eslint-visitor-keys@3.4.3/node_modules/eslint-visitor-keys
│   ├── prettier -> .pnpm/prettier@3.9.7/node_modules/prettier
│   ├── sherpa-onnx-node -> .pnpm/sherpa-onnx-node@1.13.8/node_modules/sherpa-onnx-node
│   └── typescript -> .pnpm/typescript@5.9.3/node_modules/typescript
├── ollama_performance_analysis.md
├── package-lock.json
├── package.json
├── packages
│   ├── backend
│   │   ├── ai-tutor
│   │   │   ├── dist
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   ├── ollamaQueue.d.ts
│   │   │   │   ├── ollamaQueue.d.ts.map
│   │   │   │   ├── ollamaQueue.js
│   │   │   │   ├── prompts.d.ts
│   │   │   │   ├── prompts.d.ts.map
│   │   │   │   └── prompts.js
│   │   │   ├── node_modules
│   │   │   │   ├── @afe
│   │   │   │   │   └── shared -> ../../../../shared
│   │   │   │   ├── @backend
│   │   │   │   │   ├── content-engine -> ../../../content-engine
│   │   │   │   │   ├── db -> ../../../db
│   │   │   │   │   └── rag-engine -> ../../../rag-engine
│   │   │   │   ├── drizzle-orm -> ../../../../node_modules/.pnpm/drizzle-orm@0.29.5_@types+better-sqlite3@7.6.13_@types+react@18.3.31_better-sqlite3@9.6.0_react@18.3.1/node_modules/drizzle-orm
│   │   │   │   ├── ollama -> ../../../../node_modules/.pnpm/ollama@0.5.18/node_modules/ollama
│   │   │   │   └── typescript -> ../../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   ├── package-lock.json
│   │   │   ├── package.json
│   │   │   ├── src
│   │   │   │   ├── index.ts
│   │   │   │   ├── ollamaQueue.ts
│   │   │   │   └── prompts.ts
│   │   │   ├── tsconfig.json
│   │   │   └── tsconfig.tsbuildinfo
│   │   ├── analytics
│   │   │   ├── dist
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   ├── sync.d.ts
│   │   │   │   ├── sync.d.ts.map
│   │   │   │   ├── sync.js
│   │   │   │   ├── types.d.ts
│   │   │   │   ├── types.d.ts.map
│   │   │   │   └── types.js
│   │   │   ├── node_modules
│   │   │   │   ├── @afe
│   │   │   │   │   └── shared -> ../../../../shared
│   │   │   │   ├── @backend
│   │   │   │   │   ├── ai-tutor -> ../../../ai-tutor
│   │   │   │   │   └── db -> ../../../db
│   │   │   │   ├── @types
│   │   │   │   │   └── uuid -> ../../../../../node_modules/.pnpm/@types+uuid@11.0.0/node_modules/@types/uuid
│   │   │   │   ├── drizzle-orm -> ../../../../node_modules/.pnpm/drizzle-orm@0.29.5_@types+better-sqlite3@7.6.13_@types+react@18.3.31_better-sqlite3@9.6.0_react@18.3.1/node_modules/drizzle-orm
│   │   │   │   ├── typescript -> ../../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   │   └── uuid -> ../../../../node_modules/.pnpm/uuid@13.0.2/node_modules/uuid
│   │   │   ├── package.json
│   │   │   ├── src
│   │   │   │   ├── index.ts
│   │   │   │   ├── sync.ts
│   │   │   │   └── types.ts
│   │   │   ├── tsconfig.json
│   │   │   └── tsconfig.tsbuildinfo
│   │   ├── content-engine
│   │   │   ├── dist
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   └── schemas
│   │   │   │       ├── manifest.d.ts
│   │   │   │       ├── manifest.d.ts.map
│   │   │   │       └── manifest.js
│   │   │   ├── node_modules
│   │   │   │   ├── typescript -> ../../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   │   └── zod -> ../../../../node_modules/.pnpm/zod@3.25.76/node_modules/zod
│   │   │   ├── package.json
│   │   │   ├── src
│   │   │   │   ├── index.ts
│   │   │   │   └── schemas
│   │   │   │       └── manifest.ts
│   │   │   ├── tsconfig.json
│   │   │   └── tsconfig.tsbuildinfo
│   │   ├── db
│   │   │   ├── dist
│   │   │   │   ├── core.d.ts
│   │   │   │   ├── core.d.ts.map
│   │   │   │   ├── core.js
│   │   │   │   ├── exports.d.ts
│   │   │   │   ├── exports.d.ts.map
│   │   │   │   ├── exports.js
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   ├── schema
│   │   │   │   │   ├── index.d.ts
│   │   │   │   │   ├── index.d.ts.map
│   │   │   │   │   └── index.js
│   │   │   │   └── services
│   │   │   │       ├── progress.d.ts
│   │   │   │       ├── progress.d.ts.map
│   │   │   │       ├── progress.js
│   │   │   │       ├── sessions.d.ts
│   │   │   │       ├── sessions.d.ts.map
│   │   │   │       ├── sessions.js
│   │   │   │       ├── students.d.ts
│   │   │   │       ├── students.d.ts.map
│   │   │   │       └── students.js
│   │   │   ├── drizzle
│   │   │   │   ├── 0000_round_synch.sql
│   │   │   │   ├── 0001_sparkling_blockbuster.sql
│   │   │   │   ├── 0002_lonely_ghost_rider.sql
│   │   │   │   ├── 0003_sudden_white_tiger.sql
│   │   │   │   ├── 0004_kind_bloodstorm.sql
│   │   │   │   ├── 0005_thin_sway.sql
│   │   │   │   ├── 0006_overjoyed_silver_fox.sql
│   │   │   │   ├── 0007_illegal_strong_guy.sql
│   │   │   │   ├── 0008_clammy_purifiers.sql
│   │   │   │   ├── 0009_many_cerebro.sql
│   │   │   │   ├── 0010_happy_silverclaw.sql
│   │   │   │   └── meta
│   │   │   │       ├── 0000_snapshot.json
│   │   │   │       ├── 0001_snapshot.json
│   │   │   │       ├── 0002_snapshot.json
│   │   │   │       ├── 0003_snapshot.json
│   │   │   │       ├── 0004_snapshot.json
│   │   │   │       ├── 0005_snapshot.json
│   │   │   │       ├── 0006_snapshot.json
│   │   │   │       ├── 0007_snapshot.json
│   │   │   │       ├── 0008_snapshot.json
│   │   │   │       ├── 0009_snapshot.json
│   │   │   │       ├── 0010_snapshot.json
│   │   │   │       └── _journal.json
│   │   │   ├── drizzle.config.json
│   │   │   ├── node_modules
│   │   │   │   ├── @types
│   │   │   │   │   └── better-sqlite3 -> ../../../../../node_modules/.pnpm/@types+better-sqlite3@7.6.13/node_modules/@types/better-sqlite3
│   │   │   │   ├── better-sqlite3 -> ../../../../node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3
│   │   │   │   ├── drizzle-kit -> ../../../../node_modules/.pnpm/drizzle-kit@0.20.18/node_modules/drizzle-kit
│   │   │   │   ├── drizzle-orm -> ../../../../node_modules/.pnpm/drizzle-orm@0.29.5_@types+better-sqlite3@7.6.13_@types+react@18.3.31_better-sqlite3@9.6.0_react@18.3.1/node_modules/drizzle-orm
│   │   │   │   └── typescript -> ../../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   ├── package.json
│   │   │   ├── src
│   │   │   │   ├── core.ts
│   │   │   │   ├── exports.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── schema
│   │   │   │   │   └── index.ts
│   │   │   │   └── services
│   │   │   │       ├── progress.ts
│   │   │   │       ├── sessions.ts
│   │   │   │       └── students.ts
│   │   │   ├── tsconfig.json
│   │   │   └── tsconfig.tsbuildinfo
│   │   ├── rag-engine
│   │   │   ├── README.md
│   │   │   ├── dev-data
│   │   │   │   └── rag
│   │   │   │       ├── rag-index.db
│   │   │   │       └── rag-vectors.hnsw
│   │   │   ├── dist
│   │   │   │   ├── chunker.d.ts
│   │   │   │   ├── chunker.d.ts.map
│   │   │   │   ├── chunker.js
│   │   │   │   ├── context-merge.d.ts
│   │   │   │   ├── context-merge.d.ts.map
│   │   │   │   ├── context-merge.js
│   │   │   │   ├── embedder-worker.d.ts
│   │   │   │   ├── embedder-worker.d.ts.map
│   │   │   │   ├── embedder-worker.js
│   │   │   │   ├── embedder.d.ts
│   │   │   │   ├── embedder.d.ts.map
│   │   │   │   ├── embedder.js
│   │   │   │   ├── fusion.d.ts
│   │   │   │   ├── fusion.d.ts.map
│   │   │   │   ├── fusion.js
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   ├── ingest-cli.d.ts
│   │   │   │   ├── ingest-cli.d.ts.map
│   │   │   │   ├── ingest-cli.js
│   │   │   │   ├── remote-embedder.d.ts
│   │   │   │   ├── remote-embedder.d.ts.map
│   │   │   │   ├── remote-embedder.js
│   │   │   │   ├── runtime.d.ts
│   │   │   │   ├── runtime.d.ts.map
│   │   │   │   ├── runtime.js
│   │   │   │   ├── section-resolver.d.ts
│   │   │   │   ├── section-resolver.d.ts.map
│   │   │   │   ├── section-resolver.js
│   │   │   │   ├── store.d.ts
│   │   │   │   ├── store.d.ts.map
│   │   │   │   ├── store.js
│   │   │   │   ├── types.d.ts
│   │   │   │   ├── types.d.ts.map
│   │   │   │   ├── types.js
│   │   │   │   ├── vector-index.d.ts
│   │   │   │   ├── vector-index.d.ts.map
│   │   │   │   └── vector-index.js
│   │   │   ├── models
│   │   │   │   └── all-MiniLM-L6-v2
│   │   │   │       ├── README.md
│   │   │   │       ├── config.json
│   │   │   │       ├── onnx
│   │   │   │       │   ├── model.onnx
│   │   │   │       │   ├── model_bnb4.onnx
│   │   │   │       │   ├── model_fp16.onnx
│   │   │   │       │   ├── model_int8.onnx
│   │   │   │       │   ├── model_q4.onnx
│   │   │   │       │   ├── model_q4f16.onnx
│   │   │   │       │   ├── model_quantized.onnx
│   │   │   │       │   └── model_uint8.onnx
│   │   │   │       ├── special_tokens_map.json
│   │   │   │       ├── tokenizer.json
│   │   │   │       ├── tokenizer_config.json
│   │   │   │       └── vocab.txt
│   │   │   ├── node_modules
│   │   │   │   ├── @afe
│   │   │   │   │   └── shared -> ../../../../shared
│   │   │   │   ├── @types
│   │   │   │   │   ├── better-sqlite3 -> ../../../../../node_modules/.pnpm/@types+better-sqlite3@7.6.13/node_modules/@types/better-sqlite3
│   │   │   │   │   └── node -> ../../../../../node_modules/.pnpm/@types+node@20.19.43/node_modules/@types/node
│   │   │   │   ├── @xenova
│   │   │   │   │   └── transformers -> ../../../../../node_modules/.pnpm/@xenova+transformers@2.17.2/node_modules/@xenova/transformers
│   │   │   │   ├── better-sqlite3 -> ../../../../node_modules/.pnpm/better-sqlite3@9.6.0/node_modules/better-sqlite3
│   │   │   │   ├── hnswlib-node -> ../../../../node_modules/.pnpm/hnswlib-node@3.0.0/node_modules/hnswlib-node
│   │   │   │   ├── pdf-parse -> ../../../../node_modules/.pnpm/pdf-parse@1.1.4/node_modules/pdf-parse
│   │   │   │   ├── ts-node -> ../../../../node_modules/.pnpm/ts-node@10.9.2_@types+node@20.19.43_typescript@5.9.3/node_modules/ts-node
│   │   │   │   └── typescript -> ../../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│   │   │   ├── package.json
│   │   │   ├── rag.txt
│   │   │   ├── src
│   │   │   │   ├── chunker.ts
│   │   │   │   ├── context-merge.ts
│   │   │   │   ├── embedder-worker.ts
│   │   │   │   ├── embedder.ts
│   │   │   │   ├── external.d.ts
│   │   │   │   ├── fusion.ts
│   │   │   │   ├── index.ts
│   │   │   │   ├── ingest-cli.ts
│   │   │   │   ├── remote-embedder.ts
│   │   │   │   ├── runtime.ts
│   │   │   │   ├── section-resolver.ts
│   │   │   │   ├── store.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── vector-index.ts
│   │   │   ├── tsconfig.json
│   │   │   └── tsconfig.tsbuildinfo
│   │   ├── stt-engine
│   │   │   ├── README.md
│   │   │   ├── SraVaani-live-0.5-onnx-export-v2
│   │   │   │   ├── latency_0ms
│   │   │   │   │   ├── model.onnx
│   │   │   │   │   └── tokens.txt
│   │   │   │   ├── latency_1040ms
│   │   │   │   │   ├── model.onnx
│   │   │   │   │   └── tokens.txt
│   │   │   │   ├── latency_480ms
│   │   │   │   │   ├── model.onnx
│   │   │   │   │   └── tokens.txt
│   │   │   │   └── latency_80ms
│   │   │   │       ├── model.onnx
│   │   │   │       └── tokens.txt
│   │   │   ├── check.py
│   │   │   ├── debug-sravaani-live.ts
│   │   │   ├── dist
│   │   │   │   ├── debug-sravaani-live.d.ts
│   │   │   │   ├── debug-sravaani-live.d.ts.map
│   │   │   │   ├── debug-sravaani-live.js
│   │   │   │   ├── index.d.ts
│   │   │   │   ├── index.d.ts.map
│   │   │   │   ├── index.js
│   │   │   │   ├── live
│   │   │   │   │   ├── mel-frontend.d.ts
│   │   │   │   │   ├── mel-frontend.d.ts.map
│   │   │   │   │   ├── mel-frontend.js
│   │   │   │   │   ├── sravaani-live-onnx.d.ts
│   │   │   │   │   ├── sravaani-live-onnx.d.ts.map
│   │   │   │   │   └── sravaani-live-onnx.js
│   │   │   │   ├── sherpa.d.ts
│   │   │   │   ├── sherpa.d.ts.map
│   │   │   │   ├── sherpa.js
│   │   │   │   ├── sherpa.streaming-delta.test.d.ts
│   │   │   │   ├── sherpa.streaming-delta.test.d.ts.map
│   │   │   │   ├── sherpa.streaming-delta.test.js
│   │   │   │   └── tsconfig.tsbuildinfo
│   │   │   ├── download-model.sh
│   │   │   ├── index.ts
│   │   │   ├── live
│   │   │   │   ├── mel-frontend.ts
│   │   │   │   └── sravaani-live-onnx.ts
│   │   │   ├── node_modules
│   │   │   │   ├── @afe
│   │   │   │   │   └── shared -> ../../../../shared
│   │   │   │   ├── onnxruntime-node -> ../../../../node_modules/.pnpm/onnxruntime-node@1.23.2/node_modules/onnxruntime-node
│   │   │   │   └── sherpa-onnx-node -> ../../../../node_modules/.pnpm/sherpa-onnx-node@1.13.8/node_modules/sherpa-onnx-node
│   │   │   ├── package.json
│   │   │   ├── requirements-sravaani.txt
│   │   │   ├── sherpa-onnx-node.d.ts
│   │   │   ├── sherpa-onnx-streaming-zipformer-en-20M-2023-02-17
│   │   │   │   ├── README.md
│   │   │   │   ├── decoder-epoch-99-avg-1.int8.onnx
│   │   │   │   ├── decoder-epoch-99-avg-1.onnx
│   │   │   │   ├── encoder-epoch-99-avg-1.int8.onnx
│   │   │   │   ├── encoder-epoch-99-avg-1.onnx
│   │   │   │   ├── export-onnx-en-20M.sh
│   │   │   │   ├── joiner-epoch-99-avg-1.int8.onnx
│   │   │   │   ├── joiner-epoch-99-avg-1.onnx
│   │   │   │   ├── test_wavs
│   │   │   │   │   ├── 0.wav
│   │   │   │   │   ├── 1.wav
│   │   │   │   │   ├── 8k.wav
│   │   │   │   │   ├── trans.txt
│   │   │   │   │   ├── yash.wav
│   │   │   │   │   ├── yash1.wav
│   │   │   │   │   └── yash2.wav
│   │   │   │   └── tokens.txt
│   │   │   ├── sherpa-onnx-streaming-zipformer-indian-en
│   │   │   │   ├── bpe.model
│   │   │   │   ├── decoder-epoch-10-avg-5-chunk-64-left-256.int8.onnx
│   │   │   │   ├── encoder-epoch-10-avg-5-chunk-64-left-256.int8.onnx
│   │   │   │   ├── joiner-epoch-10-avg-5-chunk-64-left-256.int8.onnx
│   │   │   │   ├── test_wavs
│   │   │   │   │   ├── trans.txt
│   │   │   │   │   ├── yash.wav
│   │   │   │   │   ├── yash1.wav
│   │   │   │   │   └── yash2.wav
│   │   │   │   └── tokens.txt
│   │   │   ├── sherpa.streaming-delta.test.ts
│   │   │   ├── sherpa.ts
│   │   │   ├── sravaani_onnx
│   │   │   │   ├── ctc-sravaani.onnx
│   │   │   │   ├── decoder_joint-sravaani.onnx
│   │   │   │   ├── encoder-sravaani.onnx
│   │   │   │   ├── sravaani_onnx_infer.py
│   │   │   │   └── tokenizer.model
│   │   │   └── tsconfig.json
│   │   └── tts-engine
│   │       ├── README.md
│   │       ├── Spicor_with_indian_cloned.json
│   │       ├── dist
│   │       │   ├── index.d.ts
│   │       │   ├── index.d.ts.map
│   │       │   ├── index.js
│   │       │   └── tsconfig.tsbuildinfo
│   │       ├── epoch_1369_tech_indian_culture_30_sent.onnx
│   │       ├── espeak-ng-data
│   │       │   ├── af_dict
│   │       │   ├── am_dict
│   │       │   ├── an_dict
│   │       │   ├── ar_dict
│   │       │   ├── as_dict
│   │       │   ├── az_dict
│   │       │   ├── ba_dict
│   │       │   ├── be_dict
│   │       │   ├── bg_dict
│   │       │   ├── bn_dict
│   │       │   ├── bpy_dict
│   │       │   ├── bs_dict
│   │       │   ├── ca_dict
│   │       │   ├── chr_dict
│   │       │   ├── cmn_dict
│   │       │   ├── cs_dict
│   │       │   ├── cv_dict
│   │       │   ├── cy_dict
│   │       │   ├── da_dict
│   │       │   ├── de_dict
│   │       │   ├── el_dict
│   │       │   ├── en_dict
│   │       │   ├── eo_dict
│   │       │   ├── es_dict
│   │       │   ├── et_dict
│   │       │   ├── eu_dict
│   │       │   ├── fa_dict
│   │       │   ├── fi_dict
│   │       │   ├── fr_dict
│   │       │   ├── ga_dict
│   │       │   ├── gd_dict
│   │       │   ├── gn_dict
│   │       │   ├── grc_dict
│   │       │   ├── gu_dict
│   │       │   ├── hak_dict
│   │       │   ├── haw_dict
│   │       │   ├── he_dict
│   │       │   ├── hi_dict
│   │       │   ├── hr_dict
│   │       │   ├── ht_dict
│   │       │   ├── hu_dict
│   │       │   ├── hy_dict
│   │       │   ├── ia_dict
│   │       │   ├── id_dict
│   │       │   ├── intonations
│   │       │   ├── io_dict
│   │       │   ├── is_dict
│   │       │   ├── it_dict
│   │       │   ├── ja_dict
│   │       │   ├── jbo_dict
│   │       │   ├── ka_dict
│   │       │   ├── kk_dict
│   │       │   ├── kl_dict
│   │       │   ├── kn_dict
│   │       │   ├── ko_dict
│   │       │   ├── kok_dict
│   │       │   ├── ku_dict
│   │       │   ├── ky_dict
│   │       │   ├── la_dict
│   │       │   ├── lang
│   │       │   │   ├── aav
│   │       │   │   │   ├── vi
│   │       │   │   │   ├── vi-VN-x-central
│   │       │   │   │   └── vi-VN-x-south
│   │       │   │   ├── art
│   │       │   │   │   ├── eo
│   │       │   │   │   ├── ia
│   │       │   │   │   ├── io
│   │       │   │   │   ├── jbo
│   │       │   │   │   ├── lfn
│   │       │   │   │   ├── piqd
│   │       │   │   │   ├── py
│   │       │   │   │   ├── qdb
│   │       │   │   │   ├── qya
│   │       │   │   │   └── sjn
│   │       │   │   ├── azc
│   │       │   │   │   └── nci
│   │       │   │   ├── bat
│   │       │   │   │   ├── lt
│   │       │   │   │   ├── ltg
│   │       │   │   │   └── lv
│   │       │   │   ├── bnt
│   │       │   │   │   ├── sw
│   │       │   │   │   └── tn
│   │       │   │   ├── ccs
│   │       │   │   │   └── ka
│   │       │   │   ├── cel
│   │       │   │   │   ├── cy
│   │       │   │   │   ├── ga
│   │       │   │   │   └── gd
│   │       │   │   ├── cus
│   │       │   │   │   └── om
│   │       │   │   ├── dra
│   │       │   │   │   ├── kn
│   │       │   │   │   ├── ml
│   │       │   │   │   ├── ta
│   │       │   │   │   └── te
│   │       │   │   ├── esx
│   │       │   │   │   └── kl
│   │       │   │   ├── eu
│   │       │   │   ├── gmq
│   │       │   │   │   ├── da
│   │       │   │   │   ├── is
│   │       │   │   │   ├── nb
│   │       │   │   │   └── sv
│   │       │   │   ├── gmw
│   │       │   │   │   ├── af
│   │       │   │   │   ├── de
│   │       │   │   │   ├── en
│   │       │   │   │   ├── en-029
│   │       │   │   │   ├── en-GB-scotland
│   │       │   │   │   ├── en-GB-x-gbclan
│   │       │   │   │   ├── en-GB-x-gbcwmd
│   │       │   │   │   ├── en-GB-x-rp
│   │       │   │   │   ├── en-US
│   │       │   │   │   ├── en-US-nyc
│   │       │   │   │   ├── lb
│   │       │   │   │   └── nl
│   │       │   │   ├── grk
│   │       │   │   │   ├── el
│   │       │   │   │   └── grc
│   │       │   │   ├── inc
│   │       │   │   │   ├── as
│   │       │   │   │   ├── bn
│   │       │   │   │   ├── bpy
│   │       │   │   │   ├── gu
│   │       │   │   │   ├── hi
│   │       │   │   │   ├── kok
│   │       │   │   │   ├── mr
│   │       │   │   │   ├── ne
│   │       │   │   │   ├── or
│   │       │   │   │   ├── pa
│   │       │   │   │   ├── sd
│   │       │   │   │   ├── si
│   │       │   │   │   └── ur
│   │       │   │   ├── ine
│   │       │   │   │   ├── hy
│   │       │   │   │   ├── hyw
│   │       │   │   │   └── sq
│   │       │   │   ├── ira
│   │       │   │   │   ├── fa
│   │       │   │   │   ├── fa-Latn
│   │       │   │   │   └── ku
│   │       │   │   ├── iro
│   │       │   │   │   └── chr
│   │       │   │   ├── itc
│   │       │   │   │   └── la
│   │       │   │   ├── jpx
│   │       │   │   │   └── ja
│   │       │   │   ├── ko
│   │       │   │   ├── map
│   │       │   │   │   └── haw
│   │       │   │   ├── miz
│   │       │   │   │   └── mto
│   │       │   │   ├── myn
│   │       │   │   │   └── quc
│   │       │   │   ├── poz
│   │       │   │   │   ├── id
│   │       │   │   │   ├── mi
│   │       │   │   │   └── ms
│   │       │   │   ├── qu
│   │       │   │   ├── roa
│   │       │   │   │   ├── an
│   │       │   │   │   ├── ca
│   │       │   │   │   ├── es
│   │       │   │   │   ├── es-419
│   │       │   │   │   ├── fr
│   │       │   │   │   ├── fr-BE
│   │       │   │   │   ├── fr-CH
│   │       │   │   │   ├── ht
│   │       │   │   │   ├── it
│   │       │   │   │   ├── pap
│   │       │   │   │   ├── pt
│   │       │   │   │   ├── pt-BR
│   │       │   │   │   └── ro
│   │       │   │   ├── sai
│   │       │   │   │   └── gn
│   │       │   │   ├── sem
│   │       │   │   │   ├── am
│   │       │   │   │   ├── ar
│   │       │   │   │   ├── he
│   │       │   │   │   └── mt
│   │       │   │   ├── sit
│   │       │   │   │   ├── cmn
│   │       │   │   │   ├── cmn-Latn-pinyin
│   │       │   │   │   ├── hak
│   │       │   │   │   ├── my
│   │       │   │   │   ├── yue
│   │       │   │   │   └── yue-Latn-jyutping
│   │       │   │   ├── tai
│   │       │   │   │   ├── shn
│   │       │   │   │   └── th
│   │       │   │   ├── trk
│   │       │   │   │   ├── az
│   │       │   │   │   ├── ba
│   │       │   │   │   ├── cv
│   │       │   │   │   ├── kk
│   │       │   │   │   ├── ky
│   │       │   │   │   ├── nog
│   │       │   │   │   ├── tk
│   │       │   │   │   ├── tr
│   │       │   │   │   ├── tt
│   │       │   │   │   ├── ug
│   │       │   │   │   └── uz
│   │       │   │   ├── urj
│   │       │   │   │   ├── et
│   │       │   │   │   ├── fi
│   │       │   │   │   ├── hu
│   │       │   │   │   └── smj
│   │       │   │   ├── zle
│   │       │   │   │   ├── be
│   │       │   │   │   ├── ru
│   │       │   │   │   ├── ru-LV
│   │       │   │   │   ├── ru-cl
│   │       │   │   │   └── uk
│   │       │   │   ├── zls
│   │       │   │   │   ├── bg
│   │       │   │   │   ├── bs
│   │       │   │   │   ├── hr
│   │       │   │   │   ├── mk
│   │       │   │   │   ├── sl
│   │       │   │   │   └── sr
│   │       │   │   └── zlw
│   │       │   │       ├── cs
│   │       │   │       ├── pl
│   │       │   │       └── sk
│   │       │   ├── lb_dict
│   │       │   ├── lfn_dict
│   │       │   ├── lt_dict
│   │       │   ├── lv_dict
│   │       │   ├── mi_dict
│   │       │   ├── mk_dict
│   │       │   ├── ml_dict
│   │       │   ├── mr_dict
│   │       │   ├── ms_dict
│   │       │   ├── mt_dict
│   │       │   ├── mto_dict
│   │       │   ├── my_dict
│   │       │   ├── nci_dict
│   │       │   ├── ne_dict
│   │       │   ├── nl_dict
│   │       │   ├── no_dict
│   │       │   ├── nog_dict
│   │       │   ├── om_dict
│   │       │   ├── or_dict
│   │       │   ├── pa_dict
│   │       │   ├── pap_dict
│   │       │   ├── phondata
│   │       │   ├── phondata-manifest
│   │       │   ├── phonindex
│   │       │   ├── phontab
│   │       │   ├── piqd_dict
│   │       │   ├── pl_dict
│   │       │   ├── pt_dict
│   │       │   ├── py_dict
│   │       │   ├── qdb_dict
│   │       │   ├── qu_dict
│   │       │   ├── quc_dict
│   │       │   ├── qya_dict
│   │       │   ├── ro_dict
│   │       │   ├── ru_dict
│   │       │   ├── sd_dict
│   │       │   ├── shn_dict
│   │       │   ├── si_dict
│   │       │   ├── sjn_dict
│   │       │   ├── sk_dict
│   │       │   ├── sl_dict
│   │       │   ├── smj_dict
│   │       │   ├── sq_dict
│   │       │   ├── sr_dict
│   │       │   ├── sv_dict
│   │       │   ├── sw_dict
│   │       │   ├── ta_dict
│   │       │   ├── te_dict
│   │       │   ├── th_dict
│   │       │   ├── tk_dict
│   │       │   ├── tn_dict
│   │       │   ├── tr_dict
│   │       │   ├── tt_dict
│   │       │   ├── ug_dict
│   │       │   ├── uk_dict
│   │       │   ├── ur_dict
│   │       │   ├── uz_dict
│   │       │   ├── vi_dict
│   │       │   ├── voices
│   │       │   │   └── !v
│   │       │   │       ├── Alex
│   │       │   │       ├── Alicia
│   │       │   │       ├── Andrea
│   │       │   │       ├── Andy
│   │       │   │       ├── Annie
│   │       │   │       ├── AnxiousAndy
│   │       │   │       ├── Demonic
│   │       │   │       ├── Denis
│   │       │   │       ├── Diogo
│   │       │   │       ├── Gene
│   │       │   │       ├── Gene2
│   │       │   │       ├── Henrique
│   │       │   │       ├── Hugo
│   │       │   │       ├── Jacky
│   │       │   │       ├── Lee
│   │       │   │       ├── Marco
│   │       │   │       ├── Mario
│   │       │   │       ├── Michael
│   │       │   │       ├── Mike
│   │       │   │       ├── Mr serious
│   │       │   │       ├── Nguyen
│   │       │   │       ├── Reed
│   │       │   │       ├── RicishayMax
│   │       │   │       ├── RicishayMax2
│   │       │   │       ├── RicishayMax3
│   │       │   │       ├── Storm
│   │       │   │       ├── Tweaky
│   │       │   │       ├── UniRobot
│   │       │   │       ├── adam
│   │       │   │       ├── anika
│   │       │   │       ├── anikaRobot
│   │       │   │       ├── announcer
│   │       │   │       ├── antonio
│   │       │   │       ├── aunty
│   │       │   │       ├── belinda
│   │       │   │       ├── benjamin
│   │       │   │       ├── boris
│   │       │   │       ├── caleb
│   │       │   │       ├── croak
│   │       │   │       ├── david
│   │       │   │       ├── ed
│   │       │   │       ├── edward
│   │       │   │       ├── edward2
│   │       │   │       ├── f1
│   │       │   │       ├── f2
│   │       │   │       ├── f3
│   │       │   │       ├── f4
│   │       │   │       ├── f5
│   │       │   │       ├── fast
│   │       │   │       ├── grandma
│   │       │   │       ├── grandpa
│   │       │   │       ├── gustave
│   │       │   │       ├── ian
│   │       │   │       ├── iven
│   │       │   │       ├── iven2
│   │       │   │       ├── iven3
│   │       │   │       ├── iven4
│   │       │   │       ├── john
│   │       │   │       ├── kaukovalta
│   │       │   │       ├── klatt
│   │       │   │       ├── klatt2
│   │       │   │       ├── klatt3
│   │       │   │       ├── klatt4
│   │       │   │       ├── klatt5
│   │       │   │       ├── klatt6
│   │       │   │       ├── linda
│   │       │   │       ├── m1
│   │       │   │       ├── m2
│   │       │   │       ├── m3
│   │       │   │       ├── m4
│   │       │   │       ├── m5
│   │       │   │       ├── m6
│   │       │   │       ├── m7
│   │       │   │       ├── m8
│   │       │   │       ├── marcelo
│   │       │   │       ├── max
│   │       │   │       ├── michel
│   │       │   │       ├── miguel
│   │       │   │       ├── mike2
│   │       │   │       ├── norbert
│   │       │   │       ├── pablo
│   │       │   │       ├── paul
│   │       │   │       ├── pedro
│   │       │   │       ├── quincy
│   │       │   │       ├── rob
│   │       │   │       ├── robert
│   │       │   │       ├── robosoft
│   │       │   │       ├── robosoft2
│   │       │   │       ├── robosoft3
│   │       │   │       ├── robosoft4
│   │       │   │       ├── robosoft5
│   │       │   │       ├── robosoft6
│   │       │   │       ├── robosoft7
│   │       │   │       ├── robosoft8
│   │       │   │       ├── sandro
│   │       │   │       ├── shelby
│   │       │   │       ├── steph
│   │       │   │       ├── steph2
│   │       │   │       ├── steph3
│   │       │   │       ├── travis
│   │       │   │       ├── victor
│   │       │   │       ├── whisper
│   │       │   │       ├── whisperf
│   │       │   │       └── zac
│   │       │   └── yue_dict
│   │       ├── espeak-ng.dll
│   │       ├── index.ts
│   │       ├── onnxruntime.dll
│   │       ├── onnxruntime_providers_shared.dll
│   │       ├── package.json
│   │       ├── piper_phonemize.dll
│   │       └── tsconfig.json
│   └── shared
│       ├── dist
│       │   ├── constants.d.ts
│       │   ├── constants.d.ts.map
│       │   ├── constants.js
│       │   ├── hardware.d.ts
│       │   ├── hardware.d.ts.map
│       │   ├── hardware.js
│       │   ├── index.d.ts
│       │   ├── index.d.ts.map
│       │   ├── index.js
│       │   ├── ipc
│       │   │   ├── contracts.d.ts
│       │   │   ├── contracts.d.ts.map
│       │   │   └── contracts.js
│       │   ├── latency.d.ts
│       │   ├── latency.d.ts.map
│       │   ├── latency.js
│       │   ├── sync-types.d.ts
│       │   ├── sync-types.d.ts.map
│       │   ├── sync-types.js
│       │   └── types
│       │       ├── index.d.ts
│       │       ├── index.d.ts.map
│       │       └── index.js
│       ├── node_modules
│       │   └── typescript -> ../../../node_modules/.pnpm/typescript@5.9.3/node_modules/typescript
│       ├── package.json
│       ├── src
│       │   ├── constants.d.ts
│       │   ├── constants.d.ts.map
│       │   ├── constants.js
│       │   ├── constants.ts
│       │   ├── hardware.ts
│       │   ├── index.d.ts
│       │   ├── index.d.ts.map
│       │   ├── index.js
│       │   ├── index.ts
│       │   ├── ipc
│       │   │   ├── contracts.d.ts
│       │   │   ├── contracts.d.ts.map
│       │   │   ├── contracts.js
│       │   │   └── contracts.ts
│       │   ├── latency.d.ts
│       │   ├── latency.d.ts.map
│       │   ├── latency.js
│       │   ├── latency.ts
│       │   ├── sync-types.d.ts
│       │   ├── sync-types.d.ts.map
│       │   ├── sync-types.js
│       │   ├── sync-types.ts
│       │   └── types
│       │       ├── index.d.ts
│       │       ├── index.d.ts.map
│       │       ├── index.js
│       │       └── index.ts
│       ├── tsconfig.json
│       └── tsconfig.tsbuildinfo
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── project_context.md
├── project_resource_audit.md
├── sherpa-onnx-node.d.ts
├── stt-diagnose.sh
├── stt-optimize.mjs
├── tsconfig.json
├── v
└── workflow.md

264 directories, 792 files
