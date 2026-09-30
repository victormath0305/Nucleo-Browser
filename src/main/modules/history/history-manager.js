/**
 * Núcleo Browser - History Manager
 * Business logic for recording visits, search, retention and period-based cleanup.
 * @module modules/history/history-manager
 */

const { EventEmitter } = require('events');
const HistoryStore = require('./history-store');

class HistoryManager extends EventEmitter {
  constructor(customStore = null) {
    super();
    this.store = customStore || new HistoryStore();
  }

  async initialize() {
    await this.store.load();
    this.emit('initialized');
  }

  _isRecordableUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const trimmed = url.trim();

    // Do NOT record internal browser pages, blank pages, or local system files (Section 11)
    if (
      trimmed === 'about:blank' ||
      trimmed.startsWith('nucleo://') ||
      trimmed.startsWith('file://') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('javascript:')
    ) {
      return false;
    }

    try {
      const parsed = new URL(trimmed);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  _normalizeUrl(url) {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
      return url.trim().replace(/\/+$/, '');
    }
  }

  /**
   * Records a user visit to a webpage.
   * @param {Object} param0
   * @returns {Promise<Object|null>}
   */
  async addVisit({ url, title = null, favicon = null, isPrivate = false }) {
    // Respect private browsing mode (Section 12)
    if (isPrivate) return null;

    if (!this._isRecordableUrl(url)) return null;

    const trimmedUrl = url.trim();
    const normalized = this._normalizeUrl(trimmedUrl);
    const now = Date.now();

    const existing = this.store.data.entries.find((e) => this._normalizeUrl(e.url) === normalized);

    if (existing) {
      existing.visitCount = (existing.visitCount || 1) + 1;
      existing.lastVisitTime = now;
      if (title && title !== 'Carregando...' && title !== 'Sem título') {
        existing.title = title.trim();
      }
      if (favicon && typeof favicon === 'string' && /^(https?:\/\/|data:image\/)/i.test(favicon)) {
        existing.favicon = favicon;
      }
      await this.store.save();
      this.emit('history-updated');
      return existing;
    }

    const cleanTitle = (title && typeof title === 'string' && title !== 'Carregando...') ? title.trim() : trimmedUrl;
    const safeFavicon = (favicon && typeof favicon === 'string' && /^(https?:\/\/|data:image\/)/i.test(favicon)) ? favicon : null;

    const newEntry = {
      id: `hist-${now}-${Math.floor(Math.random() * 1000)}`,
      url: trimmedUrl,
      title: cleanTitle,
      favicon: safeFavicon,
      visitCount: 1,
      firstVisitTime: now,
      lastVisitTime: now
    };

    this.store.data.entries.unshift(newEntry);
    await this.store.save();
    this.emit('history-updated');
    return newEntry;
  }

  /**
   * Updates title for an already recorded URL.
   * @param {string} url
   * @param {string} title
   */
  async updateTitle(url, title) {
    if (!url || !title || !this._isRecordableUrl(url)) return;
    const normalized = this._normalizeUrl(url);
    const entry = this.store.data.entries.find((e) => this._normalizeUrl(e.url) === normalized);
    if (entry && title !== 'Carregando...' && title !== 'Sem título') {
      entry.title = title.trim();
      await this.store.save();
      this.emit('history-updated');
    }
  }

  /**
   * Searches history with pagination support.
   * @param {string} query
   * @param {Object} options
   * @returns {{ entries: Array<Object>, total: number, hasMore: boolean }}
   */
  searchHistory(query = '', { limit = 100, offset = 0 } = {}) {
    let results = this.store.data.entries;

    if (query && typeof query === 'string' && query.trim()) {
      const q = query.toLowerCase().trim();
      results = results.filter(
        (e) => (e.title && e.title.toLowerCase().includes(q)) || (e.url && e.url.toLowerCase().includes(q))
      );
    }

    // Sort descending by lastVisitTime
    results.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

    const total = results.length;
    const paginated = results.slice(offset, offset + limit);

    return {
      entries: paginated,
      total,
      hasMore: offset + limit < total
    };
  }

  /**
   * Deletes a single history record by ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteEntry(id) {
    const idx = this.store.data.entries.findIndex((e) => e.id === id);
    if (idx !== -1) {
      this.store.data.entries.splice(idx, 1);
      await this.store.save();
      this.emit('history-updated');
      return true;
    }
    return false;
  }

  /**
   * Clears history by time period.
   * Periods: 'last15Minutes', 'today', 'last7Days', 'all'
   * @param {string} period
   * @returns {Promise<number>} Number of records deleted
   */
  async clearByPeriod(period) {
    const now = Date.now();
    const initialCount = this.store.data.entries.length;

    if (period === 'all') {
      this.store.data.entries = [];
    } else if (period === 'last15Minutes') {
      const threshold = now - (15 * 60 * 1000);
      this.store.data.entries = this.store.data.entries.filter((e) => e.lastVisitTime < threshold);
    } else if (period === 'today') {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const threshold = startOfToday.getTime();
      this.store.data.entries = this.store.data.entries.filter((e) => e.lastVisitTime < threshold);
    } else if (period === 'last7Days') {
      const threshold = now - (7 * 24 * 60 * 60 * 1000);
      this.store.data.entries = this.store.data.entries.filter((e) => e.lastVisitTime < threshold);
    }

    const deletedCount = initialCount - this.store.data.entries.length;
    if (deletedCount > 0) {
      await this.store.save();
      this.emit('history-updated');
    }
    return deletedCount;
  }

  /**
   * Gets history analytics and stats.
   */
  getStats() {
    const entries = this.store.data.entries;
    const totalEntries = entries.length;
    const totalVisits = entries.reduce((sum, e) => sum + (e.visitCount || 1), 0);
    const topVisited = [...entries]
      .sort((a, b) => (b.visitCount || 1) - (a.visitCount || 1))
      .slice(0, 5);

    return {
      totalEntries,
      totalVisits,
      topVisited
    };
  }

  getAllEntries() {
    return [...this.store.data.entries].sort((a, b) => b.lastVisitTime - a.lastVisitTime);
  }
}

module.exports = HistoryManager;
