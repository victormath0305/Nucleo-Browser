/**
 * Núcleo Browser - History Store
 * Persistent, versioned atomic JSON storage for browsing history with retention limits.
 * @module modules/history/history-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_MAX_ENTRIES = 10000;

class HistoryStore {
  /**
   * @param {string} [customFilePath] - Custom path for storage
   * @param {number} [maxEntries=10000] - Retention limit
   */
  constructor(customFilePath = null, maxEntries = DEFAULT_MAX_ENTRIES) {
    this.filePath = customFilePath || (app ? path.join(app.getPath('userData'), 'history.json') : path.join(process.cwd(), 'history.json'));
    this.maxEntries = maxEntries;
    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      maxEntries: this.maxEntries,
      entries: []
    };
    this.isLoaded = false;
    this._saving = false;
    this._saveQueued = false;
  }

  /**
   * Loads history from disk.
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.entries)) {
          this.data = parsed;
          this.maxEntries = parsed.maxEntries || this.maxEntries;
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[HistoryStore] Failed to read history from ${this.filePath}, creating new store:`, err.message);
    }

    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      maxEntries: this.maxEntries,
      entries: []
    };
    this.isLoaded = true;
    await this.save();
    return this.data;
  }

  /**
   * Atomically saves history data to disk via serialized temp file rename.
   */
  async save() {
    if (!this.isLoaded) return;

    if (this._saving) {
      this._saveQueued = true;
      return;
    }

    this._saving = true;

    try {
      do {
        this._saveQueued = false;

        // Enforce retention limit: keep newest entries
        if (this.data.entries.length > this.maxEntries) {
          this.data.entries.sort((a, b) => b.lastVisitTime - a.lastVisitTime);
          this.data.entries = this.data.entries.slice(0, this.maxEntries);
        }

        const dir = path.dirname(this.filePath);
        await fs.promises.mkdir(dir, { recursive: true });

        const rand = Math.random().toString(36).slice(2, 6);
        const tempPath = `${this.filePath}.tmp.${Date.now()}.${rand}`;
        const payload = JSON.stringify(this.data, null, 2);

        try {
          await fs.promises.writeFile(tempPath, payload, 'utf8');
          await fs.promises.rename(tempPath, this.filePath);
        } catch (err) {
          try {
            if (fs.existsSync(tempPath)) {
              await fs.promises.unlink(tempPath);
            }
          } catch {}
          throw err;
        }
      } while (this._saveQueued);
    } catch (err) {
      console.error('[HistoryStore] Error saving history atomically:', err);
    } finally {
      this._saving = false;
    }
  }

  getData() {
    return this.data;
  }
}

module.exports = HistoryStore;
