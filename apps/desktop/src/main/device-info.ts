import os from 'os';
import fs from 'fs';
import path from 'path';
import { app, dialog, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { DeviceInfo } from '@afe/shared';

const execAsync = promisify(exec);

// Re-export for convenience
export type { DeviceInfo };

export interface Config {
    ngoKey: string;
    partnerName?: string;
    schoolName?: string;
    schoolUdise?: string | null;
    state?: string;
    district?: string;
    locationPermissionStatus?: 'granted' | 'denied';
}

// Config file path
const CONFIG_PATH = app.isPackaged
    ? path.join(app.getPath('appData'), 'OfflineLearningApp', 'config.json')
    : path.join(process.cwd(), '../dev-data/config.json');

/**
 * Get device serial number cross-platform
 */
async function getSerialNumber(): Promise<string> {
    try {
        if (process.platform === 'win32') {
            const { stdout } = await execAsync('wmic bios get serialnumber');
            const lines = stdout.trim().split('\n');
            return lines[1]?.trim() || 'UNKNOWN-SERIAL';
        } else if (process.platform === 'darwin') {
            const { stdout } = await execAsync(
                "ioreg -l | grep IOPlatformSerialNumber | awk '{print $4}' | sed 's/\"//g'"
            );
            return stdout.trim() || 'UNKNOWN-SERIAL';
        } else if (process.platform === 'linux') {
            try {
                return fs.readFileSync('/sys/class/dmi/id/product_serial', 'utf8').trim();
            } catch (e) {
                const { stdout } = await execAsync('cat /var/lib/dbus/machine-id');
                return stdout.trim() || 'UNKNOWN-SERIAL';
            }
        }
        return 'UNKNOWN-SERIAL';
    } catch (error) {
        console.error('[DeviceInfo] Failed to get serial number:', error);
        return 'UNKNOWN-SERIAL';
    }
}

/**
 * Get MAC address cross-platform using Node os module
 */
async function getMacAddress(): Promise<string> {
    try {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            const ifaces = interfaces[name];
            if (!ifaces) continue;

            for (const iface of ifaces) {
                // Skip internal (loopback) and virtual interfaces without MAC
                if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
                    return iface.mac.replace(/-/g, ':');
                }
            }
        }
        return 'UNKNOWN-MAC';
    } catch (error) {
        console.error('[DeviceInfo] Failed to get MAC address:', error);
        return 'UNKNOWN-MAC';
    }
}

/**
 * Read config file
 */
function readConfig(): Required<Config> {
    const defaultConfig: Required<Config> = {
        ngoKey: 'D3F41T-K37',
        partnerName: 'sama',
        schoolName: 'sama',
        schoolUdise: null,
        state: '',
        district: '',
        locationPermissionStatus: 'granted'
    };

    try {
        if (!fs.existsSync(CONFIG_PATH)) {
            console.warn(`[DeviceInfo] Config file not found at ${CONFIG_PATH}, creating with defaults`);
            writeConfig(defaultConfig);
            return defaultConfig;
        }

        const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const config: Config = JSON.parse(content);
        return {
            ngoKey: config.ngoKey || defaultConfig.ngoKey,
            partnerName: config.partnerName || defaultConfig.partnerName,
            schoolName: config.schoolName || defaultConfig.schoolName,
            schoolUdise: config.schoolUdise !== undefined ? config.schoolUdise : defaultConfig.schoolUdise,
            state: config.state !== undefined ? config.state : defaultConfig.state,
            district: config.district !== undefined ? config.district : defaultConfig.district,
            locationPermissionStatus: config.locationPermissionStatus || defaultConfig.locationPermissionStatus
        };
    } catch (error) {
        console.error('[DeviceInfo] Failed to read config:', error);
        return defaultConfig;
    }
}

/**
 * Write config file
 */
