/**
 * Núcleo Browser - Extension Events
 * Centralized extension lifecycle event constants
 * @module modules/extensions/extension-events
 */

const ExtensionEvents = {
  EXTENSION_LOADED: 'extension-loaded',
  EXTENSION_UNLOADED: 'extension-unloaded',
  EXTENSION_INSTALLED: 'extension-installed',
  EXTENSION_REMOVED: 'extension-removed',
  EXTENSION_ENABLED: 'extension-enabled',
  EXTENSION_DISABLED: 'extension-disabled',
  EXTENSION_ERROR: 'extension-error',
  EXTENSIONS_UPDATED: 'extensions-updated'
};

module.exports = ExtensionEvents;
