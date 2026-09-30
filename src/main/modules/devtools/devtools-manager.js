/**
 * Núcleo Browser - DevTools Manager
 * @module modules/devtools/devtools-manager
 */

class DevToolsManager {
  constructor(browserWindowController, tabManager) {
    this.windowController = browserWindowController;
    this.tabManager = tabManager;
  }

  /**
   * Toggles Chromium DevTools for the currently active web page.
   */
  toggleWebContentsDevTools() {
    const activeTab = this.tabManager.getActiveTab();
    if (!activeTab || !activeTab.webContents) {
      console.warn('[DevToolsManager] No active webContents to inspect');
      return;
    }

    const wc = activeTab.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: 'right' });
    }
  }

  /**
   * Toggles DevTools for the browser UI chrome itself.
   */
  toggleChromeDevTools() {
    const win = this.windowController.getWindow();
    if (!win || win.isDestroyed()) return;

    const wc = win.webContents;
    if (wc.isDevToolsOpened()) {
      wc.closeDevTools();
    } else {
      wc.openDevTools({ mode: 'detach' });
    }
  }
}

module.exports = DevToolsManager;
