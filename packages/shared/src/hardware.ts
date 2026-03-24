import os from 'os';
import { execSync } from 'child_process';

let isLowEndMemo: boolean | null = null;

export function isLowEndDevice(): boolean {
    if (isLowEndMemo !== null) return isLowEndMemo;

    const totalRamGB = os.totalmem() / (1024 * 1024 * 1024);
    const is4GBOrLess = totalRamGB <= 4.5; // Catch 4GB devices which report ~3.8GB

    if (!is4GBOrLess) {
        isLowEndMemo = false;
        return false;
    }

    // Now check for GPU.
    let hasDedicatedGPU = false;
    try {
        if (process.platform === 'win32') {
            // wmic works synchronously to get video controllers on Windows
            const stdout = execSync('wmic path win32_VideoController get name', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            const lowerOutput = stdout.toLowerCase();
            
            // Typical dedicated GPUs: NVIDIA, RTX, GTX, Radeon RX
            // Typical integrated: Intel, UHD, HD Graphics, Microsoft Basic Display
            if (lowerOutput.includes('nvidia') || lowerOutput.includes('radeon rx') || lowerOutput.includes('geforce')) {
                hasDedicatedGPU = true;
            }
        }
        else if (process.platform === 'darwin') {
            const stdout = execSync('system_profiler SPDisplaysDataType', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            if (stdout.toLowerCase().includes('amd radeon') || stdout.toLowerCase().includes('nvidia')) {
                hasDedicatedGPU = true;
            }
        }
        else {
            // Linux
            const stdout = execSync('lspci | grep -i vga', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
            if (stdout.toLowerCase().includes('nvidia') || stdout.toLowerCase().includes('radeon')) {
                hasDedicatedGPU = true;
            }
        }
    } catch {
        // Ignore errors in exec, default to no GPU
    }

    isLowEndMemo = is4GBOrLess && !hasDedicatedGPU;
    return isLowEndMemo;
}
