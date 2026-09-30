/**
 * Núcleo Browser - Shield Filter Store
 * Persistent storage for Shield configuration, user whitelist, and local filter rules.
 * @module modules/shield/filter-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_LIST_VERSION = '2026.09.1';

// Seed default rule set for offline operation and deterministic testing
const DEFAULT_RULE_SET = [
  // Known Advertising Domains & Wildcards
  '||doubleclick.net^',
  '*.doubleclick.net',
  '||googlesyndication.com^',
  '||adservice.google.com^',
  '||adnxs.com^',
  '||advertising.com^',
  '||ads.example.com^',
  '||adserver.com^',
  '||popads.net^',
  '||taboola.com^',
  '||outbrain.com^',
  'tracker.example.com',
  'ads.example.com',

  // Known Tracker & Telemetry Domains
  '||google-analytics.com^',
  '*.google-analytics.com',
  '||tracking.example.com^',
  '||telemetry.example.com^',
  '||hotjar.com^',
  '||mixpanel.com^',
  '||segment.io^',
  '||scorecardresearch.com^',

  // URL Path Patterns (Common ad/tracker endpoints)
  '*/ads/*',
  '*/advertising/*',
  '*/ad-banner/*',
  '*/tracker/*',
  '*/tracking-pixel/*',
  '*/analytics.js*',
  '*ad-banner*.png',
  '*tracking-pixel*.gif',

  // Specific Test Rule for deterministic unit/integration testing
  '||shield-test-blocked.local^',
  '||shield-test-ad.local^',
  '||shield-test-tracker.local^',
  '*/shield-test/banner.jpg*',
  '*/shield-test/tracker.js*'
];

class FilterStore {
  /**
   * @param {string} [customFilePath] - Optional custom path for test isolation
   */
  constructor(customFilePath = null) {
    this.filePath = customFilePath || (
      app ? path.join(app.getPath('userData'), 'shield.json') : path.join(process.cwd(), 'shield.json')
    );

    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      enabled: true,
      exceptions: [],
      rules: [...DEFAULT_RULE_SET],
      stats: {
        totalAnalyzed: 0,
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        analyticsBlocked: 0,
        otherBlocked: 0
      },
      listMetadata: {
        version: DEFAULT_LIST_VERSION,
        updatedAt: Date.now(),
        ruleCount: DEFAULT_RULE_SET.length
      }
    };

    this.isLoaded = false;
    this._saving = null;
    this._saveQueued = false;
  }

  _getDefaultData() {
    return {
      version: CURRENT_SCHEMA_VERSION,
      enabled: true,
      exceptions: [],
      rules: [...DEFAULT_RULE_SET],
      stats: {
        totalAnalyzed: 0,
        totalBlocked: 0,
        adsBlocked: 0,
        trackersBlocked: 0,
        analyticsBlocked: 0,
        otherBlocked: 0
      },
      listMetadata: {
        version: DEFAULT_LIST_VERSION,
        updatedAt: Date.now(),
        ruleCount: DEFAULT_RULE_SET.length
      }
    };
  }

  /**
   * Loads Shield configuration from disk or seeds defaults if file is missing.
   * @returns {Promise<Object>}
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.enabled === 'boolean') {
          this.data = {
            ...this._getDefaultData(),
            ...parsed,
            stats: { ...this._getDefaultData().stats, ...(parsed.stats || {}) },
            listMetadata: { ...this._getDefaultData().listMetadata, ...(parsed.listMetadata || {}) }
          };
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[FilterStore] Failed to read ${this.filePath}, initializing defaults:`, err.message);
    }

    this.data = this._getDefaultData();
    this.isLoaded = true;
    await this.save();
    return this.data;
  }

  /**
   * Atomically saves Shield configuration to disk.
   */
  async save() {
    if (!this.isLoaded) return;

    if (this._saving) {
      this._saveQueued = true;
      return this._saving;
    }

    this._saving = (async () => {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      const tempPath = `${this.filePath}.tmp.${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const payload = JSON.stringify(this.data, null, 2);

      try {
        await fs.promises.writeFile(tempPath, payload, 'utf8');
        await fs.promises.rename(tempPath, this.filePath);
      } catch (err) {
        console.error('[FilterStore] Error saving shield configuration atomically:', err);
        try {
          if (fs.existsSync(tempPath)) {
            await fs.promises.unlink(tempPath);
          }
        } catch {}
      } finally {
        this._saving = null;
        if (this._saveQueued) {
          this._saveQueued = false;
          await this.save();
        }
      }
    })();

    return this._saving;
  }

  getEnabled() {
    return this.data.enabled;
  }

  async setEnabled(enabled) {
    this.data.enabled = Boolean(enabled);
    await this.save();
    return this.data.enabled;
  }

  getExceptions() {
    return [...this.data.exceptions];
  }

  async addException(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return false;

    if (!this.data.exceptions.includes(clean)) {
      this.data.exceptions.push(clean);
      await this.save();
      return true;
    }
    return false;
  }

  async removeException(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const idx = this.data.exceptions.indexOf(clean);
    if (idx !== -1) {
      this.data.exceptions.splice(idx, 1);
      await this.save();
      return true;
    }
    return false;
  }

  isException(domain) {
    if (!domain || typeof domain !== 'string') return false;
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    return this.data.exceptions.some(ex => clean === ex || clean.endsWith(`.${ex}`));
  }

  getRules() {
    return [...this.data.rules];
  }

  async updateCumulativeStats(delta = {}) {
    const s = this.data.stats;
    s.totalAnalyzed = (s.totalAnalyzed || 0) + (delta.analyzed || 0);
    s.totalBlocked = (s.totalBlocked || 0) + (delta.blocked || 0);
    s.adsBlocked = (s.adsBlocked || 0) + (delta.ads || 0);
    s.trackersBlocked = (s.trackersBlocked || 0) + (delta.trackers || 0);
    s.analyticsBlocked = (s.analyticsBlocked || 0) + (delta.analytics || 0);
    s.otherBlocked = (s.otherBlocked || 0) + (delta.other || 0);

    // Save debounced or directly
    await this.save();
  }

  async resetStats() {
    this.data.stats = {
      totalAnalyzed: 0,
      totalBlocked: 0,
      adsBlocked: 0,
      trackersBlocked: 0,
      analyticsBlocked: 0,
      otherBlocked: 0
    };
    await this.save();
    return this.data.stats;
  }

  async restoreDefaults() {
    this.data = this._getDefaultData();
    await this.save();
    return this.data;
  }
}

module.exports = FilterStore;
