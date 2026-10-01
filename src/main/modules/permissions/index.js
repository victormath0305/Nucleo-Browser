/**
 * Núcleo Browser - Permissions Subsystem
 * Entry point exporting PermissionsManager, PermissionsStore, PermissionModel, and Utils.
 * @module modules/permissions
 */

const PermissionsManager = require('./permissions-manager');
const PermissionsStore = require('./permissions-store');
const PermissionModel = require('./permissions-model');
const PermissionsUtils = require('./permissions-utils');

module.exports = {
  PermissionsManager,
  PermissionsStore,
  PermissionModel,
  PermissionsUtils
};
