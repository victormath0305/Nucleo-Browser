/**
 * Núcleo Browser - Secure Preload Bridge
 * Exposes strictly controlled APIs to the Browser UI Chrome and internal pages via contextBridge.
 * @module preload
 */

const { contextBridge, ipcRenderer } = require('electron');

const IPC_CHANNELS = {
  NAV_NAVIGATE: 'nav:navigate',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',
  NAV_STOP: 'nav:stop',

  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  TAB_CREATE: 'tab:create',
  TAB_CLOSE: 'tab:close',
  TAB_SWITCH: 'tab:switch',
  TAB_DUPLICATE: 'tab:duplicate',
  TAB_CLOSE_OTHERS: 'tab:close-others',
  TAB_CLOSE_RIGHT: 'tab:close-right',
  TAB_GET_ALL: 'tab:get-all',
  TAB_SWITCH_NEXT: 'tab:switch-next',
  TAB_SWITCH_PREV: 'tab:switch-prev',
  TAB_SWITCH_INDEX: 'tab:switch-index',

  DEVTOOLS_TOGGLE_WEB: 'devtools:toggle-web',
  DEVTOOLS_TOGGLE_UI: 'devtools:toggle-ui',

  // Bookmarks commands
  BOOKMARK_GET_ALL: 'bookmark:get-all',
  BOOKMARK_GET_FOLDERS: 'bookmark:get-folders',
  BOOKMARK_GET_TREE: 'bookmark:get-tree',
  BOOKMARK_GET_TOOLBAR: 'bookmark:get-toolbar',
  BOOKMARK_GET_QUICK_ACCESS: 'bookmark:get-quick-access',
  BOOKMARK_ADD: 'bookmark:add',
  BOOKMARK_UPDATE: 'bookmark:update',
  BOOKMARK_REMOVE: 'bookmark:remove',
  BOOKMARK_REMOVE_BY_URL: 'bookmark:remove-by-url',
  BOOKMARK_IS_BOOKMARKED: 'bookmark:is-bookmarked',
  BOOKMARK_CREATE_FOLDER: 'bookmark:create-folder',
  BOOKMARK_RENAME_FOLDER: 'bookmark:rename-folder',
  BOOKMARK_DELETE_FOLDER: 'bookmark:delete-folder',
  BOOKMARK_MOVE: 'bookmark:move',
  BOOKMARK_SEARCH: 'bookmark:search',
  BOOKMARK_TOGGLE_BAR: 'bookmark:toggle-bar',
  BOOKMARK_IS_BAR_VISIBLE: 'bookmark:is-bar-visible',

  // History commands
  HISTORY_SEARCH: 'history:search',
  HISTORY_DELETE: 'history:delete',
  HISTORY_CLEAR_PERIOD: 'history:clear-period',
  HISTORY_GET_STATS: 'history:get-stats',

  // Shield commands
  SHIELD_GET_STATUS: 'shield:get-status',
  SHIELD_SET_ENABLED: 'shield:set-enabled',
  SHIELD_TOGGLE: 'shield:toggle',
  SHIELD_GET_TAB_STATS: 'shield:get-tab-stats',
  SHIELD_TOGGLE_WHITELIST: 'shield:toggle-whitelist',
  SHIELD_ADD_WHITELIST: 'shield:add-whitelist',
  SHIELD_REMOVE_WHITELIST: 'shield:remove-whitelist',
  SHIELD_GET_WHITELIST: 'shield:get-whitelist',
  SHIELD_GET_GLOBAL_STATS: 'shield:get-global-stats',
  SHIELD_RESET_STATS: 'shield:reset-stats',
  SHIELD_RESTORE_DEFAULTS: 'shield:restore-defaults',

  // Extensions commands
  EXTENSIONS_LIST: 'extensions:list',
  EXTENSIONS_GET: 'extensions:get',
  EXTENSIONS_INSTALL: 'extensions:install',
  EXTENSIONS_SELECT_AND_INSTALL: 'extensions:select-and-install',
  EXTENSIONS_ENABLE: 'extensions:enable',
  EXTENSIONS_DISABLE: 'extensions:disable',
  EXTENSIONS_TOGGLE: 'extensions:toggle',
  EXTENSIONS_REMOVE: 'extensions:remove',
  EXTENSIONS_VALIDATE_PATH: 'extensions:validate-path',
  EXTENSIONS_OPEN_POPUP: 'extensions:open-popup',
  EXTENSIONS_OPEN_MANAGEMENT: 'extensions:open-management',

  // Settings commands
  SETTINGS_GET: 'settings:get',
  SETTINGS_GET_ALL: 'settings:get-all',
  SETTINGS_SET: 'settings:set',
  SETTINGS_RESET: 'settings:reset',
  SETTINGS_RESET_SECTION: 'settings:reset-section',
  SETTINGS_SELECT_DOWNLOAD_PATH: 'settings:select-download-path',

  // Search commands
  SEARCH_GET_ENGINES: 'search:get-engines',
  SEARCH_SET_DEFAULT: 'search:set-default',
  SEARCH_ADD_ENGINE: 'search:add-engine',
  SEARCH_REMOVE_ENGINE: 'search:remove-engine',

  // Default browser commands
  DEFAULT_BROWSER_IS_DEFAULT: 'default-browser:is-default',
  DEFAULT_BROWSER_REQUEST: 'default-browser:request',

  // Privacy commands
  PRIVACY_CLEAR_DATA: 'privacy:clear-data',

  // System commands
  SYSTEM_GET_ABOUT_INFO: 'system:get-about-info',

  // Events from Main -> Renderer
  EVENT_TAB_UPDATED: 'event:tab-updated',
  EVENT_TAB_CREATED: 'event:tab-created',
  EVENT_TAB_CLOSED: 'event:tab-closed',
  EVENT_TAB_ACTIVATED: 'event:tab-activated',
  EVENT_ALL_TABS_UPDATED: 'event:all-tabs-updated',
  EVENT_WINDOW_STATE_CHANGED: 'event:window-state-changed',
  EVENT_NAV_STATE_CHANGED: 'event:nav-state-changed',
  EVENT_BOOKMARKS_UPDATED: 'event:bookmarks-updated',
  EVENT_HISTORY_UPDATED: 'event:history-updated',
  EVENT_BOOKMARKS_BAR_TOGGLED: 'event:bookmarks-bar-toggled',
  EVENT_SHIELD_TAB_STATS_UPDATED: 'event:shield-tab-stats-updated',
  EVENT_SHIELD_STATE_CHANGED: 'event:shield-state-changed',
  EVENT_SHIELD_WHITELIST_CHANGED: 'event:shield-whitelist-changed',
  EVENT_EXTENSIONS_UPDATED: 'event:extensions-updated',
  EVENT_SETTINGS_CHANGED: 'event:settings-changed',
  EVENT_THEME_CHANGED: 'event:theme-changed',
  EVENT_SEARCH_ENGINE_CHANGED: 'event:search-engine-changed',
  EVENT_DEFAULT_BROWSER_CHANGED: 'event:default-browser-changed'
};

