/**
 * Núcleo Browser - Tab Manager (v0.7.0 Workspaces-Aware)
 * Manages Tab instances, lifecycle, active tab bounds, WebContentsViews,
 * and seamlessly partitions tabs by Workspace contexts.
 * @module modules/tabs/tab-manager
 */

const { EventEmitter } = require('events');
const Tab = require('./tab');
const AppConfig = require('../../config/app-config');

class TabManager extends EventEmitter {
  /**
   * @param {Object} browserWindowController
   * @param {Object} [historyManager]
   * @param {Object} [bookmarkManager]
   * @param {Object} [shieldManager]
   * @param {Object} [settingsManager]
   * @param {Object} [searchProvider]
   * @param {Object} [workspaceManager]
   */
  constructor(
    browserWindowController,
    historyManager = null,
    bookmarkManager = null,
    shieldManager = null,
    settingsManager = null,
    searchProvider = null,
    workspaceManager = null
  ) {
    super();
    this.windowController = browserWindowController;
    this.historyManager = historyManager;
    this.bookmarkManager = bookmarkManager;
    this.shieldManager = shieldManager;
    this.settingsManager = settingsManager;
    this.searchProvider = searchProvider;
    this.workspaceManager = workspaceManager;
    this.tabs = new Map();
    this.activeTabId = null;
    this.nextTabCounter = 1;

    if (this.workspaceManager) {
      this._attachWorkspaceEvents();
    }
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

  setWorkspaceManager(workspaceManager) {
    this.workspaceManager = workspaceManager;
    if (this.workspaceManager) {
      this._attachWorkspaceEvents();
    }
  }

  _attachWorkspaceEvents() {
    if (!this.workspaceManager) return;

    this.workspaceManager.on('workspace-switched', ({ previousId, activeId, workspace }) => {
      this._onWorkspaceSwitched(previousId, activeId, workspace);
    });

    this.workspaceManager.on('workspace-deleted', ({ id, tabIds, targetWorkspaceId }) => {
      if (targetWorkspaceId) {
        for (const tid of tabIds) {
          const tab = this.tabs.get(tid);
          if (tab) {
            tab.workspaceId = targetWorkspaceId;
          }
        }
      } else {
        // Destroy orphaned tabs
        for (const tid of tabIds) {
          const tab = this.tabs.get(tid);
          if (tab) {
            const win = this.windowController.getWindow();
            if (win?.contentView) {
              try { win.contentView.removeChildView(tab.view); } catch {}
            }
            this.tabs.delete(tid);
            tab.destroy();
          }
        }
      }
      this.emit('all-tabs-updated', this.getAllTabs());
    });
  }

  _onWorkspaceSwitched(previousWsId, newWsId, newWorkspace) {
    // 1. Hide all views belonging to previous workspace
    for (const tab of this.tabs.values()) {
      if (tab.workspaceId === previousWsId) {
        tab.setVisible(false);
      }
    }

    // 2. Identify tabs for the new workspace
    const wsTabs = this.getTabsForWorkspace(newWsId);

    if (wsTabs.length === 0) {
      // Create default new tab for this workspace
      const newTab = this.createTab(AppConfig.navigation.defaultHomepage, true, newWsId);
      this.setActiveTab(newTab.id);
    } else {
      let targetTabId = newWorkspace?.activeTabId;
      if (!targetTabId || !this.tabs.has(targetTabId) || this.tabs.get(targetTabId).workspaceId !== newWsId) {
        targetTabId = wsTabs[0].id;
      }
      this.setActiveTab(targetTabId);
    }

    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Resolves target initial URL.
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
    if (trimmed === 'nucleo://downloads' || trimmed === 'nucleo://baixados') {
      return 'nucleo://downloads';
    }
    if (
      trimmed === 'nucleo://privacy' ||
      trimmed === 'nucleo://privacidade' ||
      trimmed === 'nucleo://permissions' ||
      trimmed === 'nucleo://permissoes'
    ) {
      return 'nucleo://privacy';
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
   * Returns all tabs belonging to a specific workspace ID.
   * @param {string} [workspaceId]
   * @returns {Array<Tab>}
   */
  getTabsForWorkspace(workspaceId = null) {
    const targetWsId = workspaceId || (this.workspaceManager ? this.workspaceManager.getActiveWorkspace()?.id : null);
    if (!targetWsId) {
      return Array.from(this.tabs.values());
    }
    return Array.from(this.tabs.values()).filter((t) => t.workspaceId === targetWsId);
  }

  /**
   * Creates a new tab.
   * @param {string} [initialUrl] - Target URL to load
   * @param {boolean} [makeActive=true] - Whether to activate immediately
   * @param {string} [targetWorkspaceId=null] - Target workspace ID (defaults to active workspace)
   * @returns {Tab} The created Tab instance
   */
  createTab(initialUrl = AppConfig.navigation.defaultHomepage, makeActive = true, targetWorkspaceId = null) {
    let effectiveMakeActive = makeActive;
    if (this.settingsManager && this.settingsManager.get('tabs.openNewTabsInBackground') && arguments.length < 2) {
      effectiveMakeActive = false;
    }

    const activeWs = this.workspaceManager ? this.workspaceManager.getActiveWorkspace() : null;
    const wsId = targetWorkspaceId || (activeWs ? activeWs.id : 'workspace-pessoal');
    const isCurrentWs = !activeWs || activeWs.id === wsId;

    const resolvedUrl = this._resolveUrl(initialUrl);
    const tabId = `tab-${this.nextTabCounter++}`;
    const tab = new Tab(tabId, { url: resolvedUrl, workspaceId: wsId });

    this.tabs.set(tabId, tab);

    if (this.workspaceManager) {
      this.workspaceManager.addTabToWorkspace(wsId, tabId);
    }

    // Attach to window's view hierarchy
    const win = this.windowController.getWindow();
    if (win && win.contentView) {
      win.contentView.addChildView(tab.view);
      if (!isCurrentWs || !effectiveMakeActive) {
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
      this.createTab(url, activate, tab.workspaceId);
    });

    // Handle global keyboard shortcuts forwarded from the web content
    tab.on('keyboard-shortcut', (input, event) => {
      this._handleTabKeyboardShortcut(input, event, tabId);
    });

    this.emit('tab-created', tab.getState());
    this.emit('all-tabs-updated', this.getAllTabs());

    if (isCurrentWs && (effectiveMakeActive || !this.activeTabId)) {
      this.setActiveTab(tabId);
    } else if (!isCurrentWs && this.workspaceManager) {
      const ws = this.workspaceManager.getWorkspace(wsId);
      if (ws && !ws.activeTabId) {
        this.workspaceManager.setActiveTabForWorkspace(wsId, tabId);
      }
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
    const isAlt = input.alt;
    const key = input.key ? input.key.toLowerCase() : '';

    // Workspace shortcuts (Ctrl + Alt + ...)
    if (isCtrl && isAlt && key === 'n') {
      event.preventDefault();
      if (this.workspaceManager) {
        this.workspaceManager.createWorkspace({ name: 'Novo Workspace' }).then((ws) => {
          this.switchWorkspace(ws.id);
        });
      }
      return;
    }

    if (isCtrl && isAlt && key === 'arrowleft') {
      event.preventDefault();
      if (this.workspaceManager) {
        this.workspaceManager.switchPreviousWorkspace();
      }
      return;
    }

    if (isCtrl && isAlt && key === 'arrowright') {
      event.preventDefault();
      if (this.workspaceManager) {
        this.workspaceManager.switchNextWorkspace();
      }
      return;
    }

    if (isCtrl && isAlt && input.key >= '1' && input.key <= '8') {
      event.preventDefault();
      if (this.workspaceManager) {
        this.workspaceManager.switchToIndex(parseInt(input.key, 10) - 1);
      }
      return;
    }

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
      const currentTabs = this.getTabsForWorkspace();
      this.switchToIndex(currentTabs.length - 1);
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

    if (this.workspaceManager && newTab.workspaceId) {
      this.workspaceManager.setActiveTabForWorkspace(newTab.workspaceId, tabId);
    }

    newTab.setVisible(true);

    const contentBounds = this.windowController.getWebContentBounds();
    newTab.setBounds(contentBounds);

    this.emit('tab-activated', newTab.getState());
    this.emit('active-tab-updated', newTab.getState());
    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Closes a tab by ID.
   * If the last tab in the workspace is closed, creates a fresh new tab so the workspace is never empty.
   * @param {string} tabId
   */
  closeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const wsId = tab.workspaceId || (this.workspaceManager ? this.workspaceManager.getActiveWorkspace()?.id : null);
    const wsTabs = this.getTabsForWorkspace(wsId);
    const win = this.windowController.getWindow();

    // If closing the last tab of this workspace, create a fresh new tab first
    if (wsTabs.length === 1) {
      this.createTab(AppConfig.navigation.defaultHomepage, true, wsId);
    }

    // If closing the active tab, switch to an adjacent tab in the SAME workspace
    if (this.activeTabId === tabId) {
      const currentWsTabs = this.getTabsForWorkspace(wsId);
      const currentIndex = currentWsTabs.findIndex((t) => t.id === tabId);
      let targetId = null;

      if (currentIndex > 0) {
        targetId = currentWsTabs[currentIndex - 1].id;
      } else if (currentIndex < currentWsTabs.length - 1) {
        targetId = currentWsTabs[currentIndex + 1].id;
      } else {
        const remaining = currentWsTabs.filter((t) => t.id !== tabId);
        if (remaining.length > 0) targetId = remaining[0].id;
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

    if (this.workspaceManager && wsId) {
      this.workspaceManager.removeTabFromWorkspace(wsId, tabId);
    }

    if (this.shieldManager) {
      this.shieldManager.onTabClosed(tabId);
    }

    this.emit('tab-closed', { id: tabId });
    this.emit('all-tabs-updated', this.getAllTabs());

    tab.destroy();
  }

  /**
   * Switches workspace context.
   * @param {string} targetWorkspaceId
   */
  async switchWorkspace(targetWorkspaceId) {
    if (!this.workspaceManager) return;
    await this.workspaceManager.switchWorkspace(targetWorkspaceId);
  }

  /**
   * Moves a tab from its current workspace to another.
   * @param {string} tabId
   * @param {string} targetWorkspaceId
   * @param {boolean} [activateInTarget=false]
   */
  moveTabToWorkspace(tabId, targetWorkspaceId, activateInTarget = false) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    const sourceWsId = tab.workspaceId;
    if (sourceWsId === targetWorkspaceId) return;

    // Ensure source workspace doesn't become empty
    const sourceTabs = this.getTabsForWorkspace(sourceWsId);
    if (sourceTabs.length === 1) {
      this.createTab(AppConfig.navigation.defaultHomepage, true, sourceWsId);
    }

    // If tab was active in source workspace, switch active tab of source
    if (this.activeTabId === tabId && !activateInTarget) {
      const remainingSource = this.getTabsForWorkspace(sourceWsId).filter((t) => t.id !== tabId);
      if (remainingSource.length > 0) {
        this.setActiveTab(remainingSource[0].id);
      }
      tab.setVisible(false);
    }

    tab.workspaceId = targetWorkspaceId;

    if (this.workspaceManager) {
      this.workspaceManager.moveTab(tabId, targetWorkspaceId);
    }

    if (activateInTarget && this.workspaceManager) {
      this.workspaceManager.switchWorkspace(targetWorkspaceId).then(() => {
        this.setActiveTab(tabId);
      });
    } else {
      this.emit('all-tabs-updated', this.getAllTabs());
    }

    return { success: true };
  }

  /**
   * Duplicates a tab by ID within its current workspace.
   * @param {string} tabId
   * @returns {Tab|null}
   */
  duplicateTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return null;

    const currentUrl = tab.url;
    return this.createTab(currentUrl, true, tab.workspaceId);
  }

  /**
   * Closes all tabs except the specified target tab in the same workspace.
   * @param {string} targetTabId
   */
  closeOtherTabs(targetTabId) {
    const targetTab = this.tabs.get(targetTabId);
    if (!targetTab) return;

    const wsId = targetTab.workspaceId;
    const wsTabs = this.getTabsForWorkspace(wsId);

    this.setActiveTab(targetTabId);

    const tabsToClose = wsTabs.filter((t) => t.id !== targetTabId);
    for (const t of tabsToClose) {
      const win = this.windowController.getWindow();
      if (win?.contentView) {
        try { win.contentView.removeChildView(t.view); } catch {}
      }
      this.tabs.delete(t.id);
      if (this.workspaceManager && wsId) {
        this.workspaceManager.removeTabFromWorkspace(wsId, t.id);
      }
      this.emit('tab-closed', { id: t.id });
      t.destroy();
    }

    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Closes all tabs to the right of the specified target tab in the same workspace.
   * @param {string} targetTabId
   */
  closeTabsToTheRight(targetTabId) {
    const targetTab = this.tabs.get(targetTabId);
    if (!targetTab) return;

    const wsId = targetTab.workspaceId;
    const wsTabs = this.getTabsForWorkspace(wsId);
    const targetIndex = wsTabs.findIndex((t) => t.id === targetTabId);
    if (targetIndex === -1) return;

    const tabsToClose = wsTabs.slice(targetIndex + 1);
    if (tabsToClose.length === 0) return;

    const closingActive = tabsToClose.some((t) => t.id === this.activeTabId);
    if (closingActive) {
      this.setActiveTab(targetTabId);
    }

    for (const t of tabsToClose) {
      const win = this.windowController.getWindow();
      if (win?.contentView) {
        try { win.contentView.removeChildView(t.view); } catch {}
      }
      this.tabs.delete(t.id);
      if (this.workspaceManager && wsId) {
        this.workspaceManager.removeTabFromWorkspace(wsId, t.id);
      }
      this.emit('tab-closed', { id: t.id });
      t.destroy();
    }

    this.emit('all-tabs-updated', this.getAllTabs());
  }

  /**
   * Switches to the next tab cyclically within the active workspace.
   */
  switchNextTab() {
    const wsTabs = this.getTabsForWorkspace();
    if (wsTabs.length <= 1) return;

    const currentIndex = wsTabs.findIndex((t) => t.id === this.activeTabId);
    const nextIndex = (currentIndex + 1) % wsTabs.length;
    this.setActiveTab(wsTabs[nextIndex].id);
  }

  /**
   * Switches to the previous tab cyclically within the active workspace.
   */
  switchPreviousTab() {
    const wsTabs = this.getTabsForWorkspace();
    if (wsTabs.length <= 1) return;

    const currentIndex = wsTabs.findIndex((t) => t.id === this.activeTabId);
    const prevIndex = (currentIndex - 1 + wsTabs.length) % wsTabs.length;
    this.setActiveTab(wsTabs[prevIndex].id);
  }

  /**
   * Switches to a specific tab index (0-based) within the active workspace.
   * @param {number} index
   */
  switchToIndex(index) {
    const wsTabs = this.getTabsForWorkspace();
    if (index >= 0 && index < wsTabs.length) {
      this.setActiveTab(wsTabs[index].id);
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
   * Sets the active tab view visibility.
   * @param {boolean} visible
   */
  setActiveTabVisible(visible) {
    const tab = this.getActiveTab();
    if (tab) {
      tab.setVisible(Boolean(visible));
    }
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
   * Returns state list of tabs in the currently active workspace.
   * @param {string} [forWorkspaceId=null]
   * @returns {Array<Object>}
   */
  getAllTabs(forWorkspaceId = null) {
    const wsTabs = this.getTabsForWorkspace(forWorkspaceId);
    return wsTabs.map((t) => ({
      ...t.getState(),
      isActive: t.id === this.activeTabId
    }));
  }

  /**
   * Returns state list of ALL tabs across ALL workspaces.
   * @returns {Array<Object>}
   */
  getAllTabsGlobal() {
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
