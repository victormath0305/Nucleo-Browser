/**
 * Núcleo Browser - Workspaces Subsystem
 * Workspace management, tab context isolation, and persistence.
 * @module modules/workspaces
 */

const { WorkspaceModel, ALLOWED_COLORS, ALLOWED_ICONS } = require('./workspace-model');
const WorkspaceStore = require('./workspace-store');
const WorkspaceManager = require('./workspace-manager');

module.exports = {
  WorkspaceModel,
  WorkspaceStore,
  WorkspaceManager,
  ALLOWED_COLORS,
  ALLOWED_ICONS
};
