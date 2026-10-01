/**
 * Núcleo Browser - Workspace Store
 * Atomic serialized JSON persistence for Workspaces and Tab state.
 * @module modules/workspaces/workspace-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CURRENT_SCHEMA_VERSION = 1;

class WorkspaceStore {
  /**
   * @param {string} [customFilePath] - Custom path for storage (useful for isolated tests)
   */
  constructor(customFilePath = null) {
    this.filePath = customFilePath || (app ? path.join(app.getPath('userData'), 'workspaces.json') : path.join(process.cwd(), 'workspaces.json'));
    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      activeWorkspaceId: 'workspace-pessoal',
      workspaces: []
    };
    this.isLoaded = false;
    this._saving = false;
    this._saveQueued = false;
  }

  _getDefaultData() {
    const now = Date.now();
    return {
      version: CURRENT_SCHEMA_VERSION,
      activeWorkspaceId: 'workspace-pessoal',
      workspaces: [
        {
          id: 'workspace-pessoal',
          name: 'Pessoal',
          color: 'cyan',
          icon: 'home',
          createdAt: now,
          updatedAt: now,
          activeTabId: null,
          tabIds: [],
          tabs: []
        }
      ]
    };
  }

  /**
   * Loads data from disk or initializes defaults on failure/missing file.
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.workspaces) && parsed.workspaces.length > 0) {
          // Normalize loaded workspaces
          this.data = {
            version: parsed.version || CURRENT_SCHEMA_VERSION,
            activeWorkspaceId: parsed.activeWorkspaceId || parsed.workspaces[0].id,
            workspaces: parsed.workspaces
          };
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[WorkspaceStore] Corrupted or invalid workspaces file at ${this.filePath}. Backing up and resetting:`, err.message);
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
   * Atomically saves workspace data to disk via temp file rename.
   * @param {Object} [newData]
   */
  async save(newData = null) {
    if (newData) {
      this.setData(newData);
    }
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
        console.error('[WorkspaceStore] Error saving workspaces atomically:', err);
      } finally {
        this._savingPromise = null;
      }
    })();

    return this._savingPromise;
  }

  getData() {
    return this.data;
  }

  setData(newData) {
    if (newData && Array.isArray(newData.workspaces)) {
      this.data = {
        version: CURRENT_SCHEMA_VERSION,
        activeWorkspaceId: newData.activeWorkspaceId || (newData.workspaces[0] ? newData.workspaces[0].id : null),
        workspaces: newData.workspaces
      };
    }
  }
}

module.exports = WorkspaceStore;
