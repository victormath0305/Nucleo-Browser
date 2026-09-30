/**
 * Núcleo Browser - Extension Loader
 * Direct integration with native Electron / Chromium Session extension APIs
 * @module modules/extensions/extension-loader
 */

class ExtensionLoader {
  /**
   * @param {Object} session - Electron session instance (defaults to session.defaultSession)
   */
  constructor(session) {
    this.session = session;
  }

  /**
   * Updates the active session instance.
   * @param {Object} session
   */
  setSession(session) {
    this.session = session;
  }

  /**
   * Loads an unpacked extension into the Electron session natively.
   * @param {string} extensionPath - Absolute path to the unpacked extension
   * @param {Object} [options]
   * @returns {Promise<{ success: boolean, extension?: Object, error?: string }>}
   */
  async load(extensionPath, options = {}) {
    if (!this.session) {
      return { success: false, error: 'Sessão do Electron não configurada no ExtensionLoader.' };
    }

    try {
      const loadOptions = {
        allowFileAccess: Boolean(options.allowFileAccess)
      };

      let electronExt;
      if (this.session.extensions && typeof this.session.extensions.loadExtension === 'function') {
        electronExt = await this.session.extensions.loadExtension(extensionPath, loadOptions);
      } else {
        electronExt = await this.session.loadExtension(extensionPath, loadOptions);
      }

      return {
        success: true,
        extension: {
          id: electronExt.id,
          name: electronExt.name,
          version: electronExt.version,
          path: electronExt.path,
          url: electronExt.url,
          manifest: electronExt.manifest
        }
      };
    } catch (err) {
      console.error(`[ExtensionLoader] Error loading extension at ${extensionPath}:`, err.message);
      return {
        success: false,
        error: err.message || 'Falha ao carregar extensão no Chromium/Electron.'
      };
    }
  }

  /**
   * Dynamically unloads an extension from the Electron session.
   * @param {string} extensionId - The 32-character extension ID
   * @returns {{ success: boolean, error?: string }}
   */
  unload(extensionId) {
    if (!this.session) {
      return { success: false, error: 'Sessão do Electron não configurada no ExtensionLoader.' };
    }

    try {
      if (this.session.extensions && typeof this.session.extensions.removeExtension === 'function') {
        this.session.extensions.removeExtension(extensionId);
        return { success: true };
      } else if (typeof this.session.removeExtension === 'function') {
        this.session.removeExtension(extensionId);
        return { success: true };
      } else {
        return {
          success: false,
          error: 'API removeExtension não disponível nesta versão do Electron.'
        };
      }
    } catch (err) {
      console.error(`[ExtensionLoader] Error removing extension ${extensionId}:`, err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Gets all currently active extensions loaded in the Electron session.
   * @returns {Object[]}
   */
  getAllLoaded() {
    if (!this.session) return [];
    if (this.session.extensions && typeof this.session.extensions.getAllExtensions === 'function') {
      return this.session.extensions.getAllExtensions();
    }
    if (this.session.extensions && typeof this.session.extensions.all === 'function') {
      return this.session.extensions.all();
    }
    if (typeof this.session.getAllExtensions === 'function') {
      return this.session.getAllExtensions();
    }
    return [];
  }

  /**
   * Gets a specific loaded extension by ID.
   * @param {string} extensionId
   * @returns {Object|null}
   */
  getLoaded(extensionId) {
    if (!this.session) return null;
    if (this.session.extensions && typeof this.session.extensions.getExtension === 'function') {
      return this.session.extensions.getExtension(extensionId) || null;
    }
    if (this.session.extensions && typeof this.session.extensions.get === 'function') {
      return this.session.extensions.get(extensionId) || null;
    }
    if (typeof this.session.getExtension === 'function') {
      return this.session.getExtension(extensionId) || null;
    }
    return null;
  }

  /**
   * Checks if an extension is currently active in the session.
   * @param {string} extensionId
   * @returns {boolean}
   */
  isLoaded(extensionId) {
    return Boolean(this.getLoaded(extensionId));
  }
}

module.exports = ExtensionLoader;
