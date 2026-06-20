export * from './core.js';
export * from './schema/index.js';
import * as schema from './schema/index.js';
export { schema };

// Export services
export * from './services/students.js';
export * from './services/progress.js';
export * from './services/sessions.js';

// Export Drizzle utilities
export { eq, and, or, sql, desc, asc, inArray } from 'drizzle-orm';
