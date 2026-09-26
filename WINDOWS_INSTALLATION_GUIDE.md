# AFE Learning App Windows Installation Guide

This is the authoritative Windows setup guide for the Amazon Future Engineer
(AFE) Learning App in this repository. It covers both normal installation from
a released installer and building the application from source.

## 1. Choose the Correct Setup

| Goal | Use |
| --- | --- |
| Run the application as a student, teacher, or deployment operator | **Released installer** |
| Develop, test, or create a new installer | **Build from source** |

The released installer is the normal path. End users do not need Node.js,
pnpm, Git, Python, Visual Studio, or the repository.

## 2. Supported Windows Devices

The Windows installer currently targets **64-bit x86 (x64)** machines.

Supported:

- Windows 10 or Windows 11, 64-bit
- Intel or AMD x64 processors
- A working microphone for voice input
- At least 2 GB RAM; 4 GB or more is recommended
- Enough free disk space for the application, bundled media, and local data

Not supported by the current Windows installer:

- 32-bit x86 Windows
- Windows ARM64 devices
- Running the Windows installer under emulation as a supported deployment

The app is CPU-first for speech processing. More RAM and CPU cores improve
voice and AI response times, but a GPU is not required.

## 3. Install from a Released Installer

### 3.1 Obtain the installer

Use the installer supplied by the project release or deployment administrator.
The filename follows this pattern:

```text
Amazon Future Engineer-Setup-<version>.exe
```

For the v1.3.2 release, the expected filename is:

```text
Amazon Future Engineer-Setup-1.3.2.exe
```

Do not use an old installer when a newer release is available. Release notes
are historical; this guide follows the current source and packaging
configuration.

### 3.2 Interactive installation

1. Close any older copy of the application.
2. Right-click the installer and choose **Run as administrator**.
3. Approve the Windows elevation prompt.
4. Complete the NSIS installation wizard.
5. Start **Amazon Future Engineer** from the Start menu or desktop shortcut.

The current installer is a per-machine x64 installation. Its application files
are installed under the Windows Program Files directory. The installer is
configured with administrator elevation and a fixed installation location.

### 3.3 Silent installation

Open an elevated Command Prompt or PowerShell window, change to the directory
containing the installer, and run:

```powershell
Start-Process -FilePath ".\Amazon Future Engineer-Setup-1.3.2.exe" -ArgumentList "/S" -Wait
```

From an elevated Command Prompt, this also works:

```cmd
"Amazon Future Engineer-Setup-1.3.2.exe" /S
```

The `/S` option runs the NSIS installer without the normal wizard UI. The
installer configuration does not support choosing a custom installation
directory; use the configured system-wide location.

### 3.4 First launch

On first launch the application creates its local directories, initializes the
SQLite database, copies the bundled content for the installed version, loads
the content manifest, and warms local AI/speech services in the background.

The first launch can take longer on a low-end computer. A missing Ollama
service must not prevent normal offline learning features from opening.

## 4. Optional Ollama AI Tutor Setup

Ollama is required only for the local text and voice AI tutor. Videos, PDFs,
quizzes, student profiles, progress tracking, and local analytics do not
require Ollama.

