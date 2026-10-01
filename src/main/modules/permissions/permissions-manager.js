/**
 * Núcleo Browser - Permissions Manager
 * Orchestrates permission requests, checks, decisions, and Electron Session integration.
 * @module modules/permissions/permissions-manager
 */

const { EventEmitter } = require('events');
const PermissionsStore = require('./permissions-store');
const {
  normalizeOrigin,
  isSecureContext,
  mapPermissionType,
  getPermissionMeta,
  SUPPORTED_PERMISSIONS,
  PERMISSION_STATES
} = require('./permissions-utils');

class PermissionsManager extends EventEmitter {
  /**
   * @param {object|PermissionsStore} [optionsOrStore={}]
   * @param {PermissionsStore} [optionsOrStore.store]
   * @param {object} [optionsOrStore.windowController]
   * @param {object} [optionsOrStore.tabManager]
   */
  constructor(optionsOrStore = {}) {
    super();
    if (optionsOrStore instanceof PermissionsStore || (optionsOrStore && typeof optionsOrStore.getSite === 'function')) {
      this.store = optionsOrStore;
      this.windowController = null;
      this.tabManager = null;
    } else {
      this.store = optionsOrStore.store || new PermissionsStore();
      this.windowController = optionsOrStore.windowController || null;
      this.tabManager = optionsOrStore.tabManager || null;
    }
    this.session = null;
    this.pendingRequests = new Map(); // Map<requestId, { requestId, origin, permission, meta, callback, timeoutId, webContents }>
    this.isAttached = false;
  }

  /**
   * Initializes the underlying permissions store.
   */
  async initialize() {
    await this.store.initialize();
  }

