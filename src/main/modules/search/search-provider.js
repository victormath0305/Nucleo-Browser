/**
 * Núcleo Browser - Search Provider
 * Resolves search queries, manages built-in and user-configured search engines.
 * @module modules/search/search-provider
 */

const { EventEmitter } = require('events');
const { BUILTIN_SEARCH_ENGINES } = require('./search-engines');
const SettingsValidator = require('../settings/settings-validator');

class SearchProvider extends EventEmitter {
  /**
   * @param {import('../settings/settings-manager')} settingsManager
   */
  constructor(settingsManager) {
    super();
    this.settingsManager = settingsManager;
    this.builtinEngines = [...BUILTIN_SEARCH_ENGINES];

    if (this.settingsManager) {
      this.settingsManager.on('search-engine-changed', (newEngineId) => {
        this.emit('default-changed', this.getDefaultEngine());
      });
    }
  }

  /**
   * Returns all available search engines (built-in + custom).
   * @returns {Object[]}
   */
  getAllEngines() {
    const defaultId = this.getDefaultEngineId();
    const custom = this.settingsManager ? (this.settingsManager.get('search.customEngines') || []) : [];

    const all = [
      ...this.builtinEngines.map(e => ({
        ...e,
        isDefault: e.id === defaultId,
        isBuiltin: true
      })),
      ...custom.map(e => ({
        ...e,
        isDefault: e.id === defaultId,
        isBuiltin: false
      }))
    ];

    return all;
  }

  /**
   * Gets the active default engine identifier.
   * @returns {string}
   */
  getDefaultEngineId() {
    if (!this.settingsManager) return 'duckduckgo';
    return this.settingsManager.get('search.engine') || 'duckduckgo';
  }

  /**
   * Gets the full active search engine object.
   * @returns {Object}
   */
  getDefaultEngine() {
    const defaultId = this.getDefaultEngineId();
    const all = this.getAllEngines();
    const found = all.find(e => e.id === defaultId);
    return found || this.builtinEngines[0];
  }

  /**
   * Gets a specific search engine by ID.
   * @param {string} engineId
   * @returns {Object|null}
   */
  getEngine(engineId) {
    return this.getAllEngines().find(e => e.id === engineId) || null;
  }

  /**
   * Sets the active search engine by ID.
   * @param {string} engineId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async setDefaultEngine(engineId) {
    const all = this.getAllEngines();
    const found = all.find(e => e.id === engineId);
    if (!found) {
      return { success: false, error: `Buscador "${engineId}" não encontrado.` };
    }

    if (this.settingsManager) {
      await this.settingsManager.set('search.engine', engineId);
    }
    return { success: true };
  }

  /**
   * Adds a user-configured search engine.
   * @param {Object} engineData - { name, searchUrl, keyword }
   * @returns {Promise<{ success: boolean, engine?: Object, error?: string }>}
   */
  async addCustomEngine(engineData) {
    const validation = SettingsValidator.validateCustomEngine(engineData);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newEngine = {
      id,
      name: engineData.name.trim(),
      searchUrl: engineData.searchUrl.trim(),
      keyword: (engineData.keyword || '').trim().toLowerCase(),
      isBuiltin: false
    };

    if (this.settingsManager) {
      const current = this.settingsManager.get('search.customEngines') || [];
      const updated = [...current, newEngine];
      await this.settingsManager.set('search.customEngines', updated);
    }

    this.emit('engine-added', newEngine);
    return { success: true, engine: newEngine };
  }

  /**
   * Removes a user-configured search engine.
   * Built-in engines cannot be removed.
   * @param {string} engineId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async removeCustomEngine(engineId) {
    const isBuiltin = this.builtinEngines.some(e => e.id === engineId);
    if (isBuiltin) {
      return { success: false, error: 'Mecanismos de busca pré-configurados não podem ser removidos.' };
    }

    if (!this.settingsManager) {
      return { success: false, error: 'SettingsManager não configurado' };
    }

    const current = this.settingsManager.get('search.customEngines') || [];
    const index = current.findIndex(e => e.id === engineId);
    if (index === -1) {
      return { success: false, error: 'Buscador não encontrado.' };
    }

    // If deleting the active default, fallback to duckduckgo or google
    if (this.getDefaultEngineId() === engineId) {
      await this.settingsManager.set('search.engine', 'duckduckgo');
    }

    const updated = current.filter(e => e.id !== engineId);
    await this.settingsManager.set('search.customEngines', updated);

    this.emit('engine-removed', engineId);
    return { success: true };
  }

  /**
   * Builds the full search URL for a query string.
   * @param {string} query - Raw search query
   * @param {string} [engineId] - Optional engine override
   * @returns {string} Fully qualified search URL
   */
  buildSearchUrl(query, engineId = null) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return 'nucleo://newtab';
    }

    let engine;
    if (engineId) {
      engine = this.getAllEngines().find(e => e.id === engineId);
    }
    if (!engine) {
      engine = this.getDefaultEngine();
    }

    const template = engine.searchUrl || 'https://duckduckgo.com/?q=%s';
    return template.replace('%s', encodeURIComponent(trimmed));
  }
}

module.exports = SearchProvider;
