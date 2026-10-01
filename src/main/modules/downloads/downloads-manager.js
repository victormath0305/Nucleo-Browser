/**
 * Núcleo Browser - Downloads Manager Subsystem
 * Native download interception, lifecycle management, speed & ETA tracking, and UI orchestration.
 * @module modules/downloads/downloads-manager
 */

const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { shell, app } = require('electron');
const DownloadsUtils = require('./downloads-utils');
const DownloadModel = require('./downloads-model');
const DownloadsStore = require('./downloads-store');

class DownloadsManager extends EventEmitter {
  /**
   * @param {Object} options
   * @param {Object} [options.settingsManager]
   * @param {Object} [options.tabManager]
   * @param {Object} [options.windowController]
   * @param {DownloadsStore} [options.store]
   */
  constructor({ settingsManager = null, tabManager = null, windowController = null, store = null } = {}) {
    super();
    this.settingsManager = settingsManager;
    this.tabManager = tabManager;
    this.windowController = windowController;
    this.store = store || new DownloadsStore();

    /** @type {Map<string, { item: Object, model: DownloadModel, lastBytes: number, lastTime: number, lastSpeed: number, throttleTimer: any }>} */
    this.activeDownloads = new Map();
    this.isInitialized = false;
  }

  /**
   * Initializes the download manager and loads stored history.
   */
  async initialize() {
    if (this.isInitialized) return;
    await this.store.load();
    this.isInitialized = true;
  }

  /**
   * Attaches download interception to an Electron web session.
   * @param {Electron.Session} session 
   */
  attachToSession(session) {
    if (!session || typeof session.on !== 'function') return;

    session.on('will-download', (event, item, webContents) => {
      this._handleWillDownload(event, item, webContents);
    });
  }

  /**
   * Resolves originating workspace and tab ID from webContents.
   * @private
   */
  _resolveContext(webContents) {
    let workspaceId = null;
    let tabId = null;

    try {
      if (this.tabManager && webContents) {
        let matchingTab = null;
        if (typeof this.tabManager.getTabByWebContentsId === 'function') {
          matchingTab = this.tabManager.getTabByWebContentsId(webContents.id);
        }
        if (!matchingTab && this.tabManager.tabs) {
          for (const t of this.tabManager.tabs.values()) {
            if ((t.webContents && t.webContents.id === webContents.id) ||
                (t.view && t.view.webContents && t.view.webContents.id === webContents.id)) {
              matchingTab = t;
              break;
            }
          }
        }
        if (matchingTab) {
          tabId = matchingTab.id;
          workspaceId = matchingTab.workspaceId || null;
        }
      }

      if (!workspaceId && this.tabManager && this.tabManager.workspaceManager) {
        workspaceId = this.tabManager.workspaceManager.getActiveWorkspace()?.id || null;
      }
    } catch (err) {
      console.warn('[DownloadsManager] Context resolution error:', err.message);
    }

    return { workspaceId, tabId };
  }