1. Install Ollama for Windows from [ollama.com](https://ollama.com).
2. Open PowerShell and verify that the command is available:

```powershell
ollama --version
```

3. Install the default lightweight tutor model:

```powershell
ollama pull qwen2.5:1.5b
```

4. Confirm that the model is installed:

```powershell
ollama list
```

Ollama normally runs locally at `http://127.0.0.1:11434`. If it is not
running, the application remains usable and the AI tutor reports that the
local service is unavailable. Start Ollama and relaunch the application when
AI features are needed.

The application checks installed models in this order:

```text
qwen2.5:1.5b
qwen2.5-coder:7b
qwen2.5:7b
llama3.2:3b
llama3.1:8b
gemma3:4b
```

The 1.5B model is the recommended starting point for shared or lower-powered
Windows laptops. Larger models require substantially more memory and may make
the application feel slow.

## 5. Offline Behavior and Network Use

After installation, the learning content is local. The following work without
internet access:

- Video lessons
- PDF/readable lessons
- Quizzes and quiz results
- Student profiles and progress
- Local SQLite analytics
- Sherpa-ONNX speech recognition when the bundled assets are present
- Piper speech synthesis when its bundled Windows assets are present

Internet is optional for:

- Downloading the installer and Ollama models
- Synchronizing queued learning sessions with the configured RMS server
- Location lookup used by telemetry when permission is granted
- Background update checks in packaged builds

If synchronization fails or the computer is offline, session data remains
local and is retried later. Do not delete the application data directory when
preserving local student progress.

## 6. Data and Log Locations

For a packaged Windows installation, Electron resolves the application data
root from its Windows `appData` directory. On a typical Windows account this
is:

```text
%APPDATA%\OfflineLearningApp\
```

The exact absolute path can be opened in Explorer by entering `%APPDATA%` in
the address bar. Important files and directories include:

```text
%APPDATA%\OfflineLearningApp\data.db
%APPDATA%\OfflineLearningApp\config.json
%APPDATA%\OfflineLearningApp\content\manifest.json
%APPDATA%\OfflineLearningApp\assets\
%APPDATA%\OfflineLearningApp\logs\
%APPDATA%\OfflineLearningApp\rag\
```

This location is tied to the Windows user account that launches the app. The
current source does not use `C:\ProgramData` for packaged runtime data, so do
not expect data to be automatically shared between separate Windows accounts.

The database contains student profiles, progress, quiz attempts, chat history,
and locally queued analytics. Back up this directory before manually removing
or troubleshooting an installation.

The application package and bundled speech/runtime assets are stored below the
installed application's `resources` directory, not in the user data directory.

## 7. Updating and Uninstalling

### Updating

Install the newer released installer over the existing installation. The app
seeds content for the new application version while retaining the local data
root. Verify student progress after the first launch of the new version.

Packaged builds also perform a background update check when configured with a
published release. An update check is not a substitute for obtaining the
correct installer when distributing the application to new devices.

### Uninstalling

Use **Settings > Apps > Installed apps** or the application's uninstaller.

Before uninstalling, back up:

```text
%APPDATA%\OfflineLearningApp\
```

The current NSIS configuration enables `deleteAppDataOnUninstall`, so do not
assume that uninstalling preserves `%APPDATA%\OfflineLearningApp`. Back up
the directory before uninstalling, removing a Windows profile, or replacing
the device.

## 8. Troubleshooting the Installed App

### The app does not start

1. Restart Windows and try again.
2. Launch the installed application as administrator once.
3. Confirm that the device is Windows x64.
4. Check the application logs under `%APPDATA%\OfflineLearningApp\logs\`.
5. Reinstall the latest x64 installer without deleting the data directory.

### Content or videos are missing

Check that these paths exist:

```text
%APPDATA%\OfflineLearningApp\content\manifest.json
%APPDATA%\OfflineLearningApp\assets\
```

If the manifest is missing after an update, close the app, run the latest
installer again as administrator, and relaunch it. Do not manually edit the
manifest unless you are maintaining the content package.

### AI tutor is unavailable

Run:

```powershell
ollama list
```

If Ollama is not installed or `qwen2.5:1.5b` is absent, install it as shown in
section 4. The rest of the learning app should continue to work without AI.

### Voice input is unavailable

Check Windows microphone permissions and verify that another application is not
holding the microphone. The active STT runtime is Sherpa-ONNX, using 16 kHz
mono audio. The selected model can be changed during development, but a normal
released installation should use its bundled default assets.

### Voice output is missing

Piper is the intended offline TTS engine. If its Windows binary or model cannot
be loaded, the application may fall back to the browser speech synthesis API.
This can produce a different voice and quality. Check the application logs and
reinstall the latest package if the bundled assets are missing.

## 9. Build and Package from Source

This section is for developers and deployment maintainers. Run all commands
from the repository root.

### 9.1 Required tools

Install:

- Git
- Node.js **20.x LTS**; the repository requires `>=20 <21`
- pnpm **9.15.4** (the repository package manager)
- Visual Studio Build Tools 2022 with **Desktop development with C++**
- Windows SDK included with the C++ workload
- Ollama, only if testing AI features

Node.js 24 is outside the repository engine range and can fail while building
the native `better-sqlite3` dependency. Do not use it for this project.

Verify the toolchain:

```powershell
node --version
pnpm --version
git --version
```

The Node version must begin with `v20.`. Install the exact package manager
version if necessary:

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
```

### 9.2 Clone and install

```powershell
git clone https://github.com/navgurukul/AFE-Learning-App.git
Set-Location .\AFE-Learning-App
pnpm install
```

`pnpm install` runs the repository `postinstall` hook, including Electron native
module rebuilding. If it fails while compiling `better-sqlite3`, verify Node
20.x and the Visual Studio C++ workload before retrying.

### 9.3 Validate and run in development

```powershell
pnpm typecheck
pnpm lint
pnpm dev
```

Development uses the repository's `dev-data` directory for its database,
manifest, and assets. It does not use the packaged Windows data location.

The development speech assets are read from
`packages/backend/stt-engine/` and `packages/backend/tts-engine/`. Some
optional or experimental speech models are not included in every checkout.

### 9.4 Build the Windows installer

```powershell
pnpm build
pnpm build:installer
```

The Windows NSIS artifact is written to:

```text
apps\desktop\release\
```

The artifact name follows:

```text
Amazon Future Engineer-Setup-<version>.exe
```

The package is configured for Windows x64 only. Test the generated installer
on a clean x64 Windows machine before distributing it.

### 9.5 Optional GitHub publishing

Publishing requires repository release permissions and the appropriate GitHub
credentials. Do not use this command for a local build:

```powershell
pnpm publish:installer
```

## 10. Developer Speech Model Selection

The current STT implementation is Sherpa-ONNX. The old Whisper-based setup
described in older architecture and TTS documents is not the active default
runtime.

For development, supported selections include:

```powershell
$env:STT_MODEL = "english"
pnpm --filter desktop dev

$env:STT_MODEL = "indian-english"
pnpm --filter desktop dev

$env:STT_MODEL = "sravaani-onnx"
pnpm --filter desktop dev

$env:STT_MODEL = "sravaani-live"
pnpm --filter desktop dev
```

`english` and `indian-english` use streaming Sherpa models. `sravaani-onnx`
produces a final transcript after recording. `sravaani-live` can provide live
captions but requires its compatible model files.

The SraVaani offline pipeline may require Python dependencies listed in
`packages/backend/stt-engine/requirements-sravaani.txt`; it is not required
for the standard released installation.

## 11. What Not to Use as Installation Instructions

The repository contains historical engineering, architecture, performance,
macOS, and handover documents. They are useful for background, but may mention
older components or paths. In particular:

- Do not install Whisper just because an older document mentions it.
- Do not use Node.js 24 for this repository.
- Do not assume packaged data is in `C:\ProgramData\OfflineLearningApp`; the
  current source uses Electron's `%APPDATA%\OfflineLearningApp` path.
- Do not use obsolete `wmic` commands; the current Windows device code uses
  PowerShell CIM queries.
- Do not install Python for a normal packaged installation; it is only relevant
  to optional development pipelines such as SraVaani ONNX.

## 12. Installation Completion Checklist

- [ ] Device is Windows 10/11 x64.
- [ ] Latest `Amazon Future Engineer-Setup-<version>.exe` was used.
- [ ] Installer completed with administrator approval.
- [ ] App opens from the Start menu or desktop shortcut.
- [ ] A student profile can be created or selected.
- [ ] A video, reading, and quiz can be opened.
- [ ] `%APPDATA%\OfflineLearningApp\data.db` exists after first launch.
- [ ] Ollama and `qwen2.5:1.5b` are installed if AI tutoring is required.
- [ ] Microphone permissions are enabled if voice input is required.
- [ ] Local data is backed up before uninstalling or replacing the device.
