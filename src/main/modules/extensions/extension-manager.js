/**
 * Núcleo Browser - Extension Manager
 * Master orchestrator for extension lifecycle, installation, loading, persistence and events
 * @module modules/extensions/extension-manager
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');
const ExtensionValidator = require('./extension-validator');
const ExtensionStore = require('./extension-store');
const ExtensionLoader = require('./extension-loader');
const ExtensionEvents = require('./extension-events');

class ExtensionManager extends EventEmitter {
  /**
   * @param {Object} [browserEngine] - Núcleo BrowserEngine instance
   * @param {Object} [options]
   */
  constructor(browserEngine = null, options = {}) {
    super();
    this.engine = browserEngine;
    this.store = options.store || new ExtensionStore(options.storePath || null);
    this.validator = ExtensionValidator;
    this.loader = options.loader || new ExtensionLoader(null);
    this.extensionsDir = options.extensionsDir || (
      app && app.getPath
        ? path.join(app.getPath('userData'), 'extensions')
        : path.join(process.cwd(), 'userData', 'extensions')
    );
    this.popupWindow = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the extension subsystem on browser startup.
   */
  async initialize() {
    if (this.isInitialized) return;

    if (this.engine) {
      this.loader.setSession(this.engine.getSession());
    }

    // 1. Ensure user extensions directory exists
    try {
      await fs.promises.mkdir(this.extensionsDir, { recursive: true });
    } catch (err) {
      console.warn('[ExtensionManager] Error creating extensions directory:', err.message);
    }

    // 2. Load persistent registry
    await this.store.load();

    // 3. Load all enabled extensions into the session
    const stored = this.store.getAll();
    console.log(`[ExtensionManager] Found ${stored.length} registered extensions in store.`);

    for (const ext of stored) {
      if (ext.enabled) {
        try {
          const exists = fs.existsSync(ext.path);
          if (!exists) {
            console.warn(`[ExtensionManager] Extension directory missing on disk: ${ext.path}`);
            await this.store.setError(ext.id, 'Diretório da extensão não encontrado no disco.');
            continue;
          }

          const res = await this.loader.load(ext.path);
          if (res.success) {
            await this.store.setError(ext.id, null);
            console.log(`[ExtensionManager] Loaded extension: ${ext.name} (${ext.id})`);
          } else {
            console.warn(`[ExtensionManager] Failed to load extension ${ext.name}: ${res.error}`);
            await this.store.setError(ext.id, res.error);
          }
        } catch (err) {
          console.error(`[ExtensionManager] Uncaught error loading extension ${ext.id}:`, err);
          await this.store.setError(ext.id, err.message);
        }
      }
    }

    this.isInitialized = true;
    this.emit(ExtensionEvents.EXTENSIONS_UPDATED, this.getAll());
  }

  /**
   * Installs an unpacked extension from a local directory chosen by user.
   * Copies files to isolated userData/extensions/ to preserve user original files.
   * @param {string} sourceDir
   * @returns {Promise<{ success: boolean, extension?: Object, errors?: string[], warnings?: string[] }>}
   */
  async installFromDirectory(sourceDir) {
    if (!sourceDir || typeof sourceDir !== 'string') {
      return { success: false, errors: ['Caminho do diretório de origem inválido.'] };
    }

    // 1. Validate original source folder
    const validation = await this.validator.validateDirectory(sourceDir);
    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors,
        warnings: validation.warnings
      };
    }

    const { metadata, manifestVersion } = validation;
    const safeName = (metadata.name || 'extension').toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
    const targetDirName = `${safeName}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const destinationDir = path.join(this.extensionsDir, targetDirName);

    try {
      // 2. Copy files recursively into isolated userData/extensions/<id>
      await fs.promises.mkdir(destinationDir, { recursive: true });
      await fs.promises.cp(sourceDir, destinationDir, { recursive: true });

      // 3. Load extension natively in Chromium/Electron
      const loadResult = await this.loader.load(destinationDir);
      if (!loadResult.success) {
        // Clean up copied directory if load failed
        await fs.promises.rm(destinationDir, { recursive: true, force: true }).catch(() => {});
        return {
          success: false,
          errors: [`Falha ao carregar extensão no Chromium: ${loadResult.error}`]
        };
      }

      const electronExt = loadResult.extension;
      const extensionId = electronExt.id;

      // 4. Construct persistent record
      const extensionRecord = {
        id: extensionId,
        name: metadata.name || electronExt.name,
        version: metadata.version || electronExt.version,
        description: metadata.description || '',
        path: destinationDir,
        originalSourcePath: sourceDir,
        enabled: true,
        manifestVersion: manifestVersion || 3,
        permissions: metadata.permissions || [],
        hostPermissions: metadata.hostPermissions || [],
        action: metadata.action || null,
        hasPopup: metadata.hasPopup || false,
        hasBackground: metadata.hasBackground || false,
        background: metadata.background || null,
        hasContentScripts: metadata.hasContentScripts || false,
        contentScripts: metadata.contentScripts || [],
        icons: metadata.icons || null,
        author: metadata.author || null,
        homepage: metadata.homepage || null,
        installDate: Date.now(),
        error: null
      };

      // 5. Save to store
      await this.store.add(extensionRecord);

      // 6. Notify listeners
      this.emit(ExtensionEvents.EXTENSION_INSTALLED, extensionRecord);
      this.emit(ExtensionEvents.EXTENSIONS_UPDATED, this.getAll());

      return {
        success: true,
        extension: extensionRecord,
        warnings: validation.warnings
      };
    } catch (err) {
      console.error('[ExtensionManager] Error installing extension:', err);
      // Clean up copied directory on unexpected error
      await fs.promises.rm(destinationDir, { recursive: true, force: true }).catch(() => {});
      return {
        success: false,
        errors: [`Erro ao instalar extensão: ${err.message}`]
      };
    }
  }

  /**
   * Uninstalls and removes an extension completely.
   * @param {string} extensionId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async uninstall(extensionId) {
    const ext = this.store.get(extensionId);
    if (!ext) {
      return { success: false, error: 'Extensão não encontrada no registro.' };
    }

    // 1. Unload from active session
    this.loader.unload(extensionId);

    // 2. Remove files from disk in userData/extensions/<id>
    if (ext.path && ext.path.startsWith(this.extensionsDir)) {
      try {
        await fs.promises.rm(ext.path, { recursive: true, force: true });
      } catch (err) {
        console.warn(`[ExtensionManager] Could not delete directory ${ext.path}:`, err.message);
      }
    }

    // 3. Remove from store
    await this.store.remove(extensionId);

    // 4. Emit events
    this.emit(ExtensionEvents.EXTENSION_REMOVED, extensionId);
    this.emit(ExtensionEvents.EXTENSIONS_UPDATED, this.getAll());

    return { success: true };
  }

  /**
   * Enables a previously disabled extension.
   * @param {string} extensionId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async enable(extensionId) {
    const ext = this.store.get(extensionId);
    if (!ext) {
      return { success: false, error: 'Extensão não encontrada.' };
    }

    if (!fs.existsSync(ext.path)) {
      const err = 'Diretório da extensão não encontrado no disco.';
      await this.store.setError(extensionId, err);
      return { success: false, error: err };
    }

    const res = await this.loader.load(ext.path);
    if (!res.success) {
      await this.store.setError(extensionId, res.error);
      return { success: false, error: res.error };
    }

    await this.store.setEnabled(extensionId, true);
    await this.store.setError(extensionId, null);

    this.emit(ExtensionEvents.EXTENSION_ENABLED, ext);
    this.emit(ExtensionEvents.EXTENSIONS_UPDATED, this.getAll());

    return { success: true };
  }

  /**
   * Disables an active extension without removing its files.
   * @param {string} extensionId
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async disable(extensionId) {
    const ext = this.store.get(extensionId);
    if (!ext) {
      return { success: false, error: 'Extensão não encontrada.' };
    }

    this.loader.unload(extensionId);
    await this.store.setEnabled(extensionId, false);

    this.emit(ExtensionEvents.EXTENSION_DISABLED, ext);
    this.emit(ExtensionEvents.EXTENSIONS_UPDATED, this.getAll());

    return { success: true };
  }

  /**
   * Toggles extension enabled/disabled state.
   * @param {string} extensionId
   * @returns {Promise<{ success: boolean, enabled: boolean, error?: string }>}
   */
  async toggle(extensionId) {
    const ext = this.store.get(extensionId);
    if (!ext) {
      return { success: false, enabled: false, error: 'Extensão não encontrada.' };
    }

    if (ext.enabled) {
      const res = await this.disable(extensionId);
      return { success: res.success, enabled: false, error: res.error };
    } else {
      const res = await this.enable(extensionId);
      return { success: res.success, enabled: true, error: res.error };
    }
  }

  /**
   * Returns all extensions with active session loaded state.
   * @returns {Object[]}
   */
  getAll() {
    return this.store.getAll().map(ext => ({
      ...ext,
      isLoaded: this.loader.isLoaded(ext.id)
    }));
  }

  /**
   * Returns a single extension by ID.
   * @param {string} extensionId
   * @returns {Object|null}
   */
  get(extensionId) {
    const ext = this.store.get(extensionId);
    if (!ext) return null;
    return {
      ...ext,
      isLoaded: this.loader.isLoaded(ext.id)
    };
  }

  /**
   * Alias for get(extensionId)
   * @param {string} extensionId
   * @returns {Object|null}
   */
  getExtension(extensionId) {
    return this.get(extensionId);
  }

  /**
   * Alias for disable(extensionId)
   * @param {string} extensionId
   */
  disableExtension(extensionId) {
    return this.disable(extensionId);
  }

  /**
   * Alias for enable(extensionId)
   * @param {string} extensionId
   */
  enableExtension(extensionId) {
    return this.enable(extensionId);
  }

  /**
   * Alias for uninstall(extensionId)
   * @param {string} extensionId
   */
  uninstallExtension(extensionId) {
    return this.uninstall(extensionId);
  }

  /**
   * Opens the extension popup window if default_popup is configured.
   * @param {string} extensionId
   * @param {Object} [bounds] - Optional anchor bounds { x, y }
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async openPopup(extensionId, bounds = null) {
    const ext = this.get(extensionId);
    if (!ext) {
      return { success: false, error: 'Extensão não encontrada.' };
    }

    if (!ext.hasPopup || !ext.action || !ext.action.popup) {
      return { success: false, error: 'A extensão não possui popup definido em action.default_popup.' };
    }

    // Toggle close if already open for this extension
    if (this.popupWindow && !this.popupWindow.isDestroyed()) {
      this.popupWindow.close();
      this.popupWindow = null;
      return { success: true, closed: true };
    }

    try {
      const popupUrl = `chrome-extension://${ext.id}/${ext.action.popup}`;
      const winX = bounds && bounds.x ? Math.max(10, Math.round(bounds.x - 280)) : undefined;
      const winY = bounds && bounds.y ? Math.max(10, Math.round(bounds.y + 4)) : undefined;

      this.popupWindow = new BrowserWindow({
        width: 320,
        height: 400,
        x: winX,
        y: winY,
        frame: false,
        resizable: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: '#0a0d14',
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false
        }
      });

      this.popupWindow.on('blur', () => {
        if (this.popupWindow && !this.popupWindow.isDestroyed()) {
          this.popupWindow.close();
          this.popupWindow = null;
        }
      });

      await this.popupWindow.loadURL(popupUrl);
      this.popupWindow.show();
      return { success: true, opened: true };
    } catch (err) {
      console.error('[ExtensionManager] Error opening extension popup:', err);
      return { success: false, error: err.message };
    }
  }
}

module.exports = ExtensionManager;
