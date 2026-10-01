/**
 * Núcleo Browser - IPC Channel Definitions
 * @module ipc/ipc-channels
 */

const IPC_CHANNELS = {
  // Navigation commands
  NAV_NAVIGATE: 'nav:navigate',
  NAV_BACK: 'nav:back',
  NAV_FORWARD: 'nav:forward',
  NAV_RELOAD: 'nav:reload',
  NAV_STOP: 'nav:stop',

  // Window control commands
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_MAXIMIZE: 'window:maximize',
  WINDOW_CLOSE: 'window:close',
  WINDOW_IS_MAXIMIZED: 'window:is-maximized',

  // Tabs commands
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

  // DevTools commands
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

  // Workspaces commands
  WORKSPACES_GET_ALL: 'workspaces:get-all',
  WORKSPACES_GET_ACTIVE: 'workspaces:get-active',
  WORKSPACES_CREATE: 'workspaces:create',
  WORKSPACES_RENAME: 'workspaces:rename',
  WORKSPACES_SET_COLOR: 'workspaces:set-color',
  WORKSPACES_SET_ICON: 'workspaces:set-icon',
  WORKSPACES_SWITCH: 'workspaces:switch',
  WORKSPACES_DELETE: 'workspaces:delete',
  WORKSPACES_DUPLICATE: 'workspaces:duplicate',
  WORKSPACES_REORDER: 'workspaces:reorder',
  WORKSPACES_MOVE_UP: 'workspaces:move-up',
  WORKSPACES_MOVE_DOWN: 'workspaces:move-down',
  WORKSPACES_MOVE_TAB: 'workspaces:move-tab',

  // Downloads commands
  DOWNLOADS_LIST: 'downloads:list',
  DOWNLOADS_GET: 'downloads:get',
  DOWNLOADS_PAUSE: 'downloads:pause',
  DOWNLOADS_RESUME: 'downloads:resume',
  DOWNLOADS_CANCEL: 'downloads:cancel',
  DOWNLOADS_OPEN_FILE: 'downloads:open-file',
  DOWNLOADS_SHOW_IN_FOLDER: 'downloads:show-in-folder',
  DOWNLOADS_REMOVE: 'downloads:remove',
  DOWNLOADS_CLEAR: 'downloads:clear',
  DOWNLOADS_GET_ACTIVE_COUNT: 'downloads:get-active-count',

  // Permissions commands
  PERMISSIONS_LIST: 'permissions:list',
  PERMISSIONS_GET_FOR_ORIGIN: 'permissions:get-for-origin',
  PERMISSIONS_SET: 'permissions:set',
  PERMISSIONS_RESET: 'permissions:reset',
  PERMISSIONS_RESET_ORIGIN: 'permissions:reset-origin',
  PERMISSIONS_RESET_ALL: 'permissions:reset-all',
  PERMISSIONS_RESOLVE_REQUEST: 'permissions:resolve-request',

  // System & About info
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
  EVENT_DEFAULT_BROWSER_CHANGED: 'event:default-browser-changed',
  EVENT_WORKSPACES_UPDATED: 'event:workspaces-updated',
  EVENT_WORKSPACE_ACTIVATED: 'event:workspace-activated',
  EVENT_DOWNLOADS_CREATED: 'event:downloads-created',
  EVENT_DOWNLOADS_UPDATED: 'event:downloads-updated',
  EVENT_DOWNLOADS_DONE: 'event:downloads-done',
  EVENT_DOWNLOADS_CLEARED: 'event:downloads-cleared',
  EVENT_PERMISSIONS_CHANGED: 'event:permissions-changed',
  EVENT_PERMISSIONS_REQUEST: 'event:permissions-request',
  EVENT_PERMISSIONS_RESOLVED: 'event:permissions-resolved'
};

module.exports = IPC_CHANNELS;
