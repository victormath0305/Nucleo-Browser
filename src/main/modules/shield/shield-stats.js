/**
 * Núcleo Browser - Shield Statistics Subsystem
 * Tracks per-tab real-time blocking metrics and long-term cumulative protection stats.
 * @module modules/shield/shield-stats
 */

const { EventEmitter } = require('events');

class ShieldStats extends EventEmitter {
  constructor(filterStore = null) {
    super();
    this.store = filterStore;

    // Per-tab active statistics: Map<string, TabStats>
    this.tabStats = new Map();

    // Local in-memory cumulative counters
    this.cumulative = {
      totalAnalyzed: 0,
      totalBlocked: 0,
      adsBlocked: 0,
      trackersBlocked: 0,
      analyticsBlocked: 0,
      otherBlocked: 0
    };

    if (this.store?.data?.stats) {
      this.cumulative = { ...this.cumulative, ...this.store.data.stats };
    }
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
   * Initializes or returns stats for a specific tab.
   * @param {string} tabId
   * @param {string} [domain='']
   * @returns {Object}
   */
  initTab(tabId, domain = '') {
    if (!this.tabStats.has(tabId)) {
      this.tabStats.set(tabId, {
        tabId,
        domain: domain || '',
        totalAnalyzed: 0,
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        analyticsBlocked: 0,
        otherBlocked: 0,
        recentBlocked: []
      });
    }
    return this.tabStats.get(tabId);
  }

  /**
   * Called when a tab navigates to a new URL.
   * If the host changes, per-tab session counters are reset.
   * @param {string} tabId
   * @param {string} newUrl
   */
  onTabNavigated(tabId, newUrl) {
    const newDomain = this._extractHostname(newUrl);
    const existing = this.tabStats.get(tabId);

    if (!existing) {
      this.initTab(tabId, newDomain);
      this.emit('tab-stats-updated', tabId, this.getTabStats(tabId));
      return;
    }

    // If navigating to a different domain, reset per-tab counter
    if (existing.domain !== newDomain) {
      existing.domain = newDomain;
      existing.totalAnalyzed = 0;
      existing.totalBlocked = 0;
      existing.adsBlocked = 0;
      existing.trackersBlocked = 0;
      existing.analyticsBlocked = 0;
      existing.otherBlocked = 0;
      existing.recentBlocked = [];
      this.emit('tab-stats-updated', tabId, this.getTabStats(tabId));
    }
  }

  /**
   * Cleans up tab entry on closure.
   * @param {string} tabId
   */
  onTabClosed(tabId) {
    this.tabStats.delete(tabId);
  }

  /**
   * Records an analyzed (allowed) request for a tab.
   * @param {string} [tabId]
   */
  recordAnalyzed(tabId = null) {
    this.cumulative.totalAnalyzed++;

    if (tabId && this.tabStats.has(tabId)) {
      const stats = this.tabStats.get(tabId);
      stats.totalAnalyzed++;
    }

    if (this.store && this.cumulative.totalAnalyzed % 50 === 0) {
      this.store.updateCumulativeStats({ analyzed: 50 }).catch(() => {});
    }
  }

  /**
   * Records a blocked request.
   * @param {string} tabId
   * @param {'ads'|'trackers'|'analytics'|'other'} category
   * @param {string} url
   */
  recordBlock(tabId, category = 'ads', url = '') {
    this.cumulative.totalBlocked++;

    const catKey = `${category}Blocked`;
    if (this.cumulative[catKey] !== undefined) {
      this.cumulative[catKey]++;
    } else {
      this.cumulative.otherBlocked++;
    }

    if (tabId) {
      const stats = this.initTab(tabId);
      stats.totalBlocked++;
      if (stats[catKey] !== undefined) {
        stats[catKey]++;
      } else {
        stats.otherBlocked++;
      }

      // Keep last 10 blocked items for inspection popover
      if (url) {
        stats.recentBlocked.unshift({
          url: url.length > 80 ? `${url.substring(0, 77)}...` : url,
          category,
          timestamp: Date.now()
        });
        if (stats.recentBlocked.length > 10) {
          stats.recentBlocked.pop();
        }
      }

      this.emit('tab-stats-updated', tabId, this.getTabStats(tabId));
    }

    // Persist to store
    if (this.store) {
      const delta = { blocked: 1 };
      delta[category] = 1;
      this.store.updateCumulativeStats(delta).catch(() => {});
    }
  }

  /**
   * Gets stats for a tab.
   * @param {string} tabId
   * @returns {Object}
   */
  getTabStats(tabId) {
    const s = this.tabStats.get(tabId);
    if (!s) {
      return {
        tabId,
        domain: '',
        totalAnalyzed: 0,
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        analyticsBlocked: 0,
        otherBlocked: 0,
        recentBlocked: []
      };
    }
    return { ...s };
  }

  /**
   * Gets cumulative stats.
   * @returns {Object}
   */
  getCumulativeStats() {
    return { ...this.cumulative };
  }

  /**
   * Resets cumulative stats.
   */
  async resetCumulativeStats() {
    this.cumulative = {
      totalAnalyzed: 0,
      totalBlocked: 0,
      adsBlocked: 0,
      trackersBlocked: 0,
      analyticsBlocked: 0,
      otherBlocked: 0
    };
    if (this.store) {
      await this.store.resetStats();
    }
    this.emit('cumulative-stats-updated', this.getCumulativeStats());
    return this.getCumulativeStats();
  }
}

module.exports = ShieldStats;