  /**
   * Attaches permission request and check handlers to the Electron session.
   *
   * @param {import('electron').Session} session
   * @param {object} [windowController]
   * @param {object} [tabManager]
   */
  attachToSession(session, windowController, tabManager) {
    if (!session) return;
    this.session = session;
    if (windowController) this.windowController = windowController;
    if (tabManager) this.tabManager = tabManager;

    // 1. Interactive Permission Request Handler
    this.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
      this._handlePermissionRequest(webContents, permission, callback, details);
    });

    // 2. Synchronous Permission Check Handler (e.g. navigator.permissions.query)
    this.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
      return this._handlePermissionCheck(webContents, permission, requestingOrigin, details);
    });

    // 3. Hardware Device Permission Handler (USB, Serial, Bluetooth, HID)
    if (typeof this.session.setDevicePermissionHandler === 'function') {
      this.session.setDevicePermissionHandler((details) => {
        return this._handleDevicePermissionCheck(details);
      });
    }

    this.isAttached = true;
    console.log('[PermissionsManager] Attached to Electron Session successfully.');
  }

  /**
   * Processes incoming permission requests from WebContents.
   *
   * @private
   */
  _handlePermissionRequest(webContents, rawPermission, callback, details) {
    const requestingUrl = details?.requestingUrl || (webContents ? webContents.getURL() : null);
    const origin = normalizeOrigin(requestingUrl);

    if (!origin) {
      console.warn(`[PermissionsManager] Rejected permission request with invalid origin: "${requestingUrl}"`);
      return callback(false);
    }

    // Trusted internal pages
    if (origin.startsWith('nucleo://')) {
      const allowedInternal = ['clipboard', 'notifications', 'fullscreen'];
      const mapped = mapPermissionType(rawPermission, details);
      const isAllowed = mapped.some((p) => allowedInternal.includes(p));
      return callback(isAllowed);
    }

    const canonicalPerms = mapPermissionType(rawPermission, details);
    if (!canonicalPerms || canonicalPerms.length === 0) {
      return callback(false);
    }

    const primaryPerm = canonicalPerms[0];

    // Check existing persisted state for this origin
    const siteModel = this.store.getSite(origin);
    const existingState = siteModel ? siteModel.get(primaryPerm) : 'ask';

    if (existingState === 'allow') {
      return callback(true);
    }

    if (existingState === 'deny') {
      return callback(false);
    }

    // State is 'ask' - present decision prompt to user
    const requestId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const meta = getPermissionMeta(primaryPerm);

    const timeoutId = setTimeout(() => {
      if (this.pendingRequests.has(requestId)) {
        console.log(`[PermissionsManager] Permission request ${requestId} timed out.`);
        this.pendingRequests.delete(requestId);
        callback(false);
      }
    }, 60000); // 60s timeout

    const requestData = {
      requestId,
      origin,
      permission: primaryPerm,
      meta,
      isSecure: isSecureContext(origin),
      createdAt: Date.now()
    };

    this.pendingRequests.set(requestId, {
      ...requestData,
      callback,
      timeoutId,
      webContents
    });

    // Notify listeners
    this.emit('permission-request', requestData);
    this.emit('permission-prompt', requestData);

    // Forward to renderer window if available
    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:request', requestData);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to send permission request to renderer:', err);
    }
  }

  /**
   * Resolves a pending permission request with the user's decision.
   *
   * @param {string} requestId
   * @param {'allow'|'deny'} decision
   * @param {boolean} [persist=true]
   * @returns {Promise<boolean>}
   */
  async resolveRequest(requestId, decision, persist = true) {
    const req = this.pendingRequests.get(requestId);
    if (!req) return false;

    clearTimeout(req.timeoutId);
    this.pendingRequests.delete(requestId);

    const granted = decision === 'allow';

    if (persist && PERMISSION_STATES.includes(decision)) {
      await this.setPermission(req.origin, req.permission, decision);
    }

    try {
      req.callback(granted);
    } catch (cbErr) {
      console.error('[PermissionsManager] Callback error during request resolution:', cbErr);
    }

    const payload = {
      requestId,
      origin: req.origin,
      permission: req.permission,
      decision,
      granted
    };

    this.emit('permission-resolved', payload);

    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:resolved', payload);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to broadcast permission resolved:', err);
    }

    return true;
  }

  /**
   * Synchronous permission checks (query API).
   *
   * @private
   */
  _handlePermissionCheck(webContents, rawPermission, requestingOrigin, details) {
    const effectiveOrigin = normalizeOrigin(requestingOrigin || (webContents ? webContents.getURL() : null));
    if (!effectiveOrigin) return false;

    if (effectiveOrigin.startsWith('nucleo://')) {
      const allowedInternal = ['clipboard', 'notifications', 'fullscreen'];
      const mapped = mapPermissionType(rawPermission, details);
      return mapped.some((p) => allowedInternal.includes(p));
    }

    const canonicalPerms = mapPermissionType(rawPermission, details);
    if (!canonicalPerms || canonicalPerms.length === 0) return false;

    const primaryPerm = canonicalPerms[0];
    const siteModel = this.store.getSite(effectiveOrigin);
    return siteModel ? siteModel.get(primaryPerm) === 'allow' : false;
  }

  /**
   * Hardware device permission checks (USB, Serial, Bluetooth).
   *
   * @private
   */
  _handleDevicePermissionCheck(details) {
    const origin = normalizeOrigin(details?.origin);
    if (!origin) return false;

    const rawDeviceType = details?.deviceType?.toLowerCase() || '';
    const perm = rawDeviceType === 'hid' ? 'usb' : rawDeviceType;

    if (!SUPPORTED_PERMISSIONS.includes(perm)) return false;

    const siteModel = this.store.getSite(origin);
    return siteModel ? siteModel.get(perm) === 'allow' : false;
  }

  /**
   * Returns a list of all sites with permission metadata.
   *
   * @returns {Array<object>}
   */
  listPermissions() {
    return this.store.getAllSites().map((site) => ({
      origin: site.origin,
      permissions: { ...site.permissions },
      isSecure: isSecureContext(site.origin),
      createdAt: site.createdAt,
      updatedAt: site.updatedAt
    }));
  }

  /**
   * Returns permissions configured for a specific origin.
   *
   * @param {string} rawOrigin
   * @returns {object}
   */
  getPermissionsForOrigin(rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return { origin: '', permissions: {}, isSecure: false };

    const site = this.store.getSite(origin);
    const perms = site ? { ...site.permissions } : {};
    const result = {
      origin,
      permissions: perms,
      isSecure: isSecureContext(origin),
      createdAt: site ? site.createdAt : null,
      updatedAt: site ? site.updatedAt : null
    };

    for (const perm of SUPPORTED_PERMISSIONS) {
      result[perm] = site ? site.get(perm) : 'ask';
    }

    return result;
  }

  /**
   * Sets a specific permission for an origin.
   *
   * @param {string} rawOrigin
   * @param {string} permission
   * @param {'allow'|'deny'|'ask'} state
   */
  async setPermission(rawOrigin, permission, state) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) throw new Error(`[PermissionsManager] Invalid origin: "${rawOrigin}"`);

    await this.store.setSitePermission(origin, permission, state);

    const eventData = { origin, permission, state };
    this.emit('permission-changed', eventData);

    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:changed', eventData);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to emit permissions changed to renderer:', err);
    }
  }

  /**
   * Resets a specific permission for an origin back to 'ask'.
   *
   * @param {string} rawOrigin
   * @param {string} permission
   */
  async resetPermission(rawOrigin, permission) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return;

    await this.store.resetSitePermission(origin, permission);

    const eventData = { origin, permission, state: 'ask' };
    this.emit('permission-changed', eventData);

    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:changed', eventData);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to emit permissions changed to renderer:', err);
    }
  }

  /**
   * Resets all permissions for a specific origin.
   *
   * @param {string} rawOrigin
   */
  async resetOrigin(rawOrigin) {
    const origin = normalizeOrigin(rawOrigin);
    if (!origin) return;

    await this.store.resetSite(origin);

    const eventData = { origin, permissions: {}, resetAll: true };
    this.emit('permission-changed', eventData);

    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:changed', eventData);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to emit permissions changed to renderer:', err);
    }
  }

  /**
   * Resets all permissions for all sites across the browser.
   */
  async resetAll() {
    await this.store.resetAll();

    const eventData = { allCleared: true };
    this.emit('permission-changed', eventData);

    try {
      if (this.windowController && typeof this.windowController.sendToRenderer === 'function') {
        this.windowController.sendToRenderer('nucleo:permissions:changed', eventData);
      }
    } catch (err) {
      console.error('[PermissionsManager] Failed to emit permissions changed to renderer:', err);
    }
  }
}

module.exports = PermissionsManager;
