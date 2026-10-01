const { app, dialog } = require('electron');
const NucleoApplication = require('./app');

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('[Núcleo Fatal Error]', error);
  try {
    dialog.showErrorBox('Núcleo Browser — Erro Fatal', String(error?.stack || error));
  } catch {}
});

process.on('unhandledRejection', (reason) => {
  console.error('[Núcleo Unhandled Rejection]', reason);
});

const appInstance = new NucleoApplication();
appInstance.start().catch((err) => {
  console.error('[Núcleo] Failed to start application:', err);
  try {
    dialog.showErrorBox('Núcleo Browser — Falha ao Iniciar', String(err?.stack || err));
  } catch {}
});
