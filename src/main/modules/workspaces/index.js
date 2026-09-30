/**
 * Núcleo Browser - Workspaces Subsystem
 * Prepared for future milestone: Tab isolation, separate profiles/partitions, task workspaces
 * @module modules/workspaces
 */

class WorkspaceManager {
  constructor(tabManager) {
    this.tabManager = tabManager;
    this.workspaces = new Map();
    this.activeWorkspaceId = 'default';
  }

  async initialize() {
    // Future: Load workspaces definition
  }

  createWorkspace(name, icon) {
    throw new Error('Workspaces scheduled for future milestone');
  }

  switchWorkspace(workspaceId) {
    throw new Error('Workspaces scheduled for future milestone');
  }
}

module.exports = WorkspaceManager;
