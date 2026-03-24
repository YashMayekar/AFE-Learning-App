import log from 'electron-log';
import path from 'path';
import { PATHS } from './paths.js';

/**
 * Initialize the logging system
 */
export function initializeLogger() {
    // Configure file transport
    log.transports.file.resolvePathFn = () => path.join(PATHS.LOGS_DIR, 'main.log');
    
    // Set log level (usually 'info' for production)
    log.transports.file.level = 'info';
    log.transports.console.level = 'debug';

    // Format logs
    log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

    // Max file size: 10MB, keep 5 files
    log.transports.file.maxSize = 10 * 1024 * 1024;
    
    // Redirect console functions to electron-log
    // This captures logs from all imported modules and the main process
    Object.assign(console, log.functions);

    console.info('📝 Logger initialized');
    console.info('📂 Logs directory:', PATHS.LOGS_DIR);
}

export default log;
