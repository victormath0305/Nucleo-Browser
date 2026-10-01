/**
 * Núcleo Browser - Permission Model
 * Encapsulates the permissions associated with a specific origin.
 * @module modules/permissions/permissions-model
 */

const { normalizeOrigin, PERMISSION_STATES, SUPPORTED_PERMISSIONS } = require('./permissions-utils');

class PermissionModel {
  /**
   * @param {string} rawOrigin - Web origin (scheme://hostname[:port])
   * @param {Record<string, 'allow'|'deny'|'ask'>} [permissions={}]
   * @param {object} [metadata={}]
   */
  constructor(rawOrigin, permissions = {}, metadata = {}) {
    const normalized = normalizeOrigin(rawOrigin);
    if (!normalized) {
      throw new Error(`[PermissionModel] Invalid origin: "${rawOrigin}". Scheme and hostname are required.`);
    }

    this.origin = normalized;
    this.permissions = {};
    this.createdAt = metadata.createdAt || Date.now();
    this.updatedAt = metadata.updatedAt || Date.now();

    if (permissions && typeof permissions === 'object') {
      for (const [perm, state] of Object.entries(permissions)) {
        if (PERMISSION_STATES.includes(state)) {
          this.permissions[perm] = state;
        }
      }
    }
  }

  /**
   * Retrieves the permission state for a given permission type.
   * Defaults to 'ask' if not explicitly configured.
   *
   * @param {string} permission
   * @returns {'allow'|'deny'|'ask'}
   */
  get(permission) {
    if (!permission || typeof permission !== 'string') return 'ask';
    return this.permissions[permission] || 'ask';
  }

  /**
   * Sets the permission state for a given permission type.
   *
   * @param {string} permission
   * @param {'allow'|'deny'|'ask'} state
   */
  set(permission, state) {
    if (!permission || typeof permission !== 'string') {
      throw new Error('[PermissionModel] Permission name must be a non-empty string.');
    }

    if (!PERMISSION_STATES.includes(state)) {
      throw new Error(`[PermissionModel] Invalid state: "${state}". Allowed: ${PERMISSION_STATES.join(', ')}`);
    }

    if (state === 'ask') {
      // 'ask' represents the default state; remove override to conserve storage
      delete this.permissions[permission];
    } else {
      this.permissions[permission] = state;
    }

    this.updatedAt = Date.now();
  }

  /**
   * Resets a single permission back to default 'ask'.
   *
   * @param {string} permission
   */
  reset(permission) {
    if (this.permissions[permission]) {
      delete this.permissions[permission];
      this.updatedAt = Date.now();
    }
  }

  /**
   * Clears all permission overrides for this origin.
   */
  resetAll() {
    this.permissions = {};
    this.updatedAt = Date.now();
  }

  /**
   * Returns true if there is at least one active override (allow or deny).
   *
   * @returns {boolean}
   */
  hasOverrides() {
    return Object.keys(this.permissions).length > 0;
  }

  /**
   * Serializes the model to a plain JSON object.
   *
   * @returns {object}
   */
  toJSON() {
    return {
      origin: this.origin,
      permissions: { ...this.permissions },
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Hydrates a PermissionModel from JSON data.
   *
   * @param {object} json
   * @returns {PermissionModel}
   */
  static fromJSON(json) {
    if (!json || typeof json !== 'object' || !json.origin) {
      throw new Error('[PermissionModel] Invalid JSON input for PermissionModel.');
    }

    return new PermissionModel(json.origin, json.permissions || {}, {
      createdAt: json.createdAt,
      updatedAt: json.updatedAt
    });
  }
}

module.exports = PermissionModel;