  /**
   * Handles will-download lifecycle event from Chromium.
   * @private
   */
  async _handleWillDownload(event, item, webContents) {
    const filename = item.getFilename();
    const { workspaceId, tabId } = this._resolveContext(webContents);

    // Resolve target path and ask location setting
    const askLocation = this.settingsManager ? !!this.settingsManager.get('downloads.askLocation') : false;
    const defaultDir = this.settingsManager ? this.settingsManager.get('downloads.defaultPath') : null;
    const effectiveDir = defaultDir && fs.existsSync(defaultDir) 
      ? defaultDir 
      : (app ? app.getPath('downloads') : path.join(process.cwd(), 'downloads'));

    let savePath = '';
    if (!askLocation) {
      // Automatic unique save path
      try {
        if (!fs.existsSync(effectiveDir)) {
          fs.mkdirSync(effectiveDir, { recursive: true });
        }
        savePath = DownloadsUtils.getUniqueFilePath(effectiveDir, filename);
        item.setSavePath(savePath);
      } catch (err) {
        console.warn('[DownloadsManager] Error configuring automatic save path:', err.message);
      }
    } else {
      // User requested to choose location: configure dialog options
      try {
        item.setSaveDialogOptions({
          defaultPath: path.join(effectiveDir, DownloadsUtils.sanitizeFilename(filename))
        });
      } catch (err) {
        console.warn('[DownloadsManager] Error configuring save dialog options:', err.message);
      }
    }

    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const urlChain = typeof item.getURLChain === 'function' ? item.getURLChain() : [];
    const finalUrl = urlChain.length > 0 ? urlChain[urlChain.length - 1] : item.getURL();

    const model = new DownloadModel({
      id,
      filename: item.getFilename(),
      url: item.getURL(),
      finalUrl,
      mimeType: item.getMimeType ? item.getMimeType() : '',
      savePath: item.getSavePath ? item.getSavePath() : savePath,
      totalBytes: item.getTotalBytes ? item.getTotalBytes() : 0,
      receivedBytes: item.getReceivedBytes ? item.getReceivedBytes() : 0,
      state: 'downloading',
      workspaceId,
      tabId,
      startTime: Date.now()
    });

    const activeEntry = {
      item,
      model,
      lastBytes: model.receivedBytes,
      lastTime: Date.now(),
      lastSpeed: 0,
      throttleTimer: null
    };

    this.activeDownloads.set(id, activeEntry);
    await this.store.add(model.toJSON());
    this.emit('download-created', model.toJSON());

    // Listen to download progress
    item.on('updated', (ev, state) => {
      this._handleItemUpdated(id, state);
    });

    // Listen to download completion / cancellation / failure
    item.once('done', (ev, state) => {
      this._handleItemDone(id, state);
    });
  }

  /**
   * Handles live progress updates for an active download item.
   * @private
   */
  _handleItemUpdated(id, state) {
    const entry = this.activeDownloads.get(id);
    if (!entry) return;

    const { item, model } = entry;
    const now = Date.now();
    const received = item.getReceivedBytes();
    const total = item.getTotalBytes();
    const canResume = typeof item.canResume === 'function' ? item.canResume() : false;

    // Calculate download speed and ETA
    let speed = 0;
    let eta = null;
    const deltaTime = (now - entry.lastTime) / 1000;

    if (deltaTime >= 0.25) {
      const deltaBytes = received - entry.lastBytes;
      const rawSpeed = deltaBytes > 0 ? deltaBytes / deltaTime : 0;
      // Exponential moving average for smooth display
      speed = entry.lastSpeed > 0 ? 0.7 * rawSpeed + 0.3 * entry.lastSpeed : rawSpeed;
      entry.lastSpeed = speed;
      entry.lastBytes = received;
      entry.lastTime = now;
    } else {
      speed = entry.lastSpeed;
    }

    if (speed > 100 && total > received) {
      eta = (total - received) / speed;
    }

    if (state === 'interrupted') {
      if (typeof item.isPaused === 'function' && item.isPaused()) {
        model.pause();
      } else {
        model.fail('Download interrompido');
      }
    } else if (state === 'progressing') {
      if (typeof item.isPaused === 'function' && item.isPaused()) {
        model.pause();
      } else {
        model.updateProgress(received, total, speed, eta, canResume);
      }
    }

    if (item.getSavePath) {
      model.savePath = item.getSavePath();
    }

    // Throttle UI update broadcasts (150ms) to prevent IPC flooding
    if (!entry.throttleTimer) {
      entry.throttleTimer = setTimeout(() => {
        entry.throttleTimer = null;
        this.emit('download-updated', model.toJSON());
      }, 150);
    }
  }

  /**
   * Handles download termination (completed, cancelled, or failed).
   * @private
   */
  async _handleItemDone(id, state) {
    const entry = this.activeDownloads.get(id);
    if (!entry) return;

    if (entry.throttleTimer) {
      clearTimeout(entry.throttleTimer);
      entry.throttleTimer = null;
    }

    const { item, model } = entry;
    if (item.getSavePath) {
      model.savePath = item.getSavePath();
    }

    if (state === 'completed') {
      model.complete();
    } else if (state === 'cancelled') {
      model.cancel();
    } else {
      model.fail('Falha ao concluir o download');
    }

    this.activeDownloads.delete(id);
    await this.store.update(id, model.toJSON());

    this.emit('download-done', model.toJSON());
    this.emit('download-updated', model.toJSON());
  }

