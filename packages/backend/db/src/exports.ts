// Export database functions and schema
export * from './schema/index.js';
export { getDatabase, initializeDatabase } from './index.js';

// Export services
export * from './services/students.js';
export * from './services/progress.js';
export * from './services/sessions.js';
