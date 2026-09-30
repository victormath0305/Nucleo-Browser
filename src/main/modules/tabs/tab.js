/**
 * Núcleo Browser - Tab Abstraction
 * @module modules/tabs/tab
 */

const { WebContentsView } = require('electron');
const { EventEmitter } = require('events');
const AppConfig = require('../../config/app-config');

class Tab extends EventEmitter {
  constructor(id, options = {}) {
    super();
    this.id = id;
    this.title = options.title || 'Nova Aba';
    this.url = options.url || 'nucleo://newtab';
    this.favicon = options.favicon || null;
    this.isLoading = false;
    this.canNavigateBack = false;
    this.canNavigateForward = false;
    this.isSecure = false;
    this.isPrivate = options.isPrivate || false;
    this.createdAt = Date.now();

    // Create the isolated WebContentsView
    this.view = new WebContentsView({
      webPreferences: {
        preload: AppConfig.paths.preload,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        enableRemoteModule: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        spellcheck: true
      }
    });

    this.webContents = this.view.webContents;
    this._attachWebContentsEvents();
    this._setupWindowOpenHandler();
    this._setupKeyboardShortcuts();
  }

  _attachWebContentsEvents() {
    const wc = this.webContents;

    wc.on('did-start-loading', () => {
      this.isLoading = true;
      this._notifyUpdate();
    });

    wc.on('did-stop-loading', () => {
      this.isLoading = false;
      this._updateFromCurrentState();
      this._notifyUpdate();
    });

    wc.on('did-navigate', (event, url) => {
      this.url = url;
      this._updateFromCurrentState();
      this._notifyUpdate();
      this.emit('navigated', { url: this.url, title: this.title });
    });

    wc.on('did-navigate-in-page', (event, url) => {
      this.url = url;
      this._updateFromCurrentState();
      this._notifyUpdate();
      this.emit('navigated', { url: this.url, title: this.title });
    });

    wc.on('page-title-updated', (event, title) => {
      if (this.isNewTabPage()) {
        this.title = 'Nova Aba';
      } else if (this.url.startsWith('nucleo://bookmarks')) {
        this.title = 'Favoritos — Núcleo';
      } else if (this.url.startsWith('nucleo://history')) {
        this.title = 'Histórico — Núcleo';
      } else if (this.url.startsWith('nucleo://shield-test')) {
        this.title = 'Shield Test Fixture — Núcleo';
      } else if (this.url.startsWith('nucleo://shield') || this.url.startsWith('nucleo://protecao')) {
        this.title = 'Núcleo Shield — Proteção';
      } else if (this.url.startsWith('nucleo://extension-test')) {
        this.title = 'Extension Test Fixture — Núcleo';
      } else if (this.url.startsWith('nucleo://extensions') || this.url.startsWith('nucleo://extensoes')) {
        this.title = 'Extensões — Núcleo';
      } else if (this.url.startsWith('nucleo://settings') || this.url.startsWith('nucleo://configuracoes')) {
        this.title = 'Configurações — Núcleo';
      } else {
        this.title = title || 'Sem título';
      }
      this._notifyUpdate();
      this.emit('title-updated', { url: this.url, title: this.title });
    });

    wc.on('page-favicon-updated', (event, favicons) => {
      if (favicons && favicons.length > 0) {
        const candidate = favicons[0];
        // Ensure safe favicon URL (http, https or data URI)
        if (typeof candidate === 'string' && /^(https?:\/\/|data:image\/)/i.test(candidate)) {
          this.favicon = candidate;
          this._notifyUpdate();
        }
      }
    });

    wc.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      // Ignore aborts (e.g. when user clicks another link while loading)
      if (errorCode === -3) return;
      console.warn(`[Tab ${this.id}] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
      this.isLoading = false;
      this._notifyUpdate();
    });
  }

  _updateFromCurrentState() {
    const wc = this.webContents;
    const currentUrl = wc.getURL();
    if (currentUrl) {
      this.url = currentUrl;
    }

    if (this.isNewTabPage()) {
      this.title = 'Nova Aba';
      this.favicon = null;
      this.isSecure = true;
    } else if (this.url.startsWith('nucleo://bookmarks')) {
      this.title = 'Favoritos — Núcleo';
      this.isSecure = true;
    } else if (this.url.startsWith('nucleo://history')) {
      this.title = 'Histórico — Núcleo';
      this.isSecure = true;
    } else if (this.url.startsWith('nucleo://shield-test')) {
      this.title = 'Shield Test Fixture — Núcleo';
      this.isSecure = true;
    } else if (this.url.startsWith('nucleo://shield') || this.url.startsWith('nucleo://protecao')) {
      this.title = 'Núcleo Shield — Proteção';
      this.isSecure = true;
    } else {
      this.isSecure = this.url.startsWith('https://');
    }

    this.canNavigateBack = this.canGoBack();
    this.canNavigateForward = this.canGoForward();
  }

  _setupWindowOpenHandler() {
    // Intercept target="_blank" and window.open to open in a new Tab instead of an unmanaged window
    this.webContents.setWindowOpenHandler((details) => {
      const targetUrl = details.url;
      try {
        const parsed = new URL(targetUrl);
        if (['http:', 'https:', 'nucleo:'].includes(parsed.protocol)) {
          this.emit('request-new-tab', {
            url: targetUrl,
            disposition: details.disposition || 'foreground-tab'
          });
        }
      } catch (err) {
        console.warn(`[Tab ${this.id}] Blocked invalid popup URL:`, targetUrl);
      }
      return { action: 'deny' };
    });
  }

  _setupKeyboardShortcuts() {
    // Forward keyboard shortcuts while the web view has focus to the TabManager / main process
    this.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown') {
        const isCtrl = input.control || input.meta;
        const key = input.key ? input.key.toLowerCase() : '';

        if (isCtrl && input.shift && key === 'b') {
          event.preventDefault();
          this.emit('bookmarks-bar-toggle');
          return;
        }

        if (isCtrl && key === 'd') {
          event.preventDefault();
          this.emit('bookmark-toggle');
          return;
        }

        this.emit('keyboard-shortcut', input, event);
      }
    });
  }

  isNewTabPage() {
    return (
      !this.url ||
      this.url === 'nucleo://newtab' ||
      this.url === 'nucleo://newtab/' ||
      this.url.includes('newtab.html') ||
      this.url === 'about:blank'
    );
  }

  isInternalPage() {
    return (
      !this.url ||
      this.url.startsWith('nucleo://') ||
      this.url === 'about:blank' ||
      this.url.includes('newtab.html') ||
      this.url.includes('bookmarks.html') ||
      this.url.includes('history.html') ||
      this.url.includes('shield.html') ||
      this.url.includes('shield-test.html') ||
      this.url.includes('extensions.html') ||
      this.url.includes('extension-test.html') ||
      this.url.includes('settings.html')
    );
  }

  _notifyUpdate() {
    this.emit('updated', this.getState());
  }

  getState() {
    return {
      id: this.id,
      title: this.title,
      url: this.url,
      favicon: this.favicon,
      isLoading: this.isLoading,
      canGoBack: this.canNavigateBack,
      canGoForward: this.canNavigateForward,
      isSecure: this.isSecure,
      isNewTab: this.isNewTabPage(),
      isPrivate: this.isPrivate
    };
  }

  async loadUrl(url) {
    try {
      this.url = url;
      if (this.isNewTabPage()) {
        this.title = 'Nova Aba';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://newtab');
        return;
      }

      if (url === 'nucleo://bookmarks' || url.startsWith('nucleo://bookmarks')) {
        this.title = 'Favoritos — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://bookmarks');
        return;
      }

      if (url === 'nucleo://history' || url.startsWith('nucleo://history')) {
        this.title = 'Histórico — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://history');
        return;
      }

      if (url === 'nucleo://shield-test' || url.startsWith('nucleo://shield-test')) {
        this.title = 'Shield Test Fixture — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://shield-test');
        return;
      }

      if (url === 'nucleo://shield' || url.startsWith('nucleo://shield/') || url.startsWith('nucleo://protecao')) {
        this.title = 'Núcleo Shield — Proteção';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://shield');
        return;
      }

      if (url === 'nucleo://extension-test' || url.startsWith('nucleo://extension-test')) {
        this.title = 'Extension Test Fixture — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://extension-test');
        return;
      }

      if (url === 'nucleo://extensions' || url.startsWith('nucleo://extensions/') || url.startsWith('nucleo://extensoes')) {
        this.title = 'Extensões — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://extensions');
        return;
      }

      if (url === 'nucleo://settings' || url.startsWith('nucleo://settings/') || url.startsWith('nucleo://configuracoes')) {
        this.title = 'Configurações — Núcleo';
        this.isSecure = true;
        this._notifyUpdate();
        await this.webContents.loadURL('nucleo://settings');
        return;
      }

      this.isSecure = url.startsWith('https://');
      this._notifyUpdate();
      await this.webContents.loadURL(url);
    } catch (error) {
      if (!this.webContents || this.webContents.isDestroyed() || error.code === 'ERR_ABORTED' || error.code === 'ERR_FAILED') {
        return;
      }
      console.error(`[Tab ${this.id}] Error loading URL:`, error.message);
    }
  }

  goBack() {
    if (this.canGoBack()) {
      if (this.webContents.navigationHistory?.goBack) {
        this.webContents.navigationHistory.goBack();
      } else {
        this.webContents.goBack();
      }
    }
  }

  goForward() {
    if (this.canGoForward()) {
      if (this.webContents.navigationHistory?.goForward) {
        this.webContents.navigationHistory.goForward();
      } else {
        this.webContents.goForward();
      }
    }
  }

  reload() {
    this.webContents.reload();
  }

  stop() {
    this.webContents.stop();
  }

  canGoBack() {
    if (this.webContents.navigationHistory?.canGoBack) {
      return this.webContents.navigationHistory.canGoBack();
    }
    return typeof this.webContents.canGoBack === 'function' ? this.webContents.canGoBack() : false;
  }

  canGoForward() {
    if (this.webContents.navigationHistory?.canGoForward) {
      return this.webContents.navigationHistory.canGoForward();
    }
    return typeof this.webContents.canGoForward === 'function' ? this.webContents.canGoForward() : false;
  }

  setVisible(visible) {
    if (typeof this.view.setVisible === 'function') {
      this.view.setVisible(visible);
    }
  }

  setBounds(bounds) {
    this.view.setBounds(bounds);
  }

  destroy() {
    this.removeAllListeners();
    if (!this.webContents.isDestroyed()) {
      this.webContents.close();
    }
  }
}

module.exports = Tab;
