/**
 * Núcleo Browser - Downloads Store
 * Atomic serialized JSON persistence with retention limits and corruption recovery.
 * @module modules/downloads/downloads-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_MAX_RETENTION = 500;

class DownloadsStore {
  /**
   * @param {string} [customFilePath] 
   * @param {number} [maxRetention]
   */
  constructor(customFilePath = null, maxRetention = DEFAULT_MAX_RETENTION) {
    this.filePath = customFilePath || (app ? path.join(app.getPath('userData'), 'downloads.json') : path.join(process.cwd(), 'downloads.json'));
    this.maxRetention = maxRetention;
    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      downloads: []
    };
    this.isLoaded = false;
    this._savingPromise = null;
    this._saveQueued = false;
  }

  _getDefaultData() {
    return {
      version: CURRENT_SCHEMA_VERSION,
      downloads: []
    };
  }

  /**
   * Loads persisted downloads from disk or resets cleanly on corruption.
   * @returns {Promise<Object>}
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.downloads)) {
          this.data = {
            version: parsed.version || CURRENT_SCHEMA_VERSION,
            downloads: parsed.downloads
          };
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[DownloadsStore] Corrupted downloads file at ${this.filePath}. Backing up and resetting:`, err.message);
      try {
        const backupPath = `${this.filePath}.corrupted.${Date.now()}`;
        if (fs.existsSync(this.filePath)) {
          await fs.promises.rename(this.filePath, backupPath);
        }
      } catch {}
    }

    this.data = this._getDefaultData();
    this.isLoaded = true;
    await this.save();
    return this.data;
  }

  /**
   * Enforces max history retention limit by purging oldest inactive records.
   */
  _enforceRetention() {
    if (this.data.downloads.length <= this.maxRetention) {
      return;
    }

    const activeStates = new Set(['downloading', 'paused']);
    let inactiveCount = 0;
    const maxInactive = this.maxRetention;

    this.data.downloads = this.data.downloads.filter((d) => {
      if (activeStates.has(d.state)) {
        return true;
      }
      if (inactiveCount < maxInactive) {
        inactiveCount++;
        return true;
      }
      return false;
    });
  }

  /**
   * Atomically saves downloads store data to disk.
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.isLoaded) {
      this.isLoaded = true;
    }

    if (this._savingPromise) {
      this._saveQueued = true;
      return this._savingPromise;
    }

    this._savingPromise = (async () => {
      try {
        do {
          this._saveQueued = false;
          this._enforceRetention();

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
        console.error('[DownloadsStore] Error saving downloads atomically:', err);
      } finally {
        this._savingPromise = null;
      }
    })();

    return this._savingPromise;
  }

  /**
   * Adds or updates a download in the store.
   * @param {Object} downloadJson 
   */
  async add(downloadJson) {
    const existingIndex = this.data.downloads.findIndex((d) => d.id === downloadJson.id);
    if (existingIndex >= 0) {
      this.data.downloads[existingIndex] = { ...this.data.downloads[existingIndex], ...downloadJson };
    } else {
      // Newest downloads at the top
      this.data.downloads.unshift(downloadJson);
    }
    this._enforceRetention();
    await this.save();
  }

  /**
   * Updates an existing download record.
   * @param {string} id 
   * @param {Object} updates 
   */
  async update(id, updates) {
    const item = this.data.downloads.find((d) => d.id === id);
    if (item) {
      Object.assign(item, updates);
      await this.save();
      return item;
    }
    return null;
  }

  /**
   * Removes a single download record from history.
   * @param {string} id 
   * @returns {boolean}
   */
  async remove(id) {
    const initialLen = this.data.downloads.length;
    this.data.downloads = this.data.downloads.filter((d) => d.id !== id);
    if (this.data.downloads.length !== initialLen) {
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * Clears all completed, cancelled, or failed downloads from history.
   */
  async clearCompleted() {
    this.data.downloads = this.data.downloads.filter((d) => d.state === 'downloading' || d.state === 'paused');
    await this.save();
  }

  /**
   * Clears entire history except currently active downloads.
   */
  async clearAll() {
    this.data.downloads = this.data.downloads.filter((d) => d.state === 'downloading' || d.state === 'paused');
    await this.save();
  }

  /**
   * Retrieves all stored download items.
   * @returns {Array<Object>}
   */
  getAll() {
    return this.data.downloads || [];
  }

  /**
   * Retrieves a download item by its ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  getById(id) {
    return this.data.downloads.find((d) => d.id === id) || null;
  }
}

module.exports = DownloadsStore;
