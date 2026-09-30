/**
 * Núcleo Browser - Extension Store
 * Persistent versioned storage for installed extensions with serialized atomic file writes
 * @module modules/extensions/extension-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class ExtensionStore {
  /**
   * @param {string} [customFilePath] - Custom path for testing or override
   */
  constructor(customFilePath = null) {
    this.filePath = customFilePath || (app && app.getPath ? path.join(app.getPath('userData'), 'extensions.json') : path.join(process.cwd(), 'extensions.json'));
    this.data = {
      version: 1,
      extensions: []
    };
    this.isLoaded = false;
    this._saving = false;
    this._saveQueued = false;
  }

  /**
   * Loads extensions from disk.
   */
  async load() {
    try {
      const exists = fs.existsSync(this.filePath);
      if (!exists) {
        this.data = { version: 1, extensions: [] };
        await this.save();
        this.isLoaded = true;
        return this.data;
      }

      const raw = await fs.promises.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object') {
        this.data = {
          version: parsed.version || 1,
          extensions: Array.isArray(parsed.extensions) ? parsed.extensions : []
        };
      } else {
        this.data = { version: 1, extensions: [] };
      }
    } catch (err) {
      console.warn('[ExtensionStore] Failed to read extensions.json, initializing clean store:', err.message);
      this.data = { version: 1, extensions: [] };
    }

    this.isLoaded = true;
    return this.data;
  }

  /**
   * Serialized atomic file save to prevent file locks or rename collisions on Windows.
   */
  async save() {
    if (this._saving) {
      this._saveQueued = true;
      return;
    }

    this._saving = true;
    try {
      const dir = path.dirname(this.filePath);
      await fs.promises.mkdir(dir, { recursive: true });

      const content = JSON.stringify(this.data, null, 2);
      const tempPath = `${this.filePath}.tmp.${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await fs.promises.writeFile(tempPath, content, 'utf8');
      await fs.promises.rename(tempPath, this.filePath);
    } catch (err) {
      console.error('[ExtensionStore] Failed to save extensions.json atomically:', err);
    } finally {
      this._saving = false;
      if (this._saveQueued) {
        this._saveQueued = false;
        await this.save();
      }
    }
  }

  /**
   * Gets all installed extensions.
   * @returns {Object[]}
   */
  getAll() {
    return [...this.data.extensions];
  }

  /**
   * Finds an extension by its ID.
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    if (!id) return null;
    return this.data.extensions.find(e => e.id === id) || null;
  }

  /**
   * Finds an extension by its installed directory path.
   * @param {string} extPath
   * @returns {Object|null}
   */
  getByPath(extPath) {
    if (!extPath) return null;
    const normalized = path.resolve(extPath).toLowerCase();
    return this.data.extensions.find(e => e.path && path.resolve(e.path).toLowerCase() === normalized) || null;
  }

  /**
   * Adds or replaces an extension record.
   * @param {Object} extensionRecord
   * @returns {Promise<Object>}
   */
  async add(extensionRecord) {
    if (!extensionRecord || !extensionRecord.id) {
      throw new Error('Extension record must contain a valid ID.');
    }

    const index = this.data.extensions.findIndex(e => e.id === extensionRecord.id);
    if (index >= 0) {
      this.data.extensions[index] = { ...this.data.extensions[index], ...extensionRecord };
    } else {
      this.data.extensions.push(extensionRecord);
    }

    await this.save();
    return this.get(extensionRecord.id);
  }

  /**
   * Updates fields of an existing extension.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async update(id, updates) {
    const ext = this.get(id);
    if (!ext) return null;

    Object.assign(ext, updates);
    await this.save();
    return ext;
  }

  /**
   * Sets the enabled status for an extension.
   * @param {string} id
   * @param {boolean} enabled
   * @returns {Promise<Object|null>}
   */
  async setEnabled(id, enabled) {
    return this.update(id, { enabled: Boolean(enabled) });
  }

  /**
   * Records or clears an error for an extension.
   * @param {string} id
   * @param {string|null} error
   * @returns {Promise<Object|null>}
   */
  async setError(id, error) {
    return this.update(id, { error: error || null });
  }

  /**
   * Removes an extension from the store.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async remove(id) {
    const initialLen = this.data.extensions.length;
    this.data.extensions = this.data.extensions.filter(e => e.id !== id);
    const removed = this.data.extensions.length < initialLen;
    if (removed) {
      await this.save();
    }
    return removed;
  }

  /**
   * Clears all stored extension records.
   */
  async clear() {
    this.data.extensions = [];
    await this.save();
  }
}

module.exports = ExtensionStore;
