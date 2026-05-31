import { app, BrowserWindow, protocol, net, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { ensureDirectories, getDatabasePath, hasContentManifest, PATHS, APP_DATA_ROOT, getSttRoot, getTtsRoot } from './paths.js';
import { isLowEndDevice } from '@afe/shared/hardware';
import { initializeDatabase } from '@backend/db';
import { loadContentManifest } from '@backend/content-engine';
import { registerIPCHandlers } from '../ipc/handlers.js';
import { syncContentToDatabase } from './content-sync.js';
import { SyncService, DailySyncService, checkAndGenerateSummaries, initializeAnalytics } from '@backend/analytics';
import { initializeAiTutor } from '@backend/ai-tutor';
import { getDeviceInfo } from './device-info.js';
import { init as initSTT } from '@backend/stt-engine';
import { init as initTTS } from '@backend/tts-engine';
import { initializeLogger } from './logger.js';

// 0. Initialize logger at the very beginning
initializeLogger();

// 1. Enforce memory limits for low RAM (4GB) laptops without GPUs
if (isLowEndDevice()) {
    console.log('🤖 Applied Low-End Device Memory Restrictions (Max 512MB RAM)');
    app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');
}

/**
 * Convert Windows paths to file: URLs for net.fetch
 */
const toFileUrl = (filePath: string) => {
    let pathName = path.resolve(filePath).replace(/\\/g, '/');
    if (!pathName.startsWith('/')) {
        pathName = '/' + pathName;
    }
    return `file://${pathName}`;
};

// Register custom protocol privileges
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'media',
        privileges: {
            secure: true,
            supportFetchAPI: true,
            bypassCSP: true,
            stream: true,
        },
    },
]);

let mainWindow: BrowserWindow | null = null;

