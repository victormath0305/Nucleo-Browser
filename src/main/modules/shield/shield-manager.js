/**
 * Núcleo Browser - Shield Manager
 * Orchestrates filter storage, parsing, decision engine, webRequest hooks, and stats.
 * @module modules/shield/shield-manager
 */

const { EventEmitter } = require('events');
const FilterParser = require('./filter-parser');
const FilterStore = require('./filter-store');
const ShieldEngine = require('./shield-engine');
const ShieldStats = require('./shield-stats');

class ShieldManager extends EventEmitter {
  constructor(customStore = null) {
    super();
    this.store = customStore || new FilterStore();
    this.engine = new ShieldEngine();
    this.stats = new ShieldStats(this.store);
    this.tabManager = null;
    this.windowController = null;
    this.isAttached = false;

    // Forward tab stats updates
    this.stats.on('tab-stats-updated', (tabId, stats) => {
      this.emit('tab-stats-updated', tabId, stats);
    });
  }

  _extractHostname(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return url.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    }
  }

  /**
   * Initializes store, parses filter rules and compiles the engine.
   */
  async initialize() {
    await this.store.load();
    await this.reloadFilters();
    this.emit('initialized');
  }

  /**
   * Reloads rules from store into the engine.
   */
  async reloadFilters() {
    const rawRules = this.store.getRules();
    const parsed = FilterParser.parseRules(rawRules);
    this.engine.loadRules(parsed);
    this.engine.clearCache();
    this.emit('filters-reloaded', { ruleCount: this.engine.getRulesCount() });
  }

  /**
   * Attaches request interception to the Electron session.
   * @param {Object} session - Electron session instance
   * @param {Object} tabManager - Núcleo TabManager instance
   * @param {Object} [windowController] - Núcleo BrowserWindowController instance
   */
  attachToSession(session, tabManager, windowController = null) {
    if (this.isAttached || !session || !session.webRequest) return;
    this.tabManager = tabManager;
    this.windowController = windowController;

    session.webRequest.onBeforeRequest({ urls: ['*://*/*'] }, (details, callback) => {
      // 1. If Shield is disabled globally, allow all traffic
      if (!this.isEnabled()) {
        return callback({ cancel: false });
      }

      // 2. Never block internal pages or browser chrome
      if (
        details.url.startsWith('nucleo:') ||
        details.url.startsWith('file:') ||
        details.url.startsWith('devtools:') ||
        details.url.startsWith('chrome:') ||
        details.url.startsWith('chrome-extension:')
      ) {
        return callback({ cancel: false });
      }

      // 3. Resolve Tab instance for the request
      let tab = null;
      if (this.tabManager && details.webContentsId) {
        tab = this.tabManager.getTabByWebContentsId(details.webContentsId);
      }

      const tabId = tab ? tab.id : null;
      let siteDomain = '';
      let isSiteWhitelisted = false;

      if (tab && tab.url) {
        siteDomain = this._extractHostname(tab.url);
        isSiteWhitelisted = this.isSiteWhitelisted(siteDomain);
      }

      // 4. Decision check
      const decision = this.engine.shouldBlock(details.url, { siteDomain, isSiteWhitelisted });

      if (decision.action === 'BLOCK') {
        const category = decision.category || 'other';
        this.stats.recordBlock(tabId, category, details.url);

        this.emit('request-blocked', {
          tabId,
          siteDomain,
          url: details.url,
          category,
          reason: decision.reason
        });

        return callback({ cancel: true });
      }

      // 5. Allowed
      this.stats.recordAnalyzed(tabId);
      return callback({ cancel: false });
    });

    this.isAttached = true;
    console.log('[ShieldManager] Attached to network session with', this.engine.getRulesCount(), 'rules');
  }

  isEnabled() {
    return this.store.getEnabled();
  }

  async setEnabled(enabled) {
    const val = await this.store.setEnabled(enabled);
    this.engine.clearCache();
    this.emit('enabled-changed', val);
    return val;
  }

  async toggleEnabled() {
    return this.setEnabled(!this.isEnabled());
  }

  isSiteWhitelisted(domain) {
    return this.store.isException(domain);
  }

  async toggleSiteWhitelist(domain) {
    if (!domain) return false;
    const clean = this._extractHostname(domain) || domain;
    const isWhite = this.isSiteWhitelisted(clean);

    if (isWhite) {
      await this.store.removeException(clean);
    } else {
      await this.store.addException(clean);
    }

    this.engine.clearCache();
    this.emit('whitelist-changed', this.getWhitelist());
    return !isWhite;
  }

  async addWhitelistDomain(domain) {
    const clean = this._extractHostname(domain) || domain;
    const res = await this.store.addException(clean);
    if (res) {
      this.engine.clearCache();
      this.emit('whitelist-changed', this.getWhitelist());
    }
    return res;
  }

  async removeWhitelistDomain(domain) {
    const clean = this._extractHostname(domain) || domain;
    const res = await this.store.removeException(clean);
    if (res) {
      this.engine.clearCache();
      this.emit('whitelist-changed', this.getWhitelist());
    }
    return res;
  }

  getWhitelist() {
    return this.store.getExceptions();
  }

  getTabStats(tabId) {
    return this.stats.getTabStats(tabId);
  }

  getGlobalStats() {
    return {
      enabled: this.isEnabled(),
      rulesCount: this.engine.getRulesCount(),
      whitelistCount: this.getWhitelist().length,
      listMetadata: this.store.data.listMetadata,
      cumulative: this.stats.getCumulativeStats()
    };
  }

  async resetStats() {
    return await this.stats.resetCumulativeStats();
  }

  async restoreDefaults() {
    await this.store.restoreDefaults();
    await this.reloadFilters();
    this.emit('restored-defaults');
  }

  onTabNavigated(tabId, url) {
    this.stats.onTabNavigated(tabId, url);
  }

  onTabClosed(tabId) {
    this.stats.onTabClosed(tabId);
  }
}

module.exports = ShieldManager;
