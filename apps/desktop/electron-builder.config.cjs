module.exports = {
    appId: 'com.navgurukul.AFE',
    productName: 'Amazon Future Engineer',
    copyright: 'Copyright © 2026',

    // Directories
    directories: {
        output: 'release',
        buildResources: 'build',
    },

    // Files to include
    files: [
        'dist/**/*',
        'package.json',
        {
            from: '../renderer/dist',
            to: 'renderer/dist',
            filter: ['**/*'],
        },
    ],

    // Bundle STT and TTS binaries/models
    extraResources: [
        {
            from: '../../packages/backend/stt-engine',
            to: 'stt',
            filter: ['**/*', '!node_modules/**', '!tsconfig.json', '!tsconfig.tsbuildinfo'],
        },
        {
            from: '../../packages/backend/tts-engine',
            to: 'tts',
            filter: ['**/*', '!node_modules/**', '!tsconfig.json', '!tsconfig.tsbuildinfo'],
        },
        {
            from: '../../installer-assets',
            to: 'dev-data',
            filter: ['**/*'],
        },
    ],

    // Skip code signing (no certificate configured)
    forceCodeSigning: false,

    win: {
        target: [
            {
                target: 'nsis-web',
                arch: ['x64'],
            },
        ],
    },
    mac: {
        target: ['dmg'],
        category: 'public.app-category.education',
    },
    linux: {
        target: ['AppImage', 'deb'],
        category: 'Education',
    },

    // NSIS installer configuration (CRITICAL for silent install)
    nsis: {
        oneClick: false, // Allow custom install directory
        allowToChangeInstallationDirectory: false, // Fixed install path
        perMachine: true, // System-wide installation (NOT per-user)

        // Silent install support
        allowElevation: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,

        // CRITICAL: Enable silent install with /S flag
        // This allows: OfflineLearningApp-Setup.exe /S
        include: 'build/installer-script.nsh', // Custom NSIS script (optional)
        // Installer language
        language: '1033', // English

        // Uninstall support
        deleteAppDataOnUninstall: false, // Keep data in ProgramData
        warningsAsErrors: false, // Allow non-critical NSIS warnings
    },

    // Publish configuration (disabled for offline app)
    publish: [
        {
            provider: 'github',
            owner: 'navgurukul',
            repo: 'AFE-Learning-App'
        }
    ],

    // Metadata
    compression: 'maximum',
    artifactName: '${productName}-Setup-${version}.${ext}',
};
