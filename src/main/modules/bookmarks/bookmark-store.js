/**
 * Núcleo Browser - Bookmarks Store
 * Persistent, versioned atomic JSON storage for bookmarks and folders.
 * @module modules/bookmarks/bookmark-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CURRENT_SCHEMA_VERSION = 1;

class BookmarkStore {
  /**
   * @param {string} [customFilePath] - Custom path for storage (useful for isolated tests)
   */
  constructor(customFilePath = null) {
    this.filePath = customFilePath || (app ? path.join(app.getPath('userData'), 'bookmarks.json') : path.join(process.cwd(), 'bookmarks.json'));
    this.data = {
      version: CURRENT_SCHEMA_VERSION,
      folders: [],
      bookmarks: []
    };
    this.isLoaded = false;
    this._saving = false;
    this._saveQueued = false;
  }

  _getDefaultData() {
    const now = Date.now();
    return {
      version: CURRENT_SCHEMA_VERSION,
      folders: [
        { id: 'root', title: 'Todos os Favoritos', parentId: null, createdAt: now },
        { id: 'toolbar', title: 'Barra de Favoritos', parentId: 'root', createdAt: now },
        { id: 'other', title: 'Outros Favoritos', parentId: 'root', createdAt: now }
      ],
      bookmarks: [
        {
          id: 'bm-github',
          title: 'GitHub',
          url: 'https://github.com',
          favicon: 'https://github.githubassets.com/favicons/favicon.svg',
          folderId: 'toolbar',
          createdAt: now,
          updatedAt: now
        },
        {
          id: 'bm-ddg',
          title: 'DuckDuckGo',
          url: 'https://duckduckgo.com',
          favicon: 'https://duckduckgo.com/favicon.ico',
          folderId: 'toolbar',
          createdAt: now + 1,
          updatedAt: now + 1
        }
      ]
    };
  }

  /**
   * Loads data from disk, creating defaults if file does not exist.
   */
  async load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = await fs.promises.readFile(this.filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.bookmarks) && Array.isArray(parsed.folders)) {
          this.data = parsed;
          this.isLoaded = true;
          return this.data;
        }
      }
    } catch (err) {
      console.warn(`[BookmarkStore] Failed to read bookmarks from ${this.filePath}, initializing defaults:`, err.message);
    }

    this.data = this._getDefaultData();
    this.isLoaded = true;
    await this.save();
    return this.data;
  }

  /**
   * Atomically saves bookmark data to disk via temp file rename.
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

        // Ensure directory exists
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
      console.error('[BookmarkStore] Error saving bookmarks atomically:', err);
    } finally {
      this._saving = false;
    }
  }

  getData() {
    return this.data;
  }
}

module.exports = BookmarkStore;
