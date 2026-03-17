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
    files: ['dist/**/*', 'package.json'],

    // Skip code signing (no certificate configured)
    forceCodeSigning: false,

    win: {
        target: [
            {
                target: 'nsis',
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
    publish: null,

    // Metadata
    compression: 'maximum',
    artifactName: '${productName}-Setup-${version}.${ext}',
};
