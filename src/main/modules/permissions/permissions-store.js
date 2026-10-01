/**
 * Núcleo Browser - Permissions Store
 * Atomic, serialized, and resilient persistence for site permissions.
 * @module modules/permissions/permissions-store
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const PermissionModel = require('./permissions-model');
const { normalizeOrigin } = require('./permissions-utils');

class PermissionsStore {
  /**
   * @param {object|string} [optionsOrPath={}]
   * @param {string} [optionsOrPath.customPath] - Path override for testing
   */
  constructor(optionsOrPath = {}) {
    const customPath = typeof optionsOrPath === 'string' ? optionsOrPath : optionsOrPath?.customPath;
    this.customPath = customPath || null;
    this.filePath = this.customPath || null;
    this.sites = new Map(); // Map<origin, PermissionModel>
    this.isLoaded = false;
    this._saveQueue = Promise.resolve();
  }

  /**
   * Loads permissions and returns the sites Map.
   * Compatible with other stores' load() contract.
   * @returns {Promise<Map<string, PermissionModel>>}
   */
  async load() {
    await this.initialize();
    return this.sites;
  }

  _resolveFilePath() {
    if (this.filePath) return this.filePath;
    try {
      if (app && typeof app.getPath === 'function') {
        const userData = app.getPath('userData');
        this.filePath = path.join(userData, 'permissions.json');
      } else {
        this.filePath = path.join(process.cwd(), 'permissions.json');
      }
    } catch {
      this.filePath = path.join(process.cwd(), 'permissions.json');
    }
    return this.filePath;
  }

  /**
   * Initializes the store by loading the persisted permissions file.
   */
  async initialize() {
    const targetFile = this._resolveFilePath();

    try {
      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      if (fs.existsSync(targetFile)) {
        const raw = await fs.promises.readFile(targetFile, 'utf8');
        try {
          const parsed = JSON.parse(raw);
          this._loadFromParsed(parsed);
          this.isLoaded = true;
          return;
        } catch (parseErr) {
          console.warn(`[PermissionsStore] Corrupted permissions file at ${targetFile}. Backing up and resetting:`, parseErr.message);
          const backupPath = `${targetFile}.corrupted.${Date.now()}`;
          try {
            await fs.promises.copyFile(targetFile, backupPath);
          } catch (bkErr) {
            console.error('[PermissionsStore] Failed to create corruption backup:', bkErr);
          }
          this._initEmpty();
          await this.save();
          this.isLoaded = true;
          return;
        }
      }

      this._initEmpty();
      await this.save();
      this.isLoaded = true;
    } catch (err) {
      console.error('[PermissionsStore] Failed to initialize permissions store:', err);
      this._initEmpty();
      this.isLoaded = true;
    }
  }

  _initEmpty() {
    this.sites.clear();
  }

  _loadFromParsed(data) {
    this.sites.clear();
    if (!data || typeof data !== 'object') return;

    const sitesObj = data.sites || {};
    for (const [originKey, siteData] of Object.entries(sitesObj)) {
      try {
        const model = PermissionModel.fromJSON(siteData);
        if (model.hasOverrides()) {
          this.sites.set(model.origin, model);
        }
      } catch (err) {
        console.warn(`[PermissionsStore] Skipping malformed site permission record for ${originKey}:`, err.message);
      }
    }
  }

  /**
   * Retrieves a site's permission model if present.
   *
   * @param {string} rawOrigin
   * @returns {PermissionModel|null}
   */
  getSite(rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return null;
    return this.sites.get(origin) || null;
  }

  /**
   * Retrieves or creates a PermissionModel for the origin.
   *
   * @param {string} rawOrigin
   * @returns {PermissionModel|null}
   */
  getOrCreateSite(rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return null;

    let model = this.sites.get(origin);
    if (!model) {
      model = new PermissionModel(origin);
      this.sites.set(origin, model);
    }
    return model;
  }

  /**
   * Returns an array of all site models that currently have overrides.
   *
   * @returns {PermissionModel[]}
   */
  getAllSites() {
    return Array.from(this.sites.values());
  }

  /**
   * Sets a permission for an origin and persists to disk.
   *
   * @param {string} rawOrigin
   * @param {string} permission
   * @param {'allow'|'deny'|'ask'} state
   */
  async setSitePermission(rawOrigin, permission, state) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) throw new Error(`[PermissionsStore] Invalid origin: "${rawOrigin}"`);

    const model = this.getOrCreateSite(origin);
    model.set(permission, state);

    if (!model.hasOverrides()) {
      this.sites.delete(origin);
    }

    await this.save();
    return model;
  }

  /**
   * Resets a specific permission for an origin.
   *
   * @param {string} rawOrigin
   * @param {string} permission
   */
  async resetSitePermission(rawOrigin, permission) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return;

    const model = this.sites.get(origin);
    if (model) {
      model.reset(permission);
      if (!model.hasOverrides()) {
        this.sites.delete(origin);
      }
      await this.save();
    }
  }

  /**
   * Resets all permissions for a specific site (removes the site).
   *
   * @param {string} rawOrigin
   */
  async resetSite(rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return;

    if (this.sites.has(origin)) {
      this.sites.delete(origin);
      await this.save();
    }
  }

  /**
   * Resets all permissions across all sites in the entire browser.
   */
  async resetAll() {
    this.sites.clear();
    await this.save();
  }

  /**
   * Serializes the data for persistence.
   */
  toJSON() {
    const sitesObj = {};
    for (const [origin, model] of this.sites.entries()) {
      if (model.hasOverrides()) {
        sitesObj[origin] = model.toJSON();
      }
    }
    return {
      version: 1,
      updatedAt: Date.now(),
      sites: sitesObj
    };
  }

  /**
   * Atomic persistence through a serialized Promise queue.
   * @param {Map<string, PermissionModel>} [sitesMap]
   */
  async save(sitesMap) {
    if (sitesMap instanceof Map) {
      this.sites = sitesMap;
    }
    this._saveQueue = this._saveQueue.then(async () => {
      const targetFile = this._resolveFilePath();
      const tempFile = `${targetFile}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 6)}`;
      const payload = JSON.stringify(this.toJSON(), null, 2);

      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }

      await fs.promises.writeFile(tempFile, payload, 'utf8');

      // Atomic rename
      try {
        await fs.promises.rename(tempFile, targetFile);
      } catch (renameErr) {
        // Fallback for Windows EPERM / EBUSY
        try {
          await fs.promises.copyFile(tempFile, targetFile);
          await fs.promises.unlink(tempFile);
        } catch (copyErr) {
          console.error('[PermissionsStore] Atomic rename & fallback failed:', copyErr);
          throw copyErr;
        }
      }
    }).catch((err) => {
      console.error('[PermissionsStore] Error during save:', err);
    });

    return this._saveQueue;
  }
}

module.exports = PermissionsStore;
