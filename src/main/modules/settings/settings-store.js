/**
 * Núcleo Browser - Settings Store
 * Atomic, versioned, serialized JSON persistence for user settings.
 * @module modules/settings/settings-store
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDefaultSettings } = require('./settings-defaults');

const CURRENT_SCHEMA_VERSION = 1;

class SettingsStore {
  /**
   * @param {string} [customFilePath] - Optional custom path for storage (e.g. testing)
   */
  constructor(customFilePath = null) {
    if (customFilePath) {
      this.filePath = customFilePath;
    } else if (app) {
      this.filePath = path.join(app.getPath('userData'), 'settings.json');
    } else {
      this.filePath = path.join(process.cwd(), 'settings.json');
    }

    this.data = getDefaultSettings();
    this.isLoaded = false;
    this._saving = false;
    this._saveQueued = false;
  }

  /**
   * Loads settings from disk, applying migrations and defaults if needed.
   * @returns {Promise<Object>}
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          // Merge with defaults to ensure any newly added settings are populated
          this.data = this._mergeWithDefaults(parsed);
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[SettingsStore] Failed to read ${this.filePath}, using defaults:`, err.message);
    }

    this.data = getDefaultSettings();
    this.isLoaded = true;
    await this.save();
    return this.data;
  }

  /**
   * Deeply merges loaded data with current defaults.
   * @private
   */
  _mergeWithDefaults(loaded) {
    const defaults = getDefaultSettings();
    const result = { ...defaults };

    result.version = loaded.version || CURRENT_SCHEMA_VERSION;

    for (const section of Object.keys(defaults)) {
      if (section === 'version') continue;
      if (loaded[section] && typeof loaded[section] === 'object' && !Array.isArray(loaded[section])) {
        result[section] = {
          ...defaults[section],
          ...loaded[section]
        };
      } else if (loaded[section] !== undefined) {
        result[section] = loaded[section];
      }
    }

    return result;
  }

  /**
   * Atomically saves settings data to disk via serialized temp file rename.
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
      console.error('[SettingsStore] Error saving settings atomically:', err);
    } finally {
      this._saving = false;
    }
  }

  /**
   * Returns in-memory settings data.
   * @returns {Object}
   */
  getData() {
    return this.data;
  }
}

module.exports = SettingsStore;