  /**
   * Pauses an active download.
   * @param {string} id 
   * @returns {boolean}
   */
  pauseDownload(id) {
    const entry = this.activeDownloads.get(id);
    if (entry && entry.item && typeof entry.item.pause === 'function') {
      entry.item.pause();
      entry.model.pause();
      this.store.update(id, entry.model.toJSON());
      this.emit('download-updated', entry.model.toJSON());
      return true;
    }
    return false;
  }

  /**
   * Resumes a paused download.
   * @param {string} id 
   * @returns {boolean}
   */
  resumeDownload(id) {
    const entry = this.activeDownloads.get(id);
    if (entry && entry.item && typeof entry.item.resume === 'function') {
      entry.item.resume();
      entry.model.resume();
      this.store.update(id, entry.model.toJSON());
      this.emit('download-updated', entry.model.toJSON());
      return true;
    }
    return false;
  }

  /**
   * Cancels an active download.
   * @param {string} id 
   * @returns {boolean}
   */
  cancelDownload(id) {
    const entry = this.activeDownloads.get(id);
    if (entry && entry.item && typeof entry.item.cancel === 'function') {
      entry.item.cancel();
      entry.model.cancel();
      this.store.update(id, entry.model.toJSON());
      this.emit('download-updated', entry.model.toJSON());
      return true;
    }

    // If not active in memory, update stored record if it was active
    const stored = this.store.getById(id);
    if (stored && (stored.state === 'downloading' || stored.state === 'paused')) {
      this.store.update(id, { state: 'cancelled', cancelled: true });
      this.emit('download-updated', this.store.getById(id));
      return true;
    }

    return false;
  }

  /**
   * Opens the downloaded file using the default system handler.
   * @param {string} id 
   * @returns {Promise<{ success: boolean, error?: string }>}
   */
  async openFile(id) {
    const record = this.getById(id);
    if (!record || !record.savePath) {
      return { success: false, error: 'Download não encontrado ou caminho indefinido' };
    }

    if (!fs.existsSync(record.savePath)) {
      return { success: false, error: 'O arquivo não foi encontrado no disco' };
    }

    try {
      const result = await shell.openPath(record.savePath);
      if (result) {
        return { success: false, error: result };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reveals the downloaded file inside the OS file manager (Windows Explorer).
   * @param {string} id 
   * @returns {{ success: boolean, error?: string }}
   */
  showInFolder(id) {
    const record = this.getById(id);
    if (!record || !record.savePath) {
      return { success: false, error: 'Download não encontrado' };
    }

    if (!fs.existsSync(record.savePath)) {
      // Fallback: check if the parent directory exists and open it
      const parentDir = path.dirname(record.savePath);
      if (fs.existsSync(parentDir)) {
        shell.openPath(parentDir);
        return { success: true };
      }
      return { success: false, error: 'Arquivo ou pasta de destino não encontrado' };
    }

    try {
      shell.showItemInFolder(record.savePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Removes a download from history and cancels it if active.
   * @param {string} id 
   * @returns {Promise<boolean>}
   */
  async removeDownload(id) {
    if (this.activeDownloads.has(id)) {
      this.cancelDownload(id);
    }
    const removed = await this.store.remove(id);
    if (removed) {
      this.emit('download-removed', id);
    }
    return removed;
  }

  /**
   * Clears all completed, failed, or cancelled downloads.
   * @returns {Promise<void>}
   */
  async clearHistory() {
    await this.store.clearCompleted();
    this.emit('downloads-cleared');
  }

  /**
   * Retrieves all downloads, integrating real-time memory state for active transfers.
   * @returns {Array<Object>}
   */
  getAll() {
    const stored = this.store.getAll();
    const result = [];

    for (const item of stored) {
      const active = this.activeDownloads.get(item.id);
      if (active) {
        result.push(active.model.toJSON());
      } else {
        result.push(item);
      }
    }

    return result;
  }

  /**
   * Retrieves a download item by ID.
   * @param {string} id 
   * @returns {Object|null}
   */
  getById(id) {
    const active = this.activeDownloads.get(id);
    if (active) {
      return active.model.toJSON();
    }
    return this.store.getById(id);
  }

  /**
   * Returns current count of active downloading/paused items.
   * @returns {number}
   */
  getActiveCount() {
    let count = 0;
    for (const entry of this.activeDownloads.values()) {
      if (entry.model.state === 'downloading' || entry.model.state === 'paused') {
        count++;
      }
    }
    return count;
  }
}

module.exports = DownloadsManager;
