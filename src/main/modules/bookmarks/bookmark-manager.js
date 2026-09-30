/**
 * Núcleo Browser - Bookmark Manager
 * Business logic for bookmark CRUD, folder organization, hierarchy and search.
 * @module modules/bookmarks/bookmark-manager
 */

const { EventEmitter } = require('events');
const BookmarkStore = require('./bookmark-store');

class BookmarkManager extends EventEmitter {
  constructor(customStore = null) {
    super();
    this.store = customStore || new BookmarkStore();
  }

  async initialize() {
    await this.store.load();
    this.emit('initialized');
  }

  _normalizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      // Remove trailing slash for consistent matching
      return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}${parsed.search}`;
    } catch {
      return url.trim().replace(/\/+$/, '');
    }
  }

  /**
   * Adds a new bookmark or updates an existing one if the URL already exists.
   * @param {Object} param0
   * @returns {Promise<Object>}
   */
  async addBookmark({ title, url, favicon = null, folderId = 'toolbar' }) {
    if (!url || typeof url !== 'string') {
      throw new Error('URL inválida para favorito');
    }

    const trimmedUrl = url.trim();
    const cleanTitle = (title && typeof title === 'string') ? title.trim() : (trimmedUrl || 'Sem título');
    const targetFolderId = folderId || 'toolbar';

    // Verify folder exists
    const folders = this.store.data.folders;
    const folderExists = folders.some((f) => f.id === targetFolderId);
    const finalFolderId = folderExists ? targetFolderId : 'toolbar';

    // Prevent accidental duplicates (requirement 5)
    const normalizedNew = this._normalizeUrl(trimmedUrl);
    const existing = this.store.data.bookmarks.find((b) => this._normalizeUrl(b.url) === normalizedNew);

    if (existing) {
      existing.title = cleanTitle;
      existing.folderId = finalFolderId;
      if (favicon) existing.favicon = favicon;
      existing.updatedAt = Date.now();
      await this.store.save();
      this.emit('bookmarks-updated');
      return existing;
    }

    const newBookmark = {
      id: `bm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: cleanTitle,
      url: trimmedUrl,
      favicon: favicon || null,
      folderId: finalFolderId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.store.data.bookmarks.push(newBookmark);
    await this.store.save();
    this.emit('bookmarks-updated');
    return newBookmark;
  }

  /**
   * Removes a bookmark by its unique ID.
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async removeBookmark(id) {
    const idx = this.store.data.bookmarks.findIndex((b) => b.id === id);
    if (idx !== -1) {
      this.store.data.bookmarks.splice(idx, 1);
      await this.store.save();
      this.emit('bookmarks-updated');
      return true;
    }
    return false;
  }

  /**
   * Removes a bookmark by matching URL.
   * @param {string} url
   * @returns {Promise<boolean>}
   */
  async removeBookmarkByUrl(url) {
    const normalized = this._normalizeUrl(url);
    const initialLen = this.store.data.bookmarks.length;
    this.store.data.bookmarks = this.store.data.bookmarks.filter((b) => this._normalizeUrl(b.url) !== normalized);

    if (this.store.data.bookmarks.length !== initialLen) {
      await this.store.save();
      this.emit('bookmarks-updated');
      return true;
    }
    return false;
  }

  /**
   * Updates an existing bookmark's properties.
   * @param {string} id
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateBookmark(id, updates = {}) {
    const bookmark = this.store.data.bookmarks.find((b) => b.id === id);
    if (!bookmark) return null;

    if (updates.title !== undefined) bookmark.title = updates.title.trim();
    if (updates.url !== undefined) bookmark.url = updates.url.trim();
    if (updates.favicon !== undefined) bookmark.favicon = updates.favicon;
    if (updates.folderId !== undefined) {
      const folderExists = this.store.data.folders.some((f) => f.id === updates.folderId);
      if (folderExists) bookmark.folderId = updates.folderId;
    }
    bookmark.updatedAt = Date.now();

    await this.store.save();
    this.emit('bookmarks-updated');
    return bookmark;
  }

  /**
   * Checks whether a URL is currently bookmarked.
   * @param {string} url
   * @returns {boolean}
   */
  isBookmarked(url) {
    if (!url) return false;
    const normalized = this._normalizeUrl(url);
    return this.store.data.bookmarks.some((b) => this._normalizeUrl(b.url) === normalized);
  }

  /**
   * Gets bookmark record by URL.
   * @param {string} url
   * @returns {Object|null}
   */
  getBookmarkByUrl(url) {
    if (!url) return null;
    const normalized = this._normalizeUrl(url);
    return this.store.data.bookmarks.find((b) => this._normalizeUrl(b.url) === normalized) || null;
  }

  /**
   * Creates a new folder.
   * @param {Object} param0
   * @returns {Promise<Object>}
   */
  async createFolder({ title, parentId = 'root' }) {
    const cleanTitle = (title && typeof title === 'string') ? title.trim() : 'Nova Pasta';
    const newFolder = {
      id: `fld-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: cleanTitle,
      parentId: parentId || 'root',
      createdAt: Date.now()
    };

    this.store.data.folders.push(newFolder);
    await this.store.save();
    this.emit('bookmarks-updated');
    return newFolder;
  }

  /**
   * Renames a folder.
   * @param {string} id
   * @param {string} newTitle
   */
  async renameFolder(id, newTitle) {
    if (id === 'root' || id === 'toolbar' || id === 'other') {
      return null; // System protected folders
    }
    const folder = this.store.data.folders.find((f) => f.id === id);
    if (!folder) return null;

    folder.title = (newTitle && typeof newTitle === 'string') ? newTitle.trim() : folder.title;
    await this.store.save();
    this.emit('bookmarks-updated');
    return folder;
  }

  /**
   * Deletes a folder and moves its items to the parent folder.
   * @param {string} id
   */
  async deleteFolder(id) {
    if (id === 'root' || id === 'toolbar' || id === 'other') {
      return false; // System protected folders
    }

    const folderIndex = this.store.data.folders.findIndex((f) => f.id === id);
    if (folderIndex === -1) return false;

    const parentId = this.store.data.folders[folderIndex].parentId || 'root';

    // Move child bookmarks to parent
    this.store.data.bookmarks.forEach((b) => {
      if (b.folderId === id) {
        b.folderId = parentId;
      }
    });

    // Move subfolders to parent
    this.store.data.folders.forEach((f) => {
      if (f.parentId === id) {
        f.parentId = parentId;
      }
    });

    this.store.data.folders.splice(folderIndex, 1);
    await this.store.save();
    this.emit('bookmarks-updated');
    return true;
  }

  /**
   * Moves a bookmark to a new target folder.
   * @param {string} bookmarkId
   * @param {string} targetFolderId
   */
  async moveBookmark(bookmarkId, targetFolderId) {
    const bookmark = this.store.data.bookmarks.find((b) => b.id === bookmarkId);
    if (!bookmark) return false;

    const folderExists = this.store.data.folders.some((f) => f.id === targetFolderId);
    if (!folderExists) return false;

    bookmark.folderId = targetFolderId;
    bookmark.updatedAt = Date.now();
    await this.store.save();
    this.emit('bookmarks-updated');
    return true;
  }

  /**
   * Searches bookmarks by title or URL.
   * @param {string} query
   * @returns {Array<Object>}
   */
  searchBookmarks(query) {
    if (!query || typeof query !== 'string') {
      return this.getAllBookmarks();
    }
    const q = query.toLowerCase().trim();
    return this.store.data.bookmarks.filter(
      (b) => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q)
    );
  }

  getAllBookmarks() {
    return [...this.store.data.bookmarks];
  }

  getFolders() {
    return [...this.store.data.folders];
  }

  getToolbarBookmarks() {
    return this.store.data.bookmarks.filter((b) => b.folderId === 'toolbar');
  }

  getQuickAccessBookmarks(limit = 8) {
    // Return toolbar bookmarks or top items
    const toolbarItems = this.getToolbarBookmarks();
    if (toolbarItems.length >= limit) {
      return toolbarItems.slice(0, limit);
    }
    const otherItems = this.store.data.bookmarks.filter((b) => b.folderId !== 'toolbar');
    return [...toolbarItems, ...otherItems].slice(0, limit);
  }

  /**
   * Returns a complete hierarchical representation of folders and their bookmarks.
   */
  getTree() {
    const folders = this.getFolders();
    const bookmarks = this.getAllBookmarks();

    const buildNode = (folderId) => {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) return null;

      const subfolders = folders
        .filter((f) => f.parentId === folderId)
        .map((f) => buildNode(f.id))
        .filter(Boolean);

      const items = bookmarks.filter((b) => b.folderId === folderId);

      return {
        ...folder,
        subfolders,
        bookmarks: items
      };
    };

    return buildNode('root');
  }
}

module.exports = BookmarkManager;
