/**
 * Núcleo Browser - Tab Manager
 * @module modules/tabs/tab-manager
 */

const { EventEmitter } = require('events');
const { pathToFileURL } = require('url');
const Tab = require('./tab');
const AppConfig = require('../../config/app-config');

class TabManager extends EventEmitter {
  constructor(browserWindowController, historyManager = null, bookmarkManager = null, shieldManager = null, settingsManager = null, searchProvider = null) {
    super();
    this.windowController = browserWindowController;
    this.historyManager = historyManager;
    this.bookmarkManager = bookmarkManager;
    this.shieldManager = shieldManager;
    this.settingsManager = settingsManager;
    this.searchProvider = searchProvider;
    this.tabs = new Map();
    this.activeTabId = null;
    this.nextTabCounter = 1;
  }

  setShieldManager(shieldManager) {
    this.shieldManager = shieldManager;
  }

  setSettingsManager(settingsManager) {
    this.settingsManager = settingsManager;
  }

  setSearchProvider(searchProvider) {
    this.searchProvider = searchProvider;
  }

  /**
   * Resolves target initial URL.
   * If URL is 'nucleo://newtab' or empty, resolves to 'nucleo://newtab'.
   * @param {string} [url]
   * @returns {string}
   */
  _resolveUrl(url) {
    if (!url || url === 'nucleo://newtab' || url === 'about:blank') {
      if (this.settingsManager && this.settingsManager.get('newTab.mode') === 'custom') {
        const customUrl = this.settingsManager.get('newTab.customUrl');
        if (customUrl && customUrl !== 'https://') return customUrl;
      }
      return 'nucleo://newtab';
    }

    const trimmed = typeof url === 'string' ? url.trim() : '';
    if (!trimmed) {
      return 'nucleo://newtab';
    }

    // Block dangerous pseudo-protocols
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return 'about:blank';
    }

    if (trimmed === 'nucleo://bookmarks' || trimmed === 'nucleo://favoritos') {
      return 'nucleo://bookmarks';
    }

    if (trimmed === 'nucleo://history' || trimmed === 'nucleo://historico') {
      return 'nucleo://history';
    }

    if (trimmed === 'nucleo://shield' || trimmed === 'nucleo://protecao') {
      return 'nucleo://shield';
    }

    if (trimmed === 'nucleo://shield-test') {
      return 'nucleo://shield-test';
    }

    if (trimmed === 'nucleo://extensions' || trimmed === 'nucleo://extensoes') {
      return 'nucleo://extensions';
    }

    if (trimmed === 'nucleo://extension-test') {
      return 'nucleo://extension-test';
    }

    if (trimmed === 'nucleo://settings' || trimmed === 'nucleo://configuracoes') {
      return 'nucleo://settings';
    }

    if (/^nucleo:\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (/^(https?|file|ftp):\/\//i.test(trimmed)) {
      return trimmed;
    }

    if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return `http://${trimmed}`;
    }

