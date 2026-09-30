/**
 * Núcleo Browser - Application Lifecycle & Orchestration
 * @module app
 */

const { app } = require('electron');
const AppConfig = require('./config/app-config');
const BrowserEngine = require('./core/browser-engine');
const BrowserWindowController = require('./core/browser-window');
const TabManager = require('./modules/tabs/tab-manager');
const NavigationController = require('./modules/navigation/navigation-controller');
const DevToolsManager = require('./modules/devtools/devtools-manager');
const { BookmarkManager } = require('./modules/bookmarks');
const { HistoryManager } = require('./modules/history');
const { ShieldManager } = require('./modules/shield');
const { ExtensionManager } = require('./modules/extensions');
const { SettingsManager } = require('./modules/settings');
const { SearchProvider } = require('./modules/search');
const { DefaultBrowserManager } = require('./modules/default-browser');
const IpcHandlerRegistry = require('./ipc/ipc-handlers');
const path = require('path');

class NucleoApplication {
  constructor() {
    this.engine = new BrowserEngine();
    this.windowController = new BrowserWindowController();
    this.bookmarkManager = new BookmarkManager();
    this.historyManager = new HistoryManager();
    this.shieldManager = new ShieldManager();
    this.extensionManager = new ExtensionManager(this.engine);
    this.settingsManager = new SettingsManager();
    this.searchProvider = new SearchProvider(this.settingsManager);
    this.defaultBrowserManager = new DefaultBrowserManager(this.settingsManager);
    this.tabManager = null;
    this.navigationController = null;
    this.devToolsManager = null;
    this.ipcRegistry = null;
  }

  async start() {
    // Enforce single instance lock
    const gotSingleInstanceLock = app.requestSingleInstanceLock();
    if (!gotSingleInstanceLock) {
      console.warn('[Núcleo] Another instance is already running. Quitting.');
      app.quit();
      return;
    }

    app.on('second-instance', () => {
      const win = this.windowController.getWindow();
      if (win) {
        if (win.isMinimized()) win.restore();
        win.focus();
      }
    });

    await app.whenReady();
    console.log(`[Núcleo Browser] Starting v${AppConfig.appVersion}...`);

    // 1. Initialize Chromium Engine, Session Policies, and Internal Protocol
    await this.engine.initialize();

    // 2. Initialize Settings, Bookmarks, History, Shield and Extensions Subsystems
    await this.settingsManager.initialize();
    await this.bookmarkManager.initialize();
    await this.historyManager.initialize();
    await this.shieldManager.initialize();
    await this.extensionManager.initialize();

    // 3. Configure Download and Privacy Session Policies
    this._setupSessionPolicies();

    // 4. Instantiate Tab Manager
    this.tabManager = new TabManager(
      this.windowController,
      this.historyManager,
      this.bookmarkManager,
      this.shieldManager,
      this.settingsManager,
      this.searchProvider
    );
    this.windowController.setTabManager(this.tabManager);

    // 5. Attach Shield Network Interceptor
    this.shieldManager.attachToSession(this.engine.getSession(), this.tabManager, this.windowController);

    // 6. Instantiate Controllers
    this.navigationController = new NavigationController(this.tabManager, this.searchProvider);
    this.devToolsManager = new DevToolsManager(this.windowController, this.tabManager);

    // 7. Register IPC Handlers
    this.ipcRegistry = new IpcHandlerRegistry({
      windowController: this.windowController,
      tabManager: this.tabManager,
      navigationController: this.navigationController,
      devToolsManager: this.devToolsManager,
      bookmarkManager: this.bookmarkManager,
      historyManager: this.historyManager,
      shieldManager: this.shieldManager,
      extensionManager: this.extensionManager,
      settingsManager: this.settingsManager,
      searchProvider: this.searchProvider,
      defaultBrowserManager: this.defaultBrowserManager,
      browserEngine: this.engine
    });
    this.ipcRegistry.registerAll();

    // 8. Create Main Window
    this.windowController.createMainWindow();

    // 9. Create Initial Tabs according to startup mode
    this._createStartupTabs();

    this._setupLifecycleEvents();
  }

  _setupSessionPolicies() {
    const session = this.engine.getSession();
    if (!session) return;

    // Handle Downloads location and prompt preferences
    session.on('will-download', (event, item) => {
      const ask = this.settingsManager.get('downloads.askLocation');
      const defaultPath = this.settingsManager.get('downloads.defaultPath');
      if (!ask && defaultPath) {
        const filename = item.getFilename();
        item.setSavePath(path.join(defaultPath, filename));
      }
    });

    // Handle Do Not Track header injection
    session.webRequest.onBeforeSendHeaders((details, callback) => {
      if (this.settingsManager && this.settingsManager.get('privacy.doNotTrack')) {
        details.requestHeaders['DNT'] = '1';
      }
      callback({ requestHeaders: details.requestHeaders });
    });
  }

  _createStartupTabs() {
    const mode = this.settingsManager.get('startup.mode');
    const specificUrls = this.settingsManager.get('startup.urls') || [];

    if (mode === 'specific' && specificUrls.length > 0) {
      specificUrls.forEach((u, i) => {
        this.tabManager.createTab(u, i === 0);
      });
    } else {
      this.tabManager.createTab(AppConfig.navigation.defaultHomepage, true);
    }
  }

  _setupLifecycleEvents() {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        this.tabManager?.destroyAll();
        app.quit();
      }
    });

    app.on('activate', () => {
      if (!this.windowController.getWindow()) {
        this.windowController.createMainWindow();
      }
    });

    // Graceful cleanup on before-quit
    app.on('before-quit', async () => {
      if (this.settingsManager && this.settingsManager.get('privacy.clearOnExit')) {
        const items = this.settingsManager.get('privacy.clearOnExitItems') || {};
        const session = this.engine.getSession();
        if (items.cache && session) {
          session.clearCache().catch(() => {});
        }
        if (items.cookies && session) {
          session.clearStorageData({ storages: ['cookies'] }).catch(() => {});
        }
        if (items.history && this.historyManager) {
          this.historyManager.clearByPeriod('all').catch(() => {});
        }
      }
      this.tabManager?.destroyAll();
    });
  }
}

module.exports = NucleoApplication;
