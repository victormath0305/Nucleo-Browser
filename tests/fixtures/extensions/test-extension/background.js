/**
 * Núcleo Test Extension - Background Service Worker
 */
console.log('[NucleoTestExtension] Background Service Worker started');

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onInstalled?.addListener(() => {
    console.log('[NucleoTestExtension] onInstalled event received');
  });
}
