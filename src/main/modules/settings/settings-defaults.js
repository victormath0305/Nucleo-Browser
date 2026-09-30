/**
 * Núcleo Browser - Default Settings Definitions
 * @module modules/settings/settings-defaults
 */

const { SETTINGS_SCHEMA } = require('./settings-schema');

/**
 * Builds nested defaults object organized by top-level sections.
 * @returns {Object}
 */
function getDefaultSettings() {
  return {
    version: 1,
    search: {
      engine: 'duckduckgo',
      customEngines: []
    },
    appearance: {
      theme: 'system',
      accentColor: 'cyan'
    },
    startup: {
      mode: 'newtab',
      urls: []
    },
    newTab: {
      mode: 'nucleo',
      customUrl: 'https://'
    },
    downloads: {
      defaultPath: '',
      askLocation: true
    },
    privacy: {
      doNotTrack: false,
      clearOnExit: false,
      clearOnExitItems: {
        history: false,
        cache: true,
        cookies: false
      }
    },
    browser: {
      default: false
    },
    tabs: {
      openNewTabsInBackground: false,
      confirmCloseMultipleTabs: false
    }
  };
}

/**
 * Returns flat map of default values keyed by dot-notation path.
 * @returns {Record<string, any>}
 */
function getFlatDefaults() {
  const flat = {};
  for (const [key, def] of Object.entries(SETTINGS_SCHEMA)) {
    flat[key] = JSON.parse(JSON.stringify(def.default));
  }
  return flat;
}

module.exports = {
  getDefaultSettings,
  getFlatDefaults
};
