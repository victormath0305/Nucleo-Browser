/**
 * Núcleo Browser - Settings Schema Definition
 * Defines allowed configuration keys, types, and constraints.
 * @module modules/settings/settings-schema
 */

const SETTINGS_SCHEMA = {
  // Search settings
  'search.engine': {
    type: 'string',
    default: 'duckduckgo',
    description: 'Active default search engine identifier'
  },
  'search.customEngines': {
    type: 'array',
    default: [],
    description: 'User-configured custom search engines'
  },

  // Appearance settings
  'appearance.theme': {
    type: 'string',
    enum: ['system', 'dark', 'light'],
    default: 'system',
    description: 'UI theme mode'
  },
  'appearance.accentColor': {
    type: 'string',
    enum: ['cyan', 'indigo', 'purple', 'green', 'amber'],
    default: 'cyan',
    description: 'Accent highlight color'
  },

  // Startup settings
  'startup.mode': {
    type: 'string',
    enum: ['newtab', 'restore', 'specific'],
    default: 'newtab',
    description: 'Action on browser startup'
  },
  'startup.urls': {
    type: 'array',
    default: [],
    description: 'Custom URLs to load when startup.mode is specific'
  },

  // New Tab page settings
  'newTab.mode': {
    type: 'string',
    enum: ['nucleo', 'custom'],
    default: 'nucleo',
    description: 'New tab display mode'
  },
  'newTab.customUrl': {
    type: 'string',
    default: 'https://',
    description: 'Custom URL when newTab.mode is custom'
  },

  // Downloads settings
  'downloads.defaultPath': {
    type: 'string',
    default: '',
    description: 'Default directory for downloaded files'
  },
  'downloads.askLocation': {
    type: 'boolean',
    default: true,
    description: 'Whether to prompt for download destination'
  },

  // Privacy and security settings
  'privacy.doNotTrack': {
    type: 'boolean',
    default: false,
    description: 'Send Do Not Track header with network requests'
  },
  'privacy.clearOnExit': {
    type: 'boolean',
    default: false,
    description: 'Whether to automatically clear browsing data on application quit'
  },
  'privacy.clearOnExitItems': {
    type: 'object',
    default: { history: false, cache: true, cookies: false },
    description: 'Items to clear when privacy.clearOnExit is active'
  },

  // Default browser preference
  'browser.default': {
    type: 'boolean',
    default: false,
    description: 'Cached indicator if Núcleo is default browser'
  },

  // Tab behavior settings
  'tabs.openNewTabsInBackground': {
    type: 'boolean',
    default: false,
    description: 'Open new tabs in background without immediately focusing them'
  },
  'tabs.confirmCloseMultipleTabs': {
    type: 'boolean',
    default: false,
    description: 'Prompt confirmation when closing multiple tabs'
  }
};

const SECTIONS = [
  'search',
  'appearance',
  'startup',
  'newTab',
  'downloads',
  'privacy',
  'browser',
  'tabs'
];

module.exports = {
  SETTINGS_SCHEMA,
  SECTIONS
};
