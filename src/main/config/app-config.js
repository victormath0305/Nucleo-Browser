/**
 * Núcleo Browser - Centralized Configuration
 * @module config/app-config
 */

const path = require('path');

const AppConfig = {
  appName: 'Núcleo Browser',
  appVersion: '0.8.0',
  appId: 'com.nucleobrowser.app',

  window: {
    defaultWidth: 1280,
    defaultHeight: 840,
    minWidth: 720,
    minHeight: 520,
    backgroundColor: '#0a0d14'
  },

  ui: {
    // Base height of top chrome bar (Tab strip row + Omnibox row)
    baseToolbarHeight: 78,
    // Extra height when bookmarks bar is visible
    bookmarksBarHeight: 32,
    // Whether bookmarks bar is currently visible (hidden by default)
    bookmarksBarVisible: false,
    // Current effective height (dynamic: 78 or 110)
    toolbarHeight: 78
  },

  navigation: {
    defaultHomepage: 'nucleo://newtab',
    defaultSearchEngine: {
      name: 'DuckDuckGo',
      searchUrl: 'https://duckduckgo.com/?q=%s',
      suggestUrl: 'https://duckduckgo.com/ac/?q=%s&type=list'
    },
    searchEngines: [
      { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
      { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=%s' },
      { id: 'brave', name: 'Brave Search', url: 'https://search.brave.com/search?q=%s' },
      { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q=%s' }
    ]
  },

  security: {
    allowedProtocols: ['http:', 'https:', 'file:', 'chrome-extension:'],
    defaultPermissionsBlocked: [
      'geolocation',
      'media',
      'mediaKeySystem',
      'notifications',
      'midi',
      'midiSysex',
      'pointerLock',
      'fullscreen',
      'openExternal'
    ]
  },

  paths: {
    icons: path.join(__dirname, '..', '..', 'assets', 'icons'),
    preload: path.join(__dirname, '..', '..', 'preload', 'index.js'),
    rendererHtml: path.join(__dirname, '..', '..', 'renderer', 'index.html'),
    newTabHtml: path.join(__dirname, '..', '..', 'renderer', 'newtab.html'),
    bookmarksHtml: path.join(__dirname, '..', '..', 'renderer', 'bookmarks.html'),
    historyHtml: path.join(__dirname, '..', '..', 'renderer', 'history.html'),
    shieldHtml: path.join(__dirname, '..', '..', 'renderer', 'shield.html'),
    shieldTestHtml: path.join(__dirname, '..', '..', 'renderer', 'shield-test.html'),
    extensionsHtml: path.join(__dirname, '..', '..', 'renderer', 'extensions.html'),
    extensionTestHtml: path.join(__dirname, '..', '..', 'renderer', 'extension-test.html'),
    settingsHtml: path.join(__dirname, '..', '..', 'renderer', 'settings.html'),
    downloadsHtml: path.join(__dirname, '..', '..', 'renderer', 'downloads.html')
  }
};

module.exports = AppConfig;