export function writeConfig(config: Partial<Config>): void {
    try {
        const configDir = path.dirname(CONFIG_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        let existing: Partial<Config> = {};
        if (fs.existsSync(CONFIG_PATH)) {
            try {
                existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            } catch (e) {}
        }

        const newConfig = { ...existing, ...config };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf-8');
        console.log(`[DeviceInfo] Config written to ${CONFIG_PATH}`);
    } catch (error) {
        console.error('[DeviceInfo] Failed to write config:', error);
    }
}

/**
 * Backward compatibility helper for writeNGOKey
 */
export function writeNGOKey(ngoKey: string): void {
    writeConfig({ ngoKey });
}

/**
 * Get complete device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
    const [serialNumber, macAddress] = await Promise.all([
        getSerialNumber(),
        getMacAddress(),
    ]);

    const config = readConfig();

    const deviceInfo: DeviceInfo = {
        serialNumber,
        macAddress,
        appVersion: app.getVersion(),
        partnerName: 'sama',
        ngoKey: config.ngoKey,
        schoolName: 'sama',
        schoolUdise: null,
        state: config.state,
        district: config.district
    };

    console.log('[DeviceInfo] Device fingerprint:', deviceInfo);
    return deviceInfo;
}

/**
 * Check if config exists
 */
export function hasConfig(): boolean {
    return fs.existsSync(CONFIG_PATH);
}

/**
 * Prompts user for location permission once on install/first run
 */
export function checkLocationPermissionAndPrompt(parentWindow: BrowserWindow): void {
    try {
        const config = readConfig();
        
        // Only ask if locationPermissionStatus is not set in config.json
        const isPermissionUnset = !fs.existsSync(CONFIG_PATH) || (() => {
            try {
                const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
                const parsed = JSON.parse(content);
                return parsed.locationPermissionStatus === undefined;
            } catch (e) { return true; }
        })();

        if (isPermissionUnset) {
            console.log('[DeviceInfo] Location permission is unset. Prompting user...');
            const choice = dialog.showMessageBoxSync(parentWindow, {
                type: 'question',
                buttons: ['Allow', 'Deny'],
                defaultId: 0,
                cancelId: 1,
                title: 'Location Access Request',
                message: 'Allow Amazon Future Engineer App to access your location to automatically determine your State and District?',
                detail: 'This is only asked once. Location is resolved automatically when the app has network connectivity during sync, and stored locally for offline tracking.',
            });

            const status = choice === 0 ? 'granted' : 'denied';
            writeConfig({ locationPermissionStatus: status });
            console.log(`[DeviceInfo] Location permission status set to: ${status}`);
        }
    } catch (e) {
        console.error('[DeviceInfo] Failed to check/prompt location permission:', e);
    }
}

/**
 * Resolves location using a free IP geolocation API if permission is granted but location is empty.
 * Runs in the background when sync starts.
 */
export async function updateLocationFromIP(fetchFn: any): Promise<void> {
    try {
        const config = readConfig();
        if (config.locationPermissionStatus === 'granted' && (!config.state || !config.district)) {
            console.log('[DeviceInfo] Location permission is granted but state/district is empty. Fetching live location...');
            
            let state = '';
            let district = '';
            
            // Try ipinfo.io first (often more accurate)
            try {
                const response = await fetchFn('https://ipinfo.io/json');
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.region && data.city) {
                        state = data.region;
                        district = data.city;
                        console.log(`[DeviceInfo] Resolved location via ipinfo.io: State="${state}", District="${district}"`);
                    }
                }
            } catch (err) {
                console.warn('[DeviceInfo] Failed to fetch from ipinfo.io, trying fallback:', err);
            }

            // Fallback to ip-api.com if ipinfo failed
            if (!state || !district) {
                try {
                    const response = await fetchFn('http://ip-api.com/json/');
                    if (response.ok) {
                        const data = await response.json();
                        if (data && data.status === 'success') {
                            state = data.regionName || '';
                            district = data.city || '';
                            console.log(`[DeviceInfo] Resolved location via ip-api.com fallback: State="${state}", District="${district}"`);
                        }
                    }
                } catch (err) {
                    console.error('[DeviceInfo] Fallback ip-api.com check failed:', err);
                }
            }

            if (state || district) {
                writeConfig({ state, district });
                console.log(`[DeviceInfo] Geolocation retrieved successfully: State="${state}", District="${district}"`);
            } else {
                console.warn('[DeviceInfo] Could not resolve geolocation from any provider.');
            }
        }
    } catch (error) {
        console.error('[DeviceInfo] Error during IP geolocation check:', error);
    }
}