/**
 * Create main application window
 */
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        title: 'Amazon Future Engineer',
        webPreferences: {
            // CRITICAL SECURITY: Disable Node integration in renderer
            nodeIntegration: false,
            // CRITICAL SECURITY: Enable context isolation
            contextIsolation: true,
            // Preload script for secure IPC bridge
            preload: path.join(__dirname, '../preload/secure.cjs'),
        },
    });

    // Load renderer UI
    if (app.isPackaged) {
        // Production: load built files
        mainWindow.loadFile(path.join(__dirname, '../../renderer/dist/index.html'));
    } else {
        // Development: load from Vite dev server
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

/**
 * Initialize application
 */
async function initialize() {
    console.log('🚀 Initializing Offline Learning App...');
    console.log('Environment:', {
        platform: process.platform,
        arch: process.arch,
        version: app.getVersion(),
        node: process.version,
        userData: app.getPath('userData'),
        isPackaged: app.isPackaged
    });

    // 1. Ensure data directories exist
    console.log('📁 Setting up data directories...');
    ensureDirectories();

    // 2. Handle initial content seeding
    const prodManifestPath = PATHS.MANIFEST;
    if (app.isPackaged) {
        // Production: copy bundled dev-data to AppData on first run
        if (!fs.existsSync(prodManifestPath)) {
            console.log('📦 First run detected. Seeding bundled content...');
            const bundledDevData = path.join(process.resourcesPath, 'dev-data');
            if (fs.existsSync(bundledDevData)) {
                try {
                    fs.cpSync(bundledDevData, PATHS.ROOT, { recursive: true });
                    console.log(`✓ Copied initial content from bundled dev-data to ${PATHS.ROOT}`);
                } catch (error) {
                    console.error('❌ Failed to copy bundled dev-data:', error);
                }
            } else {
                console.warn('⚠️  Bundled dev-data not found at:', bundledDevData);
            }
        }
    } else {
        // Development: copy manifest from installer-assets if it exists
        const devManifestPath = path.join(app.getAppPath(), '../../installer-assets/content/manifest.json');
        const prodManifestDir = PATHS.CONTENT_DIR;

        if (fs.existsSync(devManifestPath)) {
            try {
                if (!fs.existsSync(prodManifestDir)) {
                    fs.mkdirSync(prodManifestDir, { recursive: true });
                }
                fs.copyFileSync(devManifestPath, prodManifestPath);
                console.log(`✓ Copied manifest from installer-assets to ${prodManifestPath}`);
            } catch (error) {
                console.error('❌ Failed to copy manifest from installer-assets:', error);
            }
        } else {
            console.warn('⚠️  Dev manifest not found at:', devManifestPath);
        }
    }

    // 2. Initialize database
    console.log('💾 Initializing database...');
    try {
        const dbPath = getDatabasePath();
        console.log(`Database path: ${dbPath}`);
        initializeDatabase(dbPath);
        
        // CRITICAL: Initialize other services that might have their own copy of @backend/db
        console.log('Initializing Analytics and AI Tutor DB...');
        initializeAnalytics(dbPath);
        initializeAiTutor(dbPath, APP_DATA_ROOT);

        console.log('✓ Database initialized successfully');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        app.quit();
        return;
    }

    // 3. Check for content manifest and SYNC to DB
    if (!hasContentManifest()) {
        console.warn(
            `⚠️  No content manifest found. Please ensure content is installed in ${PATHS.CONTENT_DIR}`
        );
    } else {
        console.log('✓ Content manifest found');
        try {
            const manifest = loadContentManifest(APP_DATA_ROOT);
            await syncContentToDatabase(manifest);
        } catch (error) {
            console.error('❌ Failed to sync content manifest:', error);
            // We don't quit, maybe partial functionality works?
        }
    }

    // 4. Initialize STT and TTS engines
    console.log('🎤 Initializing STT engine...');
    const sttRoot = getSttRoot();
    initSTT(sttRoot);
    console.log('✓ STT engine initialized at:', sttRoot);

    console.log('🔊 Initializing TTS engine...');
    const ttsRoot = getTtsRoot();
    initTTS(ttsRoot);
    console.log('✓ TTS engine initialized at:', ttsRoot);

    // 5. Register IPC handlers
    console.log('🔌 Registering IPC handlers...');
    registerIPCHandlers();
    console.log('✓ IPC handlers registered');

    // 5. Launch background sync worker (NON-BLOCKING)
    console.log('🚀 Launching background sync worker...');
    console.log('✅ App initialization complete (sync running in background)');

    // Run sync in background (non-blocking)
    (async () => {
        try {
            if (isLowEndDevice()) {
                console.log('🤖 Scheduling AI summary generation (background, delayed by 60s for low-end device)...');
                setTimeout(async () => {
                    console.log('🤖 Starting delayed AI summary generation (background)...');
                    // await checkAndGenerateSummaries(getDatabasePath());
                    console.log('✓ AI summaries generated');
                }, 60000);
            } else {
                console.log('🤖 Starting AI summary generation (background)...');
                // await checkAndGenerateSummaries(getDatabasePath());
                console.log('✓ AI summaries generated');
            }

            // Create daily snapshots
            console.log('📸 Creating daily snapshots...');
            const deviceInfo = await getDeviceInfo();
            const dailySyncService = new DailySyncService(deviceInfo, getDatabasePath());
            const snapshotsCreated = await dailySyncService.createSnapshots();
            console.log(`✓ Created ${snapshotsCreated} snapshots`);

            // Sync to RMS server
            const serverUrl = process.env.CENTRALIZED_SERVER_URL || 'http://localhost:3000/api/afe';
            console.log(`🌐 Syncing to ${serverUrl}...`);

            const syncService = new SyncService(serverUrl, net.fetch);

            // Validate NGO key first
            const validation = await syncService.validateNGOKey(deviceInfo.ngoKey);
            if (!validation.valid) {
                console.error(`❌ NGO key validation failed: ${validation.error}`);
                return;
            }
            console.log(`✓ NGO key validated: ${validation.ngoName} (ID: ${validation.ngoId})`);

            // Sync data
            const result = await syncService.syncToServer(deviceInfo);
            if (result.success) {
                console.log(`✓ Synced ${result.syncedCount} snapshots to server`);
            } else {
                console.warn('⚠️  Sync failed (will retry next startup)');
            }
        } catch (error) {
            console.error('❌ Background sync failed:', error);
        }
    })();
}

// App lifecycle

app.whenReady().then(async () => {
    // Allow microphone/camera for STT; log to see exact permission strings
    const ses = session.defaultSession;
    const allowMedia = (p: string) =>
        p === 'media' || p === 'mediaKeySystem' || p === 'fullscreen' || p.includes('media') || p.includes('microphone') || p.includes('fullscreen');
    ses.setPermissionCheckHandler((_, permission) => {
        const allow = allowMedia(permission);
        console.log('[Electron] Permission check:', permission, '->', allow);
        return allow;
    });
    ses.setPermissionRequestHandler((_, permission, callback) => {
        const allow = allowMedia(permission);
        console.log('[Electron] Permission request:', permission, '->', allow);
        callback(allow);
    });

    // Register 'media' protocol to serve videos securely from APP_DATA
    protocol.handle('media', (request) => {
        const url = request.url.replace('media://', '');
        // Decode URL to handle spaces etc
        const decodedPath = decodeURIComponent(url);

        // Construct absolute path to the file
        // Manifest paths are relative to APP_DATA_ROOT (e.g. "assets/videos/foo.mp4")
        let assetPath = path.join(PATHS.ROOT, decodedPath);

        // In development, if the file doesn't exist in dev-data/assets, fallback to installer-assets/assets
        if (!app.isPackaged && !fs.existsSync(assetPath)) {
            const devFallbackPath = path.join(app.getAppPath(), '../../installer-assets', decodedPath);
            if (fs.existsSync(devFallbackPath)) {
                assetPath = devFallbackPath;
            }
        }

        // Security check: Ensure we are serving from the ASSETS directory
        // This prevents access to DB or other sensitive files
        const devAssetsDir = path.join(app.getAppPath(), '../../installer-assets/assets');
        const isAllowed = assetPath.startsWith(PATHS.ASSETS_DIR) || 
            (!app.isPackaged && assetPath.startsWith(devAssetsDir));

        if (!isAllowed) {
            console.error('Blocked access to non-asset path:', assetPath);
            return new Response('Access Denied', { status: 403 });
        }

        // If file doesn't exist, return 404
        if (!fs.existsSync(assetPath)) {
            return new Response('Not Found', { status: 404 });
        }

        const stat = fs.statSync(assetPath);
        const rangeHeader = request.headers.get('range');

        // Determine content type dynamically
        let contentType = 'application/octet-stream';
        const ext = path.extname(assetPath).toLowerCase();
        if (ext === '.mp4') {
            contentType = 'video/mp4';
        } else if (ext === '.pdf') {
            contentType = 'application/pdf';
        } else if (ext === '.png') {
            contentType = 'image/png';
        } else if (ext === '.jpg' || ext === '.jpeg') {
            contentType = 'image/jpeg';
        } else if (ext === '.webp') {
            contentType = 'image/webp';
        }

        if (rangeHeader) {
            // Parse Range: bytes=start-end
            const parts = rangeHeader.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            
            const chunksize = (end - start) + 1;
            const fileStream = fs.createReadStream(assetPath, { start, end });

            return new Response(fileStream as any, {
                status: 206,
                headers: {
                    'Content-Range': `bytes ${start}-${end}/${stat.size}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize.toString(),
                    'Content-Type': contentType
                }
            });
        } else {
            const fileStream = fs.createReadStream(assetPath);
            return new Response(fileStream as any, {
                status: 200,
                headers: {
                    'Content-Length': stat.size.toString(),
                    'Content-Type': contentType
                }
            });
        }
    });

    await initialize();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    // On Windows, apps typically quit when all windows are closed
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('quit', () => {
    console.log('👋 Application shutting down');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
});
