/**
 * Núcleo Browser - IPC Handler Registry
 * @module ipc/ipc-handlers
 */

const { ipcMain, dialog, Menu } = require('electron');
const IPC_CHANNELS = require('./ipc-channels');
const AppConfig = require('../config/app-config');
const ExtensionValidator = require('../modules/extensions/extension-validator');

class IpcHandlerRegistry {
  constructor({
    windowController,
    tabManager,
    navigationController,
    devToolsManager,
    bookmarkManager,
    historyManager,
    shieldManager = null,
    extensionManager = null,
    settingsManager = null,
    searchProvider = null,
    defaultBrowserManager = null,
    browserEngine = null,
    workspaceManager = null,
    downloadsManager = null,
    permissionsManager = null
  }) {
    this.windowController = windowController;
    this.tabManager = tabManager;
    this.navigationController = navigationController;
    this.devToolsManager = devToolsManager;
    this.bookmarkManager = bookmarkManager;
    this.historyManager = historyManager;
    this.shieldManager = shieldManager;
    this.extensionManager = extensionManager;
    this.settingsManager = settingsManager;
    this.searchProvider = searchProvider;
    this.defaultBrowserManager = defaultBrowserManager;
    this.browserEngine = browserEngine;
    this.workspaceManager = workspaceManager;
    this.downloadsManager = downloadsManager;
    this.permissionsManager = permissionsManager;
  }

  registerAll() {
    this._registerNavigationHandlers();
    this._registerWindowHandlers();
    this._registerTabHandlers();
    this._registerDevToolsHandlers();
    this._registerBookmarkHandlers();
    this._registerHistoryHandlers();
    this._registerShieldHandlers();
    this._registerExtensionHandlers();
    this._registerSettingsHandlers();
    this._registerSearchHandlers();
    this._registerDefaultBrowserHandlers();
    this._registerPrivacyHandlers();
    this._registerSystemHandlers();
    this._registerWorkspaceHandlers();
    this._registerDownloadHandlers();
    this._registerPermissionHandlers();
    this._registerMenuHandlers();
    this._forwardTabEventsToRenderer();
    this._forwardDataEventsToRenderer();
  }

