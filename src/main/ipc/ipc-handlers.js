/**
 * Núcleo Browser - IPC Handler Registry
 * @module ipc/ipc-handlers
 */

const { ipcMain, dialog } = require('electron');
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
    workspaceManager = null
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
  }

  _validateInternalSender(event) {
    if (!event || !event.senderFrame) return true;
    const url = event.senderFrame.url;
    if (!url) return true;
    if (url.startsWith('nucleo://') || url.startsWith('file://')) {
      return true;
    }
    throw new Error('Acesso negado: páginas web externas não podem acessar as APIs de Workspaces.');
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
}

module.exports = IpcHandlerRegistry;
