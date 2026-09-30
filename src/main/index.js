/**
 * Núcleo Browser - Application Entry Point
 * @module index
 */

const NucleoApplication = require('./app');

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('[Núcleo Fatal Error]', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Núcleo Unhandled Rejection]', reason);
});

const appInstance = new NucleoApplication();
appInstance.start().catch((err) => {
  console.error('[Núcleo] Failed to start application:', err);
});
