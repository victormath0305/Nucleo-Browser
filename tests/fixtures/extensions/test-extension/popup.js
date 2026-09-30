/**
 * Núcleo Test Extension - Popup Script
 */
console.log('[NucleoTestExtension] Popup script executed');
document.addEventListener('DOMContentLoaded', () => {
  const statusEl = document.getElementById('popup-status');
  if (statusEl) {
    statusEl.textContent = 'Status: Ativo (' + new Date().toLocaleTimeString() + ')';
  }
});
