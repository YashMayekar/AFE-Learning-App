import os from 'os';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
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
    schoolUdise?: string;
    state?: string;
    district?: string;
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
        partnerName: 'Sama',
        schoolName: 'Sama NGO Center',
        schoolUdise: '12345678901',
        state: 'Karnataka',
        district: 'Bangalore Urban'
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
            schoolUdise: config.schoolUdise || defaultConfig.schoolUdise,
            state: config.state || defaultConfig.state,
            district: config.district || defaultConfig.district
        };
    } catch (error) {
        console.error('[DeviceInfo] Failed to read config:', error);
        return defaultConfig;
    }
}

/**
 * Write config file
 */
export function writeConfig(config: Config): void {
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
        ...config
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
