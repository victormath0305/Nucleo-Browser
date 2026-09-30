/**
 * Núcleo Test Extension - Content Script
 */
(function() {
  console.log('[NucleoTestExtension] Content script executed');
  const badge = document.createElement('div');
  badge.id = 'nucleo-extension-test-badge';
  badge.setAttribute('data-extension-loaded', 'true');
  badge.textContent = 'Núcleo Extension Active';
  badge.style.position = 'fixed';
  badge.style.bottom = '10px';
  badge.style.right = '10px';
  badge.style.padding = '6px 12px';
  badge.style.background = '#00e5ff';
  badge.style.color = '#0a0d14';
  badge.style.fontWeight = 'bold';
  badge.style.fontSize = '12px';
  badge.style.borderRadius = '4px';
  badge.style.zIndex = '999999';
  
  if (document.body) {
    document.body.appendChild(badge);
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(badge);
    });
  }
  window.__NUCLEO_EXTENSION_ACTIVE__ = true;
})();