// Security check: Only internal browser pages (file: or nucleo:) receive the nucleoAPI bridge.
// External websites (https:, http:) never have access to this bridge.
const isInternalPage = window.location.protocol === 'nucleo:' ||
                       window.location.protocol === 'file:';

if (isInternalPage) {
  contextBridge.exposeInMainWorld('nucleoAPI', {
    // Navigation
    navigate: (urlOrQuery) => ipcRenderer.invoke(IPC_CHANNELS.NAV_NAVIGATE, urlOrQuery),
    goBack: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_BACK),
    goForward: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_FORWARD),
    reload: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_RELOAD),
    stop: () => ipcRenderer.invoke(IPC_CHANNELS.NAV_STOP),

    // Window Controls
    minimizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
    maximizeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
    closeWindow: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
    isWindowMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),

    // Tabs Management
    createTab: (url) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CREATE, url),
    closeTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE, tabId),
    switchTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_SWITCH, tabId),
    duplicateTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_DUPLICATE, tabId),
    closeOtherTabs: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE_OTHERS, tabId),
    closeTabsToTheRight: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.TAB_CLOSE_RIGHT, tabId),
    getAllTabs: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_GET_ALL),
    switchNextTab: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_SWITCH_NEXT),
    switchPreviousTab: () => ipcRenderer.invoke(IPC_CHANNELS.TAB_SWITCH_PREV),
    switchTabIndex: (index) => ipcRenderer.invoke(IPC_CHANNELS.TAB_SWITCH_INDEX, index),

    // DevTools
    toggleWebDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_TOGGLE_WEB),
    toggleUIDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.DEVTOOLS_TOGGLE_UI),

    // Bookmarks API
    bookmarks: {
      getAll: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_GET_ALL),
      getFolders: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_GET_FOLDERS),
      getTree: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_GET_TREE),
      getToolbar: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_GET_TOOLBAR),
      getQuickAccess: (limit = 8) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_GET_QUICK_ACCESS, limit),
      add: (data) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_ADD, data),
      update: (id, updates) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_UPDATE, id, updates),
      remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_REMOVE, id),
      removeByUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_REMOVE_BY_URL, url),
      isBookmarked: (url) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_IS_BOOKMARKED, url),
      createFolder: (data) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_CREATE_FOLDER, data),
      renameFolder: (id, newTitle) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_RENAME_FOLDER, id, newTitle),
      deleteFolder: (id) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_DELETE_FOLDER, id),
      move: (id, folderId) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_MOVE, id, folderId),
      search: (query) => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_SEARCH, query),
      toggleBar: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_TOGGLE_BAR),
      isBarVisible: () => ipcRenderer.invoke(IPC_CHANNELS.BOOKMARK_IS_BAR_VISIBLE),
      onUpdated: (callback) => {
        const handler = () => callback();
        ipcRenderer.on(IPC_CHANNELS.EVENT_BOOKMARKS_UPDATED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_BOOKMARKS_UPDATED, handler);
      }
    },

    // History API
    history: {
      search: (query, options) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_SEARCH, query, options),
      delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_DELETE, id),
      clear: (period) => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_CLEAR_PERIOD, period),
      getStats: () => ipcRenderer.invoke(IPC_CHANNELS.HISTORY_GET_STATS),
      onUpdated: (callback) => {
        const handler = () => callback();
        ipcRenderer.on(IPC_CHANNELS.EVENT_HISTORY_UPDATED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_HISTORY_UPDATED, handler);
      }
    },

    // Shield API
    shield: {
      getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_GET_STATUS),
      setEnabled: (enabled) => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_SET_ENABLED, enabled),
      toggle: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_TOGGLE),
      getTabStats: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_GET_TAB_STATS, tabId),
      toggleWhitelist: (domain) => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_TOGGLE_WHITELIST, domain),
      addWhitelist: (domain) => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_ADD_WHITELIST, domain),
      removeWhitelist: (domain) => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_REMOVE_WHITELIST, domain),
      getWhitelist: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_GET_WHITELIST),
      getGlobalStats: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_GET_GLOBAL_STATS),
      resetStats: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_RESET_STATS),
      restoreDefaults: () => ipcRenderer.invoke(IPC_CHANNELS.SHIELD_RESTORE_DEFAULTS),
      onTabStatsUpdated: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_SHIELD_TAB_STATS_UPDATED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SHIELD_TAB_STATS_UPDATED, handler);
      },
      onStateChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_SHIELD_STATE_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SHIELD_STATE_CHANGED, handler);
      },
      onWhitelistChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_SHIELD_WHITELIST_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SHIELD_WHITELIST_CHANGED, handler);
      }
    },

    // Extensions API
    extensions: {
      list: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_LIST),
      get: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_GET, id),
      install: (sourcePath) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_INSTALL, sourcePath),
      selectAndInstall: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_SELECT_AND_INSTALL),
      enable: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_ENABLE, id),
      disable: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_DISABLE, id),
      toggle: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_TOGGLE, id),
      remove: (id) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_REMOVE, id),
      validatePath: (dirPath) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_VALIDATE_PATH, dirPath),
      openPopup: (payload) => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_OPEN_POPUP, payload),
      openManagement: () => ipcRenderer.invoke(IPC_CHANNELS.EXTENSIONS_OPEN_MANAGEMENT),
      onUpdated: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_EXTENSIONS_UPDATED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_EXTENSIONS_UPDATED, handler);
      }
    },

    // Settings API
    settings: {
      get: (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
      getAll: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),
      set: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, { key, value }),
      reset: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET),
      resetSection: (section) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_RESET_SECTION, section),
      selectDownloadPath: () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SELECT_DOWNLOAD_PATH),
      onChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, handler);
      },
      onThemeChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_THEME_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_THEME_CHANGED, handler);
      }
    },

    // Search Engine API
    search: {
      getEngines: () => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_GET_ENGINES),
      setDefault: (id) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_SET_DEFAULT, id),
      addEngine: (engineData) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_ADD_ENGINE, engineData),
      removeEngine: (id) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_REMOVE_ENGINE, id),
      onDefaultChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_SEARCH_ENGINE_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_SEARCH_ENGINE_CHANGED, handler);
      }
    },

    // Default Browser API
    defaultBrowser: {
      isDefault: () => ipcRenderer.invoke(IPC_CHANNELS.DEFAULT_BROWSER_IS_DEFAULT),
      requestDefault: () => ipcRenderer.invoke(IPC_CHANNELS.DEFAULT_BROWSER_REQUEST),
      onStatusChanged: (callback) => {
        const handler = (event, data) => callback(data);
        ipcRenderer.on(IPC_CHANNELS.EVENT_DEFAULT_BROWSER_CHANGED, handler);
        return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_DEFAULT_BROWSER_CHANGED, handler);
      }
    },

    // Privacy & Data clearing API
    privacy: {
      clearData: (options) => ipcRenderer.invoke(IPC_CHANNELS.PRIVACY_CLEAR_DATA, options)
    },

    // System info API
    system: {
      getAboutInfo: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM_GET_ABOUT_INFO)
    },

    // Event Listeners
    onNavStateChanged: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_NAV_STATE_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_NAV_STATE_CHANGED, handler);
    },

    onWindowStateChanged: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_WINDOW_STATE_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_WINDOW_STATE_CHANGED, handler);
    },

    onTabCreated: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_TAB_CREATED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TAB_CREATED, handler);
    },

    onTabClosed: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_TAB_CLOSED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TAB_CLOSED, handler);
    },

    onTabActivated: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_TAB_ACTIVATED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_TAB_ACTIVATED, handler);
    },

    onAllTabsUpdated: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_ALL_TABS_UPDATED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_ALL_TABS_UPDATED, handler);
    },

    onBookmarksBarToggled: (callback) => {
      const handler = (event, data) => callback(data);
      ipcRenderer.on(IPC_CHANNELS.EVENT_BOOKMARKS_BAR_TOGGLED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.EVENT_BOOKMARKS_BAR_TOGGLED, handler);
    }
  });
}