    if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(trimmed)) {
      return `https://${trimmed}`;
    }

    if (this.searchProvider && typeof this.searchProvider.buildSearchUrl === 'function') {
      return this.searchProvider.buildSearchUrl(trimmed);
    }

    return AppConfig.navigation.defaultSearchEngine.searchUrl.replace('%s', encodeURIComponent(trimmed));
  }

  /**
   * Creates a new tab.
   * @param {string} [initialUrl] - Target URL to load
   * @param {boolean} [makeActive=true] - Whether to activate immediately
   * @returns {Tab} The created Tab instance
   */
  createTab(initialUrl = AppConfig.navigation.defaultHomepage, makeActive = true) {
    let effectiveMakeActive = makeActive;
    if (this.settingsManager && this.settingsManager.get('tabs.openNewTabsInBackground') && arguments.length < 2) {
      effectiveMakeActive = false;
    }

    const resolvedUrl = this._resolveUrl(initialUrl);
    const tabId = `tab-${this.nextTabCounter++}`;
    const tab = new Tab(tabId, { url: resolvedUrl });

    this.tabs.set(tabId, tab);

    // Attach to window's view hierarchy
    const win = this.windowController.getWindow();
    if (win && win.contentView) {
      win.contentView.addChildView(tab.view);
      if (!makeActive) {
        tab.setVisible(false);
      }
    }

    // Forward tab update events
    tab.on('updated', (state) => {
      this.emit('tab-updated', state);
      if (this.activeTabId === tabId) {
        this.emit('active-tab-updated', state);
      }
      this.emit('all-tabs-updated', this.getAllTabs());
    });

    // Automatic history visit recording
    tab.on('navigated', ({ url, title }) => {
      if (this.historyManager) {
        this.historyManager.addVisit({
          url,
          title,
          favicon: tab.favicon,
          isPrivate: tab.isPrivate
        });
      }
      if (this.shieldManager) {
        this.shieldManager.onTabNavigated(tab.id, url);
      }
    });

    tab.on('title-updated', ({ url, title }) => {
      if (this.historyManager) {
        this.historyManager.updateTitle(url, title);
      }
    });

    // Bookmarking from shortcuts in tab
    tab.on('bookmark-toggle', async () => {
      if (!this.bookmarkManager) return;
      const isBm = this.bookmarkManager.isBookmarked(tab.url);
      if (isBm) {
        await this.bookmarkManager.removeBookmarkByUrl(tab.url);
      } else {
        await this.bookmarkManager.addBookmark({
          title: tab.title,
          url: tab.url,
          favicon: tab.favicon
        });
      }
    });

    tab.on('bookmarks-bar-toggle', () => {
      this.windowController.toggleBookmarksBar();
    });

    // Handle target="_blank" and window.open requests from web pages
    tab.on('request-new-tab', ({ url, disposition }) => {
      const activate = disposition !== 'background-tab';
      this.createTab(url, activate);
    });

    // Handle global keyboard shortcuts forwarded from the web content
    tab.on('keyboard-shortcut', (input, event) => {
      this._handleTabKeyboardShortcut(input, event, tabId);
    });

    this.emit('tab-created', tab.getState());
    this.emit('all-tabs-updated', this.getAllTabs());

    if (makeActive || !this.activeTabId) {
      this.setActiveTab(tabId);
    }

    if (resolvedUrl) {
      tab.loadUrl(resolvedUrl);
    }

    return tab;
  }

  /**
   * Handles keyboard shortcuts even when a WebContentsView is focused.
   */
  _handleTabKeyboardShortcut(input, event, tabId) {
    const isCtrl = input.control || input.meta;
    const isShift = input.shift;
    const key = input.key ? input.key.toLowerCase() : '';

    if (isCtrl && isShift && key === 'b') {
      event.preventDefault();
      this.windowController.toggleBookmarksBar();
      return;
    }

    if (isCtrl && key === 'd') {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      if (tab && this.bookmarkManager) {
        const isBm = this.bookmarkManager.isBookmarked(tab.url);
        if (isBm) {
          this.bookmarkManager.removeBookmarkByUrl(tab.url);
        } else {
          this.bookmarkManager.addBookmark({
            title: tab.title,
            url: tab.url,
            favicon: tab.favicon
          });
        }
      }
      return;
    }

    if (isCtrl && key === 't') {
      event.preventDefault();
      this.createTab();
    } else if (isCtrl && key === 'w') {
      event.preventDefault();
      this.closeTab(tabId);
    } else if (isCtrl && isShift && key === 'tab') {
      event.preventDefault();
      this.switchPreviousTab();
    } else if (isCtrl && key === 'tab') {
      event.preventDefault();
      this.switchNextTab();
    } else if (isCtrl && input.key >= '1' && input.key <= '8') {
      event.preventDefault();
      this.switchToIndex(parseInt(input.key, 10) - 1);
    } else if (isCtrl && input.key === '9') {
      event.preventDefault();
      this.switchToIndex(this.tabs.size - 1);
    } else if ((isCtrl && key === 'r') || key === 'f5') {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      tab?.reload();
    } else if (input.alt && input.key === 'ArrowLeft') {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      tab?.goBack();
    } else if (input.alt && input.key === 'ArrowRight') {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      tab?.goForward();
    } else if (key === 'f12') {
      event.preventDefault();
      const tab = this.tabs.get(tabId);
      if (tab?.webContents?.isDevToolsOpened()) {
        tab.webContents.closeDevTools();
      } else {
        tab?.webContents?.openDevTools({ mode: 'right' });
      }
    }
  }

  /**
   * Sets the active tab by ID.
   * @param {string} tabId
   */
  setActiveTab(tabId) {
    const newTab = this.tabs.get(tabId);
    if (!newTab) return;

    if (this.activeTabId && this.activeTabId !== tabId) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        currentTab.setVisible(false);
      }
    }

    this.activeTabId = tabId;
    newTab.setVisible(true);

    // Update bounds to fit the current window content area
    const contentBounds = this.windowController.getWebContentBounds();
    newTab.setBounds(contentBounds);

    this.emit('tab-activated', newTab.getState());
    this.emit('active-tab-updated', newTab.getState());
    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Closes a tab by ID.
   * If the last tab is closed, a fresh new tab is created so the window is never empty.
   * @param {string} tabId
   */
  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const win = this.windowController.getWindow();

    // If closing the last tab, create a new fresh tab first
    if (this.tabs.size === 1) {
      this.createTab(AppConfig.navigation.defaultHomepage, true);
    }

    // If closing the active tab, switch to an adjacent tab
    if (this.activeTabId === tabId) {
      const keys = Array.from(this.tabs.keys());
      const currentIndex = keys.indexOf(tabId);
      let targetId = null;

      if (currentIndex > 0) {
        targetId = keys[currentIndex - 1];
      } else if (currentIndex < keys.length - 1) {
        targetId = keys[currentIndex + 1];
      }

      if (targetId && targetId !== tabId) {
        this.setActiveTab(targetId);
      }
    }

    if (win && win.contentView) {
      try {
        win.contentView.removeChildView(tab.view);
      } catch (err) {
        console.warn(`[TabManager] Error removing view for tab ${tabId}:`, err.message);
      }
    }

    this.tabs.delete(tabId);
    if (this.shieldManager) {
      this.shieldManager.onTabClosed(tabId);
    }
    this.emit('tab-closed', { id: tabId });
    this.emit('all-tabs-updated', this.getAllTabs());

    tab.destroy();
  }

  /**
   * Duplicates a tab by ID.
   * @param {string} tabId
   * @returns {Tab|null}
   */
  duplicateTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const currentUrl = tab.url;
    return this.createTab(currentUrl, true);
  }

  /**
   * Closes all tabs except the specified target tab.
   * @param {string} targetTabId
   */
  closeOtherTabs(targetTabId) {
    if (!this.tabs.has(targetTabId)) return;

    this.setActiveTab(targetTabId);

    const otherTabIds = Array.from(this.tabs.keys()).filter((id) => id !== targetTabId);
    for (const id of otherTabIds) {
      const t = this.tabs.get(id);
      if (t) {
        const win = this.windowController.getWindow();
        if (win?.contentView) {
          try {
            win.contentView.removeChildView(t.view);
          } catch {}
        }
        this.tabs.delete(id);
        this.emit('tab-closed', { id });
        t.destroy();
      }
    }

    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Closes all tabs to the right of the specified target tab.
   * @param {string} targetTabId
   */
  closeTabsToTheRight(targetTabId) {
    const keys = Array.from(this.tabs.keys());
    const targetIndex = keys.indexOf(targetTabId);
    if (targetIndex === -1) return;

    const tabsToClose = keys.slice(targetIndex + 1);
    if (tabsToClose.length === 0) return;

    // If active tab is among those to be closed, activate targetTabId
    if (tabsToClose.includes(this.activeTabId)) {
      this.setActiveTab(targetTabId);
    }

    for (const id of tabsToClose) {
      const t = this.tabs.get(id);
      if (t) {
        const win = this.windowController.getWindow();
        if (win?.contentView) {
          try {
            win.contentView.removeChildView(t.view);
          } catch {}
        }
        this.tabs.delete(id);
        this.emit('tab-closed', { id });
        t.destroy();
      }
    }

    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Switches to the next tab cyclically.
   */
  switchNextTab() {
    const keys = Array.from(this.tabs.keys());
    if (keys.length <= 1) return;

    const currentIndex = keys.indexOf(this.activeTabId);
    const nextIndex = (currentIndex + 1) % keys.length;
    this.setActiveTab(keys[nextIndex]);
  }

  /**
   * Switches to the previous tab cyclically.
   */
  switchPreviousTab() {
    const keys = Array.from(this.tabs.keys());
    if (keys.length <= 1) return;

    const currentIndex = keys.indexOf(this.activeTabId);
    const prevIndex = (currentIndex - 1 + keys.length) % keys.length;
    this.setActiveTab(keys[prevIndex]);
  }

  /**
   * Switches to a specific tab index (0-based).
   * @param {number} index
   */
  switchToIndex(index) {
    const keys = Array.from(this.tabs.keys());
    if (index >= 0 && index < keys.length) {
      this.setActiveTab(keys[index]);
    }
  }

  /**
   * Gets the active tab instance.
   * @returns {Tab|null}
   */
  getActiveTab() {
    return this.activeTabId ? this.tabs.get(this.activeTabId) : null;
  }

  /**
   * Gets a specific tab by ID.
   * @param {string} tabId
   * @returns {Tab|null}
   */
  getTab(tabId) {
    return this.tabs.get(tabId) || null;
  }

  /**
   * Finds a Tab instance by its webContents ID.
   * @param {number} webContentsId
   * @returns {Tab|null}
   */
  getTabByWebContentsId(webContentsId) {
    if (!webContentsId) return null;
    for (const tab of this.tabs.values()) {
      if (tab.webContents && tab.webContents.id === webContentsId) {
        return tab;
      }
    }
    return null;
  }

  /**
   * Returns state list of all tabs.
   * @returns {Array<Object>}
   */
  getAllTabs() {
    return Array.from(this.tabs.values()).map((t) => ({
      ...t.getState(),
      isActive: t.id === this.activeTabId
    }));
  }

  /**
   * Updates bounds for the currently active tab when the window resizes.
   */
  updateActiveTabBounds() {
    const activeTab = this.getActiveTab();
    if (activeTab) {
      const bounds = this.windowController.getWebContentBounds();
      activeTab.setBounds(bounds);
    }
  }

  /**
   * Cleans up all tabs on browser shutdown.
   */
  destroyAll() {
    for (const tab of this.tabs.values()) {
      tab.destroy();
    }
    this.tabs.clear();
    this.activeTabId = null;
  }
}

module.exports = TabManager;