  _registerNavigationHandlers() {
    ipcMain.handle(IPC_CHANNELS.NAV_NAVIGATE, async (event, input) => {
      await this.navigationController.navigate(input);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.NAV_BACK, () => {
      this.navigationController.goBack();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.NAV_FORWARD, () => {
      this.navigationController.goForward();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.NAV_RELOAD, () => {
      this.navigationController.reload();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.NAV_STOP, () => {
      this.navigationController.stop();
      return { success: true };
    });
  }

  _registerWindowHandlers() {
    ipcMain.handle(IPC_CHANNELS.WINDOW_MINIMIZE, () => {
      this.windowController.minimize();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_MAXIMIZE, () => {
      this.windowController.maximizeToggle();
      return this.windowController.isMaximized();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, () => {
      this.windowController.close();
    });

    ipcMain.handle(IPC_CHANNELS.WINDOW_IS_MAXIMIZED, () => {
      return this.windowController.isMaximized();
    });
  }

  _registerTabHandlers() {
    ipcMain.handle(IPC_CHANNELS.TAB_CREATE, (event, url) => {
      const tab = this.tabManager.createTab(url, true);
      return tab.getState();
    });

    ipcMain.handle(IPC_CHANNELS.TAB_CLOSE, (event, tabId) => {
      this.tabManager.closeTab(tabId);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_SWITCH, (event, tabId) => {
      this.tabManager.setActiveTab(tabId);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_DUPLICATE, (event, tabId) => {
      const tab = this.tabManager.duplicateTab(tabId);
      return tab ? tab.getState() : null;
    });

    ipcMain.handle(IPC_CHANNELS.TAB_CLOSE_OTHERS, (event, tabId) => {
      this.tabManager.closeOtherTabs(tabId);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_CLOSE_RIGHT, (event, tabId) => {
      this.tabManager.closeTabsToTheRight(tabId);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_SWITCH_NEXT, () => {
      this.tabManager.switchNextTab();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_SWITCH_PREV, () => {
      this.tabManager.switchPreviousTab();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_SWITCH_INDEX, (event, index) => {
      this.tabManager.switchToIndex(index);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.TAB_GET_ALL, () => {
      return this.tabManager.getAllTabs();
    });

    ipcMain.handle(IPC_CHANNELS.TAB_SET_ACTIVE_VISIBLE, (event, visible) => {
      this.tabManager.setActiveTabVisible(visible);
      return { success: true };
    });
  }

  _registerDevToolsHandlers() {
    ipcMain.handle(IPC_CHANNELS.DEVTOOLS_TOGGLE_WEB, () => {
      this.devToolsManager.toggleWebContentsDevTools();
    });

    ipcMain.handle(IPC_CHANNELS.DEVTOOLS_TOGGLE_UI, () => {
      this.devToolsManager.toggleChromeDevTools();
    });
  }

  _forwardTabEventsToRenderer() {
    const sendToRenderer = (channel, data) => {
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    };

    this.tabManager.on('tab-created', (state) => sendToRenderer(IPC_CHANNELS.EVENT_TAB_CREATED, state));
    this.tabManager.on('tab-closed', (state) => sendToRenderer(IPC_CHANNELS.EVENT_TAB_CLOSED, state));
    this.tabManager.on('tab-activated', (state) => sendToRenderer(IPC_CHANNELS.EVENT_TAB_ACTIVATED, state));
    this.tabManager.on('all-tabs-updated', (tabs) => sendToRenderer(IPC_CHANNELS.EVENT_ALL_TABS_UPDATED, tabs));
    this.tabManager.on('active-tab-updated', (state) => sendToRenderer(IPC_CHANNELS.EVENT_NAV_STATE_CHANGED, state));
  }

  _registerBookmarkHandlers() {
    if (!this.bookmarkManager) return;

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_GET_ALL, () => {
      return this.bookmarkManager.getAllBookmarks();
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_GET_FOLDERS, () => {
      return this.bookmarkManager.getFolders();
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_GET_TREE, () => {
      return this.bookmarkManager.getTree();
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_GET_TOOLBAR, () => {
      return this.bookmarkManager.getToolbarBookmarks();
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_GET_QUICK_ACCESS, (event, limit) => {
      return this.bookmarkManager.getQuickAccessBookmarks(limit);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_ADD, async (event, data) => {
      return await this.bookmarkManager.addBookmark(data);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_UPDATE, async (event, id, updates) => {
      return await this.bookmarkManager.updateBookmark(id, updates);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_REMOVE, async (event, id) => {
      return await this.bookmarkManager.removeBookmark(id);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_REMOVE_BY_URL, async (event, url) => {
      return await this.bookmarkManager.removeBookmarkByUrl(url);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_IS_BOOKMARKED, (event, url) => {
      return this.bookmarkManager.isBookmarked(url);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_CREATE_FOLDER, async (event, data) => {
      return await this.bookmarkManager.createFolder(data);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_RENAME_FOLDER, async (event, id, newTitle) => {
      return await this.bookmarkManager.renameFolder(id, newTitle);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_DELETE_FOLDER, async (event, id) => {
      return await this.bookmarkManager.deleteFolder(id);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_MOVE, async (event, id, folderId) => {
      return await this.bookmarkManager.moveBookmark(id, folderId);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_SEARCH, (event, query) => {
      return this.bookmarkManager.searchBookmarks(query);
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_TOGGLE_BAR, () => {
      return this.windowController.toggleBookmarksBar();
    });

    ipcMain.handle(IPC_CHANNELS.BOOKMARK_IS_BAR_VISIBLE, () => {
      return this.windowController.isBookmarksBarVisible();
    });
  }

  _registerHistoryHandlers() {
    if (!this.historyManager) return;

    ipcMain.handle(IPC_CHANNELS.HISTORY_SEARCH, (event, query, options) => {
      return this.historyManager.searchHistory(query, options);
    });

    ipcMain.handle(IPC_CHANNELS.HISTORY_DELETE, async (event, id) => {
      return await this.historyManager.deleteEntry(id);
    });

    ipcMain.handle(IPC_CHANNELS.HISTORY_CLEAR_PERIOD, async (event, period) => {
      return await this.historyManager.clearByPeriod(period);
    });

    ipcMain.handle(IPC_CHANNELS.HISTORY_GET_STATS, () => {
      return this.historyManager.getStats();
    });
  }

  _registerShieldHandlers() {
    if (!this.shieldManager) return;

    ipcMain.handle(IPC_CHANNELS.SHIELD_GET_STATUS, () => {
      return {
        enabled: this.shieldManager.isEnabled()
      };
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_SET_ENABLED, async (event, enabled) => {
      return await this.shieldManager.setEnabled(Boolean(enabled));
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_TOGGLE, async () => {
      return await this.shieldManager.toggleEnabled();
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_GET_TAB_STATS, (event, tabId) => {
      const targetId = tabId || (this.tabManager.getActiveTab()?.id);
      return this.shieldManager.getTabStats(targetId);
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_TOGGLE_WHITELIST, async (event, domain) => {
      return await this.shieldManager.toggleSiteWhitelist(domain);
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_ADD_WHITELIST, async (event, domain) => {
      return await this.shieldManager.addWhitelistDomain(domain);
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_REMOVE_WHITELIST, async (event, domain) => {
      return await this.shieldManager.removeWhitelistDomain(domain);
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_GET_WHITELIST, () => {
      return this.shieldManager.getWhitelist();
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_GET_GLOBAL_STATS, () => {
      return this.shieldManager.getGlobalStats();
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_RESET_STATS, async () => {
      return await this.shieldManager.resetStats();
    });

    ipcMain.handle(IPC_CHANNELS.SHIELD_RESTORE_DEFAULTS, async () => {
      return await this.shieldManager.restoreDefaults();
    });
  }

  _registerExtensionHandlers() {
    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_LIST, () => {
      return this.extensionManager ? this.extensionManager.getAll() : [];
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_GET, (event, id) => {
      if (!id || typeof id !== 'string') return null;
      return this.extensionManager ? this.extensionManager.get(id) : null;
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_INSTALL, async (event, sourcePath) => {
      if (!this.extensionManager) return { success: false, error: 'ExtensionManager não disponível.' };
      return await this.extensionManager.installFromDirectory(sourcePath);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_SELECT_AND_INSTALL, async () => {
      if (!this.extensionManager) return { success: false, error: 'ExtensionManager não disponível.' };
      const win = this.windowController.getWindow();
      const res = await dialog.showOpenDialog(win, {
        title: 'Selecionar Pasta da Extensão Descompactada',
        buttonLabel: 'Instalar Extensão',
        properties: ['openDirectory']
      });

      if (res.canceled || !res.filePaths || res.filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      const selectedDir = res.filePaths[0];
      return await this.extensionManager.installFromDirectory(selectedDir);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_ENABLE, async (event, id) => {
      if (!this.extensionManager || !id) return { success: false, error: 'ID inválido.' };
      return await this.extensionManager.enable(id);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_DISABLE, async (event, id) => {
      if (!this.extensionManager || !id) return { success: false, error: 'ID inválido.' };
      return await this.extensionManager.disable(id);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_TOGGLE, async (event, id) => {
      if (!this.extensionManager || !id) return { success: false, error: 'ID inválido.' };
      return await this.extensionManager.toggle(id);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_REMOVE, async (event, id) => {
      if (!this.extensionManager || !id) return { success: false, error: 'ID inválido.' };
      return await this.extensionManager.uninstall(id);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_VALIDATE_PATH, async (event, dirPath) => {
      return await ExtensionValidator.validateDirectory(dirPath);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_OPEN_POPUP, async (event, payload) => {
      if (!this.extensionManager) return { success: false };
      const id = typeof payload === 'string' ? payload : (payload && payload.id);
      const bounds = payload && payload.bounds ? payload.bounds : null;
      return await this.extensionManager.openPopup(id, bounds);
    });

    ipcMain.handle(IPC_CHANNELS.EXTENSIONS_OPEN_MANAGEMENT, async () => {
      if (this.navigationController) {
        await this.navigationController.navigate('nucleo://extensions');
        return { success: true };
      }
      return { success: false };
    });
  }

  _registerSettingsHandlers() {
    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (event, key) => {
      if (!this.settingsManager) return null;
      return this.settingsManager.get(key);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, () => {
      if (!this.settingsManager) return {};
      return this.settingsManager.getAll();
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (event, payload) => {
      if (!this.settingsManager) return { success: false, error: 'SettingsManager indisponível' };
      if (!payload || typeof payload !== 'object' || typeof payload.key !== 'string') {
        return { success: false, error: 'Parâmetros de configuração inválidos' };
      }
      return await this.settingsManager.set(payload.key, payload.value);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET, async () => {
      if (!this.settingsManager) return { success: false };
      return await this.settingsManager.reset();
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_RESET_SECTION, async (event, section) => {
      if (!this.settingsManager) return { success: false };
      return await this.settingsManager.resetSection(section);
    });

    ipcMain.handle(IPC_CHANNELS.SETTINGS_SELECT_DOWNLOAD_PATH, async () => {
      const win = this.windowController ? this.windowController.getWindow() : null;
      const res = await dialog.showOpenDialog(win, {
        title: 'Selecionar pasta de downloads',
        properties: ['openDirectory', 'createDirectory']
      });

      if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
        const selected = res.filePaths[0];
        if (this.settingsManager) {
          await this.settingsManager.set('downloads.defaultPath', selected);
        }
        return { success: true, path: selected };
      }

      return { success: false, canceled: true };
    });
  }

  _registerSearchHandlers() {
    ipcMain.handle(IPC_CHANNELS.SEARCH_GET_ENGINES, () => {
      if (!this.searchProvider) return [];
      return this.searchProvider.getAllEngines();
    });

    ipcMain.handle(IPC_CHANNELS.SEARCH_SET_DEFAULT, async (event, engineId) => {
      if (!this.searchProvider) return { success: false };
      if (!engineId || typeof engineId !== 'string') {
        return { success: false, error: 'ID de buscador inválido' };
      }
      return await this.searchProvider.setDefaultEngine(engineId);
    });

    ipcMain.handle(IPC_CHANNELS.SEARCH_ADD_ENGINE, async (event, engineData) => {
      if (!this.searchProvider) return { success: false };
      return await this.searchProvider.addCustomEngine(engineData);
    });

    ipcMain.handle(IPC_CHANNELS.SEARCH_REMOVE_ENGINE, async (event, engineId) => {
      if (!this.searchProvider) return { success: false };
      if (!engineId || typeof engineId !== 'string') {
        return { success: false, error: 'ID de buscador inválido' };
      }
      return await this.searchProvider.removeCustomEngine(engineId);
    });
  }

  _registerDefaultBrowserHandlers() {
    ipcMain.handle(IPC_CHANNELS.DEFAULT_BROWSER_IS_DEFAULT, async () => {
      if (!this.defaultBrowserManager) {
        return { isDefault: false, http: false, https: false };
      }
      return await this.defaultBrowserManager.isDefault();
    });

    ipcMain.handle(IPC_CHANNELS.DEFAULT_BROWSER_REQUEST, async () => {
      if (!this.defaultBrowserManager) {
        return { success: false, message: 'DefaultBrowserManager indisponível' };
      }
      return await this.defaultBrowserManager.requestDefault();
    });
  }

  _registerPrivacyHandlers() {
    ipcMain.handle(IPC_CHANNELS.PRIVACY_CLEAR_DATA, async (event, options = {}) => {
      const { period = 'all', history = false, cache = false, cookies = false } = options;

      try {
        const electronSession = this.browserEngine
          ? this.browserEngine.getSession()
          : require('electron').session.defaultSession;

        if (cache && electronSession && typeof electronSession.clearCache === 'function') {
          await electronSession.clearCache();
        }

        if (cookies && electronSession && typeof electronSession.clearStorageData === 'function') {
          await electronSession.clearStorageData({ storages: ['cookies'] });
        }

        if (history && this.historyManager) {
          if (period === 'last_hour' || period === 'lastHour') {
            await this.historyManager.clearByPeriod('last15Minutes');
          } else if (period === 'last_24h' || period === 'today') {
            await this.historyManager.clearByPeriod('today');
          } else if (period === 'last_7d' || period === 'last7Days') {
            await this.historyManager.clearByPeriod('last7Days');
          } else {
            await this.historyManager.clearByPeriod('all');
          }
        }

        return { success: true };
      } catch (err) {
        console.error('[IpcHandlerRegistry] Error clearing privacy data:', err);
        return { success: false, error: err.message };
      }
    });
  }

  _registerSystemHandlers() {
    ipcMain.handle(IPC_CHANNELS.SYSTEM_GET_ABOUT_INFO, () => {
      return {
        appName: AppConfig.appName,
        appVersion: AppConfig.appVersion,
        electronVersion: process.versions.electron,
        chromeVersion: process.versions.chrome,
        nodeVersion: process.versions.node,
        v8Version: process.versions.v8,
        platform: process.platform,
        arch: process.arch,
        shieldActive: this.shieldManager ? this.shieldManager.isEnabled() : true,
        extensionsCount: this.extensionManager ? this.extensionManager.getAll().length : 0
      };
    });
  }

  _forwardDataEventsToRenderer() {
    const broadcastEvent = (channel, data = null) => {
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    };

    if (this.bookmarkManager) {
      this.bookmarkManager.on('bookmarks-updated', () => {
        broadcastEvent(IPC_CHANNELS.EVENT_BOOKMARKS_UPDATED);
      });
    }

    if (this.historyManager) {
      this.historyManager.on('history-updated', () => {
        broadcastEvent(IPC_CHANNELS.EVENT_HISTORY_UPDATED);
      });
    }

    if (this.shieldManager) {
      this.shieldManager.on('tab-stats-updated', (tabId, stats) => {
        broadcastEvent(IPC_CHANNELS.EVENT_SHIELD_TAB_STATS_UPDATED, { tabId, stats });
      });

      this.shieldManager.on('enabled-changed', (enabled) => {
        broadcastEvent(IPC_CHANNELS.EVENT_SHIELD_STATE_CHANGED, { enabled });
      });

      this.shieldManager.on('whitelist-changed', (whitelist) => {
        broadcastEvent(IPC_CHANNELS.EVENT_SHIELD_WHITELIST_CHANGED, { whitelist });
      });
    }

    if (this.extensionManager) {
      this.extensionManager.on('extensions-updated', (extensions) => {
        broadcastEvent(IPC_CHANNELS.EVENT_EXTENSIONS_UPDATED, extensions);
      });
    }

    if (this.settingsManager) {
      this.settingsManager.on('settings-changed', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_SETTINGS_CHANGED, data);
      });

      this.settingsManager.on('theme-changed', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_THEME_CHANGED, data);
      });

      this.settingsManager.on('search-engine-changed', (engineId) => {
        broadcastEvent(IPC_CHANNELS.EVENT_SEARCH_ENGINE_CHANGED, engineId);
      });
    }

    if (this.defaultBrowserManager) {
      this.defaultBrowserManager.on('default-status-changed', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_DEFAULT_BROWSER_CHANGED, data);
      });
    }

    if (this.workspaceManager) {
      this.workspaceManager.on('workspaces-updated', (workspaces) => {
        broadcastEvent(IPC_CHANNELS.EVENT_WORKSPACES_UPDATED, workspaces);
      });

      this.workspaceManager.on('workspace-activated', (workspace) => {
        broadcastEvent(IPC_CHANNELS.EVENT_WORKSPACE_ACTIVATED, workspace);
      });
    }

    if (this.downloadsManager) {
      this.downloadsManager.on('download-created', (download) => {
        broadcastEvent(IPC_CHANNELS.EVENT_DOWNLOADS_CREATED, download);
      });

      this.downloadsManager.on('download-updated', (download) => {
        broadcastEvent(IPC_CHANNELS.EVENT_DOWNLOADS_UPDATED, download);
      });

      this.downloadsManager.on('download-done', (download) => {
        broadcastEvent(IPC_CHANNELS.EVENT_DOWNLOADS_DONE, download);
      });

      this.downloadsManager.on('downloads-cleared', () => {
        broadcastEvent(IPC_CHANNELS.EVENT_DOWNLOADS_CLEARED);
      });
    }

    if (this.permissionsManager) {
      this.permissionsManager.on('permission-changed', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_PERMISSIONS_CHANGED, data);
      });

      this.permissionsManager.on('permission-request', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_PERMISSIONS_REQUEST, data);
      });

      this.permissionsManager.on('permission-resolved', (data) => {
        broadcastEvent(IPC_CHANNELS.EVENT_PERMISSIONS_RESOLVED, data);
      });
    }
  }

  _validateInternalSender(event) {
    if (!event || !event.senderFrame) return true;
    const url = event.senderFrame.url;
    if (!url) return true;
    if (url.startsWith('nucleo://') || url.startsWith('file://')) {
      return true;
    }
    throw new Error('Acesso negado: páginas web externas não podem acessar as APIs internas do navegador.');
  }

  _registerWorkspaceHandlers() {
    if (!this.workspaceManager) return;

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_GET_ALL, (event) => {
      this._validateInternalSender(event);
      return this.workspaceManager.getAllWorkspaces();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_GET_ACTIVE, (event) => {
      this._validateInternalSender(event);
      return this.workspaceManager.getActiveWorkspace().toJSON();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_CREATE, async (event, data = {}) => {
      this._validateInternalSender(event);
      const ws = await this.workspaceManager.createWorkspace(data);
      if (this.tabManager) {
        await this.tabManager.switchWorkspace(ws.id);
      }
      return ws.toJSON();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_RENAME, async (event, { id, name }) => {
      this._validateInternalSender(event);
      return await this.workspaceManager.renameWorkspace(id, name);
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_SET_COLOR, async (event, { id, color }) => {
      this._validateInternalSender(event);
      return await this.workspaceManager.setColor(id, color);
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_SET_ICON, async (event, { id, icon }) => {
      this._validateInternalSender(event);
      return await this.workspaceManager.setIcon(id, icon);
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_SWITCH, async (event, id) => {
      this._validateInternalSender(event);
      if (this.tabManager) {
        await this.tabManager.switchWorkspace(id);
      } else {
        await this.workspaceManager.switchWorkspace(id);
      }
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_DELETE, async (event, { id, targetWorkspaceId }) => {
      this._validateInternalSender(event);
      return await this.workspaceManager.deleteWorkspace(id, { targetWorkspaceId });
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_DUPLICATE, async (event, id) => {
      this._validateInternalSender(event);
      const dup = await this.workspaceManager.duplicateWorkspace(id);
      if (this.tabManager) {
        const sourceTabs = this.tabManager.getTabsForWorkspace(id);
        if (sourceTabs.length > 0) {
          sourceTabs.forEach((t, i) => {
            this.tabManager.createTab(t.url, i === 0, dup.id);
          });
        } else {
          this.tabManager.createTab(AppConfig.navigation.defaultHomepage, true, dup.id);
        }
      }
      return dup.toJSON();
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_REORDER, async (event, orderedIds) => {
      this._validateInternalSender(event);
      await this.workspaceManager.reorderWorkspaces(orderedIds);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_MOVE_UP, async (event, id) => {
      this._validateInternalSender(event);
      await this.workspaceManager.moveWorkspaceUp(id);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_MOVE_DOWN, async (event, id) => {
      this._validateInternalSender(event);
      await this.workspaceManager.moveWorkspaceDown(id);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.WORKSPACES_MOVE_TAB, async (event, { tabId, targetWorkspaceId, activateInTarget }) => {
      this._validateInternalSender(event);
      if (this.tabManager) {
        this.tabManager.moveTabToWorkspace(tabId, targetWorkspaceId, activateInTarget);
      }
      return { success: true };
    });
  }

  _registerDownloadHandlers() {
    if (!this.downloadsManager) return;

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_LIST, (event) => {
      this._validateInternalSender(event);
      return this.downloadsManager.getAll();
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET, (event, id) => {
      this._validateInternalSender(event);
      return this.downloadsManager.getById(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_PAUSE, (event, id) => {
      this._validateInternalSender(event);
      return this.downloadsManager.pauseDownload(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_RESUME, (event, id) => {
      this._validateInternalSender(event);
      return this.downloadsManager.resumeDownload(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CANCEL, (event, id) => {
      this._validateInternalSender(event);
      return this.downloadsManager.cancelDownload(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_OPEN_FILE, async (event, id) => {
      this._validateInternalSender(event);
      return await this.downloadsManager.openFile(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_SHOW_IN_FOLDER, (event, id) => {
      this._validateInternalSender(event);
      return this.downloadsManager.showInFolder(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_REMOVE, async (event, id) => {
      this._validateInternalSender(event);
      return await this.downloadsManager.removeDownload(id);
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_CLEAR, async (event) => {
      this._validateInternalSender(event);
      await this.downloadsManager.clearHistory();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.DOWNLOADS_GET_ACTIVE_COUNT, (event) => {
      this._validateInternalSender(event);
      return this.downloadsManager.getActiveCount();
    });
  }

  _registerPermissionHandlers() {
    if (!this.permissionsManager) return;

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_LIST, (event) => {
      this._validateInternalSender(event);
      return this.permissionsManager.listPermissions();
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_GET_FOR_ORIGIN, (event, origin) => {
      this._validateInternalSender(event);
      return this.permissionsManager.getPermissionsForOrigin(origin);
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_SET, async (event, { origin, permission, state }) => {
      this._validateInternalSender(event);
      await this.permissionsManager.setPermission(origin, permission, state);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_RESET, async (event, { origin, permission }) => {
      this._validateInternalSender(event);
      await this.permissionsManager.resetPermission(origin, permission);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_RESET_ORIGIN, async (event, origin) => {
      this._validateInternalSender(event);
      await this.permissionsManager.resetOrigin(origin);
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_RESET_ALL, async (event) => {
      this._validateInternalSender(event);
      await this.permissionsManager.resetAll();
      return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.PERMISSIONS_RESOLVE_REQUEST, async (event, { requestId, decision, persist }) => {
      this._validateInternalSender(event);
      const success = await this.permissionsManager.resolveRequest(requestId, decision, persist !== false);
      return { success };
    });
  }

  _registerMenuHandlers() {
    // 1. Main Application Menu (3 Dots Menu)
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_MAIN, async (event, { x, y } = {}) => {
      this._validateInternalSender(event);
      const isBookmarksBarVisible = this.windowController ? this.windowController.isBookmarksBarVisible() : false;

      const template = [
        {
          label: 'Nova Aba',
          accelerator: 'CmdOrCtrl+T',
          click: () => this.tabManager.createTab()
        },
        {
          label: 'Nova Janela',
          accelerator: 'CmdOrCtrl+N',
          click: () => this.tabManager.createTab()
        },
        {
          label: 'Fechar Aba',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            const active = this.tabManager.getActiveTab();
            if (active) this.tabManager.closeTab(active.id);
          }
        },
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            const active = this.tabManager.getActiveTab();
            if (active) active.reload();
          }
        },
        { type: 'separator' },
        {
          label: 'Favoritos',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => this.tabManager.createTab('nucleo://bookmarks')
        },
        {
          label: 'Barra de favoritos',
          accelerator: 'CmdOrCtrl+Shift+B',
          type: 'checkbox',
          checked: isBookmarksBarVisible,
          click: () => {
            if (this.windowController) this.windowController.toggleBookmarksBar();
          }
        },
        {
          label: 'Histórico',
          accelerator: 'CmdOrCtrl+H',
          click: () => this.tabManager.createTab('nucleo://history')
        },
        {
          label: 'Downloads',
          accelerator: 'CmdOrCtrl+J',
          click: () => this.tabManager.createTab('nucleo://downloads')
        },
        { type: 'separator' },
        {
          label: 'Núcleo Shield',
          click: () => this.tabManager.createTab('nucleo://shield')
        },
        {
          label: 'Extensões',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => this.tabManager.createTab('nucleo://extensions')
        },
        {
          label: 'Privacidade & Permissões',
          click: () => this.tabManager.createTab('nucleo://privacy')
        },
        { type: 'separator' },
        {
          label: 'Inspecionar Página',
          accelerator: 'F12',
          click: () => {
            const active = this.tabManager.getActiveTab();
            if (active) active.toggleDevTools();
          }
        },
        {
          label: 'Inspecionar Navegador',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            if (this.devToolsManager) this.devToolsManager.toggleUIDevTools();
          }
        },
        { type: 'separator' },
        {
          label: 'Configurações',
          click: () => this.tabManager.createTab('nucleo://settings')
        },
        {
          label: 'Sobre o Núcleo Browser',
          click: () => this.tabManager.createTab('nucleo://settings')
        },
        { type: 'separator' },
        {
          label: 'Sair',
          accelerator: 'CmdOrCtrl+Q',
          role: 'quit'
        }
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 2. Extensions Menu (Puzzle piece)
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_EXTENSIONS, async (event, { x, y } = {}) => {
      this._validateInternalSender(event);
      const extensions = this.extensionManager ? this.extensionManager.getAll() : [];
      const template = [
        {
          label: 'Extensões',
          enabled: false
        },
        { type: 'separator' }
      ];

      if (!extensions || extensions.length === 0) {
        template.push({
          label: 'Nenhuma extensão instalada',
          enabled: false
        });
      } else {
        for (const ext of extensions) {
          const isEnabled = ext.enabled !== false;
          const statusIcon = isEnabled ? '●' : '○';
          const label = `${statusIcon} ${ext.name} (v${ext.version || '1.0'})`;

          const extSubmenu = [];
          if (ext.hasPopup) {
            extSubmenu.push({
              label: 'Abrir pop-up da extensão',
              click: async () => {
                await this.extensionManager.openPopup(ext.id, { x, y });
              }
            });
          }
          extSubmenu.push({
            label: isEnabled ? 'Desativar extensão' : 'Ativar extensão',
            click: async () => {
              if (isEnabled) {
                await this.extensionManager.disable(ext.id);
              } else {
                await this.extensionManager.enable(ext.id);
              }
            }
          });
          extSubmenu.push({
            label: 'Gerenciar extensão',
            click: () => {
              this.tabManager.createTab('nucleo://extensions');
            }
          });
          extSubmenu.push({ type: 'separator' });
          extSubmenu.push({
            label: 'Desinstalar extensão',
            click: async () => {
              await this.extensionManager.uninstall(ext.id);
            }
          });

          template.push({
            label,
            submenu: extSubmenu,
            click: ext.hasPopup ? async () => {
              await this.extensionManager.openPopup(ext.id, { x, y });
            } : () => {
              this.tabManager.createTab('nucleo://extensions');
            }
          });
        }
      }

      template.push({ type: 'separator' });
      template.push({
        label: '➕ Instalar extensão (.crx ou pasta)...',
        click: async () => {
          await this.extensionManager.selectAndInstall();
        }
      });
      template.push({
        label: '⚙️ Gerenciar extensões',
        accelerator: 'CmdOrCtrl+Shift+E',
        click: () => {
          this.tabManager.createTab('nucleo://extensions');
        }
      });

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 3. Tab Context Menu
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_TAB_CONTEXT, async (event, { tabId, x, y } = {}) => {
      this._validateInternalSender(event);
      const tab = this.tabManager.getTab(tabId);
      if (!tab) return { success: false };

      const allWorkspaces = this.workspaceManager ? this.workspaceManager.getAllWorkspaces() : [];
      const otherWorkspaces = allWorkspaces.filter((w) => w.id !== tab.workspaceId);

      const wsSubmenu = otherWorkspaces.length > 0
        ? otherWorkspaces.map((ws) => ({
            label: `${ws.icon || '💼'} ${ws.name}`,
            click: () => {
              if (this.tabManager) {
                this.tabManager.moveTabToWorkspace(tabId, ws.id);
              }
            }
          }))
        : [{ label: 'Sem outros workspaces', enabled: false }];

      const template = [
        {
          label: 'Nova aba',
          accelerator: 'CmdOrCtrl+T',
          click: () => this.tabManager.createTab()
        },
        {
          label: 'Recarregar',
          accelerator: 'CmdOrCtrl+R',
          click: () => tab.reload()
        },
        {
          label: 'Duplicar aba',
          click: () => this.tabManager.duplicateTab(tabId)
        },
        { type: 'separator' },
        {
          label: 'Mover para Workspace',
          submenu: wsSubmenu
        },
        { type: 'separator' },
        {
          label: 'Fechar aba',
          accelerator: 'CmdOrCtrl+W',
          click: () => this.tabManager.closeTab(tabId)
        },
        {
          label: 'Fechar outras abas',
          click: () => this.tabManager.closeOtherTabs(tabId)
        },
        {
          label: 'Fechar abas à direita',
          click: () => this.tabManager.closeTabsToTheRight(tabId)
        }
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 4. Workspaces Context Menu
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_WORKSPACES_CONTEXT, async (event, { workspaceId, x, y } = {}) => {
      this._validateInternalSender(event);
      const ws = this.workspaceManager ? this.workspaceManager.getWorkspace(workspaceId) : null;
      if (!ws) return { success: false };

      const allWorkspaces = this.workspaceManager ? this.workspaceManager.getAllWorkspaces() : [];
      const isLast = allWorkspaces.length <= 1;

      const template = [
        {
          label: `Workspace: ${ws.name}`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Renomear / Editar...',
          click: () => {
            const win = this.windowController.getWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send(IPC_CHANNELS.EVENT_UI_ACTION, { action: 'ws-rename', workspaceId });
            }
          }
        },
        {
          label: 'Duplicar workspace',
          click: async () => {
            await this.workspaceManager.duplicateWorkspace(workspaceId);
          }
        },
        { type: 'separator' },
        {
          label: 'Mover para cima',
          click: async () => {
            await this.workspaceManager.moveUp(workspaceId);
          }
        },
        {
          label: 'Mover para baixo',
          click: async () => {
            await this.workspaceManager.moveDown(workspaceId);
          }
        },
        { type: 'separator' },
        {
          label: 'Excluir workspace',
          enabled: !isLast,
          click: () => {
            const win = this.windowController.getWindow();
            if (win && !win.isDestroyed()) {
              win.webContents.send(IPC_CHANNELS.EVENT_UI_ACTION, { action: 'ws-delete', workspaceId });
            }
          }
        }
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 5. Shield Quick Action Menu
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_SHIELD, async (event, { x, y, url, tabId } = {}) => {
      this._validateInternalSender(event);
      let domain = '';
      if (url && typeof url === 'string') {
        try {
          domain = new URL(url).hostname.toLowerCase();
        } catch {
          domain = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
        }
      }
      const isSystemPage = !domain || domain.startsWith('nucleo:') || url?.startsWith('nucleo:');
      const tabStats = this.shieldManager && tabId ? this.shieldManager.getTabStats(tabId) : null;
      const globalStatus = this.shieldManager ? this.shieldManager.getStatus() : { enabled: true };
      const isEnabled = globalStatus.enabled;
      let isWhitelisted = false;
      if (domain && this.shieldManager) {
        const list = this.shieldManager.getWhitelist();
        isWhitelisted = Array.isArray(list) && list.includes(domain);
      }

      const blockedCount = tabStats ? (tabStats.totalBlocked || 0) : 0;
      const adsBlocked = tabStats ? (tabStats.adsBlocked || 0) : 0;
      const trackersBlocked = tabStats ? (tabStats.trackersBlocked || 0) : 0;

      const template = [
        {
          label: `🛡️ Núcleo Shield — ${domain || 'Página do Sistema'}`,
          enabled: false
        },
        {
          label: `Status: ${!isEnabled ? 'Desativado globalmente' : (isSystemPage ? 'Página interna do navegador' : (isWhitelisted ? 'Pausado neste site' : 'Protegido e ativo'))}`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: 'Bloquear anúncios e rastreadores neste site',
          type: 'checkbox',
          checked: isEnabled && !isWhitelisted && !isSystemPage,
          enabled: isEnabled && !isSystemPage && Boolean(domain),
          click: async () => {
            if (domain && this.shieldManager) {
              await this.shieldManager.toggleWhitelist(domain);
              const activeTab = this.tabManager.getActiveTab();
              if (activeTab) activeTab.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: `Bloqueados nesta página: ${blockedCount} (${adsBlocked} anúncios, ${trackersBlocked} rastreadores)`,
          enabled: false
        },
        { type: 'separator' },
        {
          label: '⚙️ Configurações do Shield',
          click: () => {
            this.tabManager.createTab('nucleo://shield');
          }
        }
      ];

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 6. Site Permissions Menu
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_SITE_PERMISSIONS, async (event, { x, y, url } = {}) => {
      this._validateInternalSender(event);
      let origin = '';
      if (url && typeof url === 'string') {
        try {
          const u = new URL(url);
          origin = u.origin ? u.origin.toLowerCase() : '';
        } catch {
          origin = url;
        }
      }

      const isSecure = origin.startsWith('https://') || origin.startsWith('nucleo://');
      const isSystem = origin.startsWith('nucleo://') || !origin;
      const siteData = this.permissionsManager && origin ? this.permissionsManager.getPermissionsForOrigin(origin) : null;
      const sitePerms = siteData?.permissions || {};

      const permTypes = [
        { id: 'camera', label: 'Câmera' },
        { id: 'microphone', label: 'Microfone' },
        { id: 'geolocation', label: 'Localização' },
        { id: 'notifications', label: 'Notificações' },
        { id: 'clipboard', label: 'Área de Transferência' }
      ];

      const template = [
        {
          label: `Site: ${origin || 'Página do Sistema'}`,
          enabled: false
        },
        {
          label: isSystem ? 'Sistema Núcleo Seguro' : (isSecure ? '🔒 Conexão Segura (HTTPS)' : '⚠️ Conexão Não Criptografada'),
          enabled: false
        },
        { type: 'separator' }
      ];

      if (!isSystem && origin) {
        for (const p of permTypes) {
          const currentState = sitePerms[p.id] || 'ask';
          const stateLabel = currentState === 'allow' ? 'Permitido' : (currentState === 'deny' ? 'Bloqueado' : 'Perguntar');
          template.push({
            label: `${p.label}: ${stateLabel}`,
            submenu: [
              {
                label: 'Permitir',
                type: 'radio',
                checked: currentState === 'allow',
                click: async () => {
                  if (this.permissionsManager && origin) {
                    await this.permissionsManager.setPermission(origin, p.id, 'allow');
                    const win = this.windowController.getWindow();
                    if (win && !win.isDestroyed()) {
                      win.webContents.send(IPC_CHANNELS.EVENT_PERMISSIONS_CHANGED);
                    }
                  }
                }
              },
              {
                label: 'Bloquear',
                type: 'radio',
                checked: currentState === 'deny',
                click: async () => {
                  if (this.permissionsManager && origin) {
                    await this.permissionsManager.setPermission(origin, p.id, 'deny');
                    const win = this.windowController.getWindow();
                    if (win && !win.isDestroyed()) {
                      win.webContents.send(IPC_CHANNELS.EVENT_PERMISSIONS_CHANGED);
                    }
                  }
                }
              },
              {
                label: 'Perguntar (Padrão)',
                type: 'radio',
                checked: currentState === 'ask',
                click: async () => {
                  if (this.permissionsManager && origin) {
                    await this.permissionsManager.resetPermission(origin, p.id);
                    const win = this.windowController.getWindow();
                    if (win && !win.isDestroyed()) {
                      win.webContents.send(IPC_CHANNELS.EVENT_PERMISSIONS_CHANGED);
                    }
                  }
                }
              }
            ]
          });
        }

        template.push({ type: 'separator' });
        template.push({
          label: 'Redefinir permissões deste site',
          click: async () => {
            if (this.permissionsManager && origin) {
              await this.permissionsManager.resetOrigin(origin);
              const win = this.windowController.getWindow();
              if (win && !win.isDestroyed()) {
                win.webContents.send(IPC_CHANNELS.EVENT_PERMISSIONS_CHANGED);
              }
            }
          }
        });
      }

      template.push({
        label: '🛡️ Central de Privacidade & Permissões',
        click: () => {
          this.tabManager.createTab('nucleo://privacy');
        }
      });

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });

    // 7. Workspaces Quick Menu
    ipcMain.handle(IPC_CHANNELS.MENU_SHOW_WORKSPACES, async (event, { x, y } = {}) => {
      this._validateInternalSender(event);
      const workspaces = this.workspaceManager ? this.workspaceManager.getAllWorkspaces() : [];
      const activeWs = this.workspaceManager ? this.workspaceManager.getActiveWorkspace() : null;

      const template = [
        {
          label: 'Meus Workspaces',
          enabled: false
        },
        { type: 'separator' }
      ];

      for (const ws of workspaces) {
        const isActive = activeWs && activeWs.id === ws.id;
        const tabCount = ws.tabIds ? ws.tabIds.length : 0;
        template.push({
          label: `${isActive ? '● ' : '○ '}${ws.icon || '💼'} ${ws.name} (${tabCount} ${tabCount === 1 ? 'aba' : 'abas'})`,
          type: 'checkbox',
          checked: isActive,
          click: () => {
            if (!isActive && this.workspaceManager) {
              this.workspaceManager.switchWorkspace(ws.id);
            }
          }
        });
      }

      template.push({ type: 'separator' });
      template.push({
        label: '➕ Criar Novo Workspace (Ctrl+Alt+N)',
        click: () => {
          const win = this.windowController.getWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.EVENT_UI_ACTION, { action: 'ws-create-modal' });
          }
        }
      });

      const menu = Menu.buildFromTemplate(template);
      const win = this.windowController.getWindow();
      if (win && !win.isDestroyed()) {
        menu.popup({
          window: win,
          x: typeof x === 'number' ? Math.round(x) : undefined,
          y: typeof y === 'number' ? Math.round(y) : undefined
        });
      }
      return { success: true };
    });
  }
}

module.exports = IpcHandlerRegistry;
