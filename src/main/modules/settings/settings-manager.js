/**
 * Núcleo Browser - Settings Manager
 * Central API for getting, setting, persisting and observing user preferences.
 * @module modules/settings/settings-manager
 */

const { EventEmitter } = require('events');
const { app } = require('electron');
const SettingsStore = require('./settings-store');
const SettingsValidator = require('./settings-validator');
const { getDefaultSettings } = require('./settings-defaults');
const { SECTIONS } = require('./settings-schema');

class SettingsManager extends EventEmitter {
  /**
   * @param {SettingsStore} [store]
   */
  constructor(store = null) {
    super();
    this.store = store || new SettingsStore();
    this.isInitialized = false;
  }

  /**
   * Initializes the settings store and populates platform-specific defaults.
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.isInitialized) return;

    await this.store.load();

    // Populate default downloads directory if not set
    if (!this.get('downloads.defaultPath')) {
      try {
        const defaultDl = app ? app.getPath('downloads') : '';
        if (defaultDl) {
          this._setNested(this.store.getData(), 'downloads.defaultPath', defaultDl);
          await this.store.save();
        }
      } catch (err) {
        console.warn('[SettingsManager] Could not determine default downloads path:', err.message);
      }
    }

    this.isInitialized = true;
    console.log('[SettingsManager] Initialized successfully');
  }

  /**
   * Gets a setting value by dot-notation path.
   * If key is omitted, returns a deep clone of all settings.
   * @param {string} [key]
   * @returns {*}
   */
  get(key) {
    const data = this.store.getData();
    if (!key) {
      return JSON.parse(JSON.stringify(data));
    }

    return this._getNested(data, key);
  }

  /**
   * Sets a setting value by dot-notation path with validation and persistence.
   * @param {string} key
   * @param {*} value
   * @returns {Promise<{ success: boolean, value?: any, error?: string }>}
   */
  async set(key, value) {
    const validation = SettingsValidator.validate(key, value);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const sanitizedValue = validation.sanitizedValue !== undefined ? validation.sanitizedValue : value;
    const previousValue = this.get(key);

    // Skip if unchanged (primitive)
    if (previousValue === sanitizedValue && typeof sanitizedValue !== 'object') {
      return { success: true, value: sanitizedValue };
    }

    const data = this.store.getData();
    this._setNested(data, key, sanitizedValue);
    await this.store.save();

    const changePayload = { key, value: sanitizedValue, previousValue };

    // Emit generic change event
    this.emit('settings-changed', changePayload);

    // Emit specific events for modules
    if (key.startsWith('appearance.')) {
      this.emit('theme-changed', {
        theme: this.get('appearance.theme'),
        accentColor: this.get('appearance.accentColor')
      });
    } else if (key === 'search.engine') {
      this.emit('search-engine-changed', sanitizedValue);
    } else if (key.startsWith('downloads.')) {
      this.emit('download-settings-changed', {
        defaultPath: this.get('downloads.defaultPath'),
        askLocation: this.get('downloads.askLocation')
      });
    } else if (key.startsWith('privacy.')) {
      this.emit('privacy-settings-changed', {
        doNotTrack: this.get('privacy.doNotTrack'),
        clearOnExit: this.get('privacy.clearOnExit'),
        clearOnExitItems: this.get('privacy.clearOnExitItems')
      });
    }

    return { success: true, value: sanitizedValue };
  }

  /**
   * Returns a deep clone of all settings.
   * @returns {Object}
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.store.getData()));
  }

  /**
   * Resets all settings to their default values.
   * Preserves bookmarks, history, extensions and files.
   * @returns {Promise<{ success: boolean }>}
   */
  async reset() {
    const defaults = getDefaultSettings();
    if (app) {
      try {
        defaults.downloads.defaultPath = app.getPath('downloads');
      } catch {}
    }

    const data = this.store.getData();
    for (const section of SECTIONS) {
      if (defaults[section]) {
        data[section] = JSON.parse(JSON.stringify(defaults[section]));
      }
    }

    await this.store.save();
    this.emit('settings-reset');
    this.emit('settings-changed', { key: '*', value: this.getAll() });
    this.emit('theme-changed', {
      theme: this.get('appearance.theme'),
      accentColor: this.get('appearance.accentColor')
    });
    this.emit('search-engine-changed', this.get('search.engine'));

    return { success: true };
  }

  /**
   * Resets a specific section to defaults.
   * @param {string} section
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async resetSection(section) {
    if (!SECTIONS.includes(section)) {
      return { success: false, error: `Seção desconhecida: "${section}"` };
    }

    const defaults = getDefaultSettings();
    const data = this.store.getData();
    if (defaults[section]) {
      data[section] = JSON.parse(JSON.stringify(defaults[section]));
      await this.store.save();
      this.emit('settings-changed', { key: `${section}.*`, value: data[section] });

      if (section === 'appearance') {
        this.emit('theme-changed', {
          theme: this.get('appearance.theme'),
          accentColor: this.get('appearance.accentColor')
        });
      } else if (section === 'search') {
        this.emit('search-engine-changed', this.get('search.engine'));
      }

      return { success: true };
    }

    return { success: false, error: 'Falha ao restaurar seção' };
  }

  // --- Private Helpers ---

  _getNested(obj, pathStr) {
    const parts = pathStr.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr === null || curr === undefined || typeof curr !== 'object') {
        return undefined;
      }
      curr = curr[part];
    }
    return curr !== undefined ? JSON.parse(JSON.stringify(curr)) : undefined;
  }

  _setNested(obj, pathStr, value) {
    const parts = pathStr.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!curr[part] || typeof curr[part] !== 'object' || Array.isArray(curr[part])) {
        curr[part] = {};
      }
      curr = curr[part];
    }
    curr[parts[parts.length - 1]] = value;
  }
}

module.exports = SettingsManager;
