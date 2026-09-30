/**
 * Núcleo Browser - Window Controller
 * @module core/browser-window
 */

const { BrowserWindow } = require('electron');
const path = require('path');
const AppConfig = require('../config/app-config');
const IPC_CHANNELS = require('../ipc/ipc-channels');

class BrowserWindowController {
  constructor() {
    this.window = null;
    this.tabManager = null;
  }

  setTabManager(tabManager) {
    this.tabManager = tabManager;
  }

  /**
   * Creates and displays the main browser window.
   */
  createMainWindow() {
    const iconPath = path.join(AppConfig.paths.icons, 'icon.ico');

    this.window = new BrowserWindow({
      title: AppConfig.appName,
      width: AppConfig.window.defaultWidth,
      height: AppConfig.window.defaultHeight,
      minWidth: AppConfig.window.minWidth,
      minHeight: AppConfig.window.minHeight,
      backgroundColor: AppConfig.window.backgroundColor,
      frame: false, // Custom frameless window for bespoke Núcleo identity
      icon: iconPath,
      show: false, // Shown gracefully on ready-to-show
      webPreferences: {
        preload: AppConfig.paths.preload,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        enableRemoteModule: false,
        webSecurity: true,
        spellcheck: false
      }
    });

    // Load the browser chrome UI
    this.window.loadFile(AppConfig.paths.rendererHtml);

    this._attachWindowEvents();

    return this.window;
  }

  _attachWindowEvents() {
    const win = this.window;

    win.once('ready-to-show', () => {
      win.show();
      if (this.tabManager) {
        this.tabManager.updateActiveTabBounds();
      }
    });

    const notifyResize = () => {
      if (this.tabManager) {
        this.tabManager.updateActiveTabBounds();
      }
      this._emitWindowState();
    };

    win.on('resize', notifyResize);
    win.on('maximize', notifyResize);
    win.on('unmaximize', notifyResize);
    win.on('enter-full-screen', notifyResize);
    win.on('leave-full-screen', notifyResize);

    win.on('closed', () => {
      this.window = null;
    });
  }

  _emitWindowState() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.EVENT_WINDOW_STATE_CHANGED, {
        isMaximized: this.window.isMaximized(),
        isFullScreen: this.window.isFullScreen()
      });
    }
  }

  /**
   * Calculates the bounds for the active web contents view (under the toolbar).
   * @returns {{ x: number, y: number, width: number, height: number }}
   */
  getWebContentBounds() {
    if (!this.window || this.window.isDestroyed()) {
      return { x: 0, y: AppConfig.ui.toolbarHeight, width: 800, height: 600 };
    }

    const [width, height] = this.window.getContentSize();
    const toolbarHeight = AppConfig.ui.toolbarHeight;

    return {
      x: 0,
      y: toolbarHeight,
      width: width,
      height: Math.max(0, height - toolbarHeight)
    };
  }

  /**
   * Toggles or sets bookmarks bar visibility and updates web content bounds.
   * @param {boolean} [visible]
   */
  setBookmarksBarVisible(visible) {
    AppConfig.ui.bookmarksBarVisible = Boolean(visible);
    AppConfig.ui.toolbarHeight = AppConfig.ui.bookmarksBarVisible
      ? AppConfig.ui.baseToolbarHeight + AppConfig.ui.bookmarksBarHeight
      : AppConfig.ui.baseToolbarHeight;

    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send(IPC_CHANNELS.EVENT_BOOKMARKS_BAR_TOGGLED, {
        visible: AppConfig.ui.bookmarksBarVisible,
        toolbarHeight: AppConfig.ui.toolbarHeight
      });
    }

    if (this.tabManager) {
      this.tabManager.updateActiveTabBounds();
    }

    return AppConfig.ui.bookmarksBarVisible;
  }

  toggleBookmarksBar() {
    return this.setBookmarksBarVisible(!AppConfig.ui.bookmarksBarVisible);
  }

  isBookmarksBarVisible() {
    return Boolean(AppConfig.ui.bookmarksBarVisible);
  }

  minimize() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.minimize();
    }
  }

  maximizeToggle() {
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMaximized()) {
        this.window.unmaximize();
      } else {
        this.window.maximize();
      }
    }
  }

  close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  isMaximized() {
    return this.window && !this.window.isDestroyed() ? this.window.isMaximized() : false;
  }

  getWindow() {
    return this.window;
  }
}

module.exports = BrowserWindowController;
