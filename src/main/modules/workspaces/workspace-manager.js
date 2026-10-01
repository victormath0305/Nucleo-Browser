/**
 * Núcleo Browser - Workspace Manager
 * Orchestrates Workspaces lifecycle, tab ownership, switching, and ordering.
 * @module modules/workspaces/workspace-manager
 */

const { EventEmitter } = require('events');
const { WorkspaceModel, ALLOWED_COLORS, ALLOWED_ICONS } = require('./workspace-model');
const WorkspaceStore = require('./workspace-store');

class WorkspaceManager extends EventEmitter {
  /**
   * @param {WorkspaceStore} [store]
   */
  constructor(store = null) {
    super();
    this.store = store || new WorkspaceStore();
    this.workspaces = []; // Array of WorkspaceModel to preserve order
    this.activeWorkspaceId = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    const data = await this.store.load();
    this.workspaces = (data.workspaces || []).map((wsData) => new WorkspaceModel(wsData));

    // Ensure at least one default workspace exists
    if (this.workspaces.length === 0) {
      const defaultWs = new WorkspaceModel({
        id: 'workspace-pessoal',
        name: 'Pessoal',
        color: 'cyan',
        icon: 'home'
      });
      this.workspaces.push(defaultWs);
    }

    // Set active workspace
    const targetActive = data.activeWorkspaceId;
    const exists = this.workspaces.find((w) => w.id === targetActive);
    this.activeWorkspaceId = exists ? exists.id : this.workspaces[0].id;

    this.isInitialized = true;
    return this.getAllWorkspaces();
  }

  /**
   * Returns list of plain workspace representations with active state and tab counts.
   * @returns {Array<Object>}
   */
  getAllWorkspaces() {
    return this.workspaces.map((ws) => ({
      ...ws.toJSON(),
      isActive: ws.id === this.activeWorkspaceId,
      tabCount: ws.tabIds.length
    }));
  }

  /**
   * Gets the active workspace instance.
   * @returns {WorkspaceModel}
   */
  getActiveWorkspace() {
    const found = this.workspaces.find((w) => w.id === this.activeWorkspaceId);
    return found || this.workspaces[0];
  }

  /**
   * Gets a workspace by ID.
   * @param {string} id
   * @returns {WorkspaceModel|null}
   */
  getWorkspace(id) {
    return this.workspaces.find((w) => w.id === id) || null;
  }

  /**
   * Creates a new workspace.
   * @param {Object} options
   * @param {string} options.name
   * @param {string} [options.color='cyan']
   * @param {string} [options.icon='briefcase']
   * @returns {WorkspaceModel}
   */
  async createWorkspace({ name, color = 'cyan', icon = 'briefcase' } = {}) {
    const valResult = WorkspaceModel.validateName(name || 'Novo Workspace');
    if (!valResult.valid) {
      throw new Error(valResult.error);
    }

    const rand = Math.random().toString(36).slice(2, 6);
    const id = `ws-${Date.now()}-${rand}`;

    const newWs = new WorkspaceModel({
      id,
      name,
      color,
      icon
    });

    this.workspaces.push(newWs);
    this.activeWorkspaceId = newWs.id;
    await this._persist();

    this.emit('workspace-created', newWs.toJSON());
    this.emit('workspace-activated', newWs.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return newWs;
  }

  /**
   * Renames a workspace.
   * @param {string} id
   * @param {string} newName
   */
  async renameWorkspace(id, newName) {
    const ws = this.getWorkspace(id);
    if (!ws) {
      throw new Error(`Workspace ${id} não encontrado.`);
    }

    const valResult = WorkspaceModel.validateName(newName);
    if (!valResult.valid) {
      throw new Error(valResult.error);
    }

    ws.update({ name: newName });
    await this._persist();

    this.emit('workspace-updated', ws.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return ws.toJSON();
  }

  /**
   * Changes a workspace accent color.
   * @param {string} id
   * @param {string} color
   */
  async setColor(id, color) {
    const ws = this.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} não encontrado.`);
    if (!ALLOWED_COLORS.includes(color)) throw new Error(`Cor inválida: ${color}`);

    ws.update({ color });
    await this._persist();

    this.emit('workspace-updated', ws.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return ws.toJSON();
  }

  /**
   * Changes a workspace icon.
   * @param {string} id
   * @param {string} icon
   */
  async setIcon(id, icon) {
    const ws = this.getWorkspace(id);
    if (!ws) throw new Error(`Workspace ${id} não encontrado.`);
    if (!ALLOWED_ICONS.includes(icon)) throw new Error(`Ícone inválido: ${icon}`);

    ws.update({ icon });
    await this._persist();

    this.emit('workspace-updated', ws.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return ws.toJSON();
  }

  /**
   * Switches the active workspace.
   * @param {string} targetId
   * @returns {WorkspaceModel}
   */
  async switchWorkspace(targetId) {
    const targetWs = this.getWorkspace(targetId);
    if (!targetWs) {
      throw new Error(`Workspace ${targetId} não existe.`);
    }

    if (this.activeWorkspaceId === targetId) {
      return targetWs;
    }

    const previousId = this.activeWorkspaceId;
    this.activeWorkspaceId = targetId;

    await this._persist();

    this.emit('workspace-switched', {
      previousId,
      activeId: targetId,
      workspace: targetWs.toJSON()
    });
    this.emit('workspace-activated', targetWs.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return targetWs;
  }

  /**
   * Deletes a workspace with safe handling of its tabs.
   * @param {string} id - Workspace to delete
   * @param {Object} [options]
   * @param {string} [options.targetWorkspaceId] - Workspace to transfer tabs to
   * @returns {{ success: boolean, deletedId: string }}
   */
  async deleteWorkspace(id, options = {}) {
    if (this.workspaces.length <= 1) {
      throw new Error('Não é possível excluir o último workspace.');
    }

    const wsIndex = this.workspaces.findIndex((w) => w.id === id);
    if (wsIndex === -1) {
      throw new Error(`Workspace ${id} não encontrado.`);
    }

    const wsToDelete = this.workspaces[wsIndex];
    let nextActiveId = this.activeWorkspaceId;

    // If active workspace is being deleted, select fallback
    if (this.activeWorkspaceId === id) {
      const fallback = options.targetWorkspaceId
        ? this.getWorkspace(options.targetWorkspaceId)
        : this.workspaces.find((w) => w.id !== id);
      nextActiveId = fallback ? fallback.id : this.workspaces[0].id;
    }

    // Handle transferring tabs to target workspace if requested
    if (options.targetWorkspaceId && wsToDelete.tabIds.length > 0) {
      const targetWs = this.getWorkspace(options.targetWorkspaceId);
      if (targetWs && targetWs.id !== id) {
        for (const tabId of wsToDelete.tabIds) {
          targetWs.addTabId(tabId);
        }
      }
    }

    this.workspaces.splice(wsIndex, 1);
    this.activeWorkspaceId = nextActiveId;

    await this._persist();

    this.emit('workspace-deleted', {
      id,
      tabIds: wsToDelete.tabIds,
      targetWorkspaceId: options.targetWorkspaceId || null
    });
    this.emit('workspace-activated', this.getActiveWorkspace().toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return { success: true, deletedId: id };
  }

  /**
   * Duplicates a workspace structure and metadata.
   * @param {string} id
   * @returns {WorkspaceModel}
   */
  async duplicateWorkspace(id) {
    const sourceWs = this.getWorkspace(id);
    if (!sourceWs) {
      throw new Error(`Workspace ${id} não encontrado.`);
    }

    const rand = Math.random().toString(36).slice(2, 6);
    const newId = `ws-${Date.now()}-${rand}`;
    const newName = `${sourceWs.name} (Cópia)`.slice(0, 40);

    const dupWs = new WorkspaceModel({
      id: newId,
      name: newName,
      color: sourceWs.color,
      icon: sourceWs.icon
    });

    this.workspaces.push(dupWs);
    await this._persist();

    this.emit('workspace-created', dupWs.toJSON());
    this.emit('workspaces-updated', this.getAllWorkspaces());

    return dupWs;
  }

  /**
   * Reorders workspaces by providing array of IDs in new order.
   * @param {Array<string>} orderedIds
   */
  async reorderWorkspaces(orderedIds) {
    if (!Array.isArray(orderedIds)) return;

    const map = new Map(this.workspaces.map((w) => [w.id, w]));
    const newWorkspaces = [];

    for (const id of orderedIds) {
      if (map.has(id)) {
        newWorkspaces.push(map.get(id));
        map.delete(id);
      }
    }

    // Append any missing workspaces
    for (const remaining of map.values()) {
      newWorkspaces.push(remaining);
    }

    this.workspaces = newWorkspaces;
    await this._persist();
    this.emit('workspaces-updated', this.getAllWorkspaces());
  }

  /**
   * Moves a workspace up in list order.
   * @param {string} id
   */
  async moveWorkspaceUp(id) {
    const idx = this.workspaces.findIndex((w) => w.id === id);
    if (idx > 0) {
      const temp = this.workspaces[idx - 1];
      this.workspaces[idx - 1] = this.workspaces[idx];
      this.workspaces[idx] = temp;
      await this._persist();
      this.emit('workspaces-updated', this.getAllWorkspaces());
    }
  }

  /**
   * Moves a workspace down in list order.
   * @param {string} id
   */
  async moveWorkspaceDown(id) {
    const idx = this.workspaces.findIndex((w) => w.id === id);
    if (idx !== -1 && idx < this.workspaces.length - 1) {
      const temp = this.workspaces[idx + 1];
      this.workspaces[idx + 1] = this.workspaces[idx];
      this.workspaces[idx] = temp;
      await this._persist();
      this.emit('workspaces-updated', this.getAllWorkspaces());
    }
  }

  /**
   * Cycles to the next workspace.
   */
  async switchNextWorkspace() {
    if (this.workspaces.length <= 1) return;
    const currentIndex = this.workspaces.findIndex((w) => w.id === this.activeWorkspaceId);
    const nextIndex = (currentIndex + 1) % this.workspaces.length;
    return this.switchWorkspace(this.workspaces[nextIndex].id);
  }

  /**
   * Cycles to the previous workspace.
   */
  async switchPreviousWorkspace() {
    if (this.workspaces.length <= 1) return;
    const currentIndex = this.workspaces.findIndex((w) => w.id === this.activeWorkspaceId);
    const prevIndex = (currentIndex - 1 + this.workspaces.length) % this.workspaces.length;
    return this.switchWorkspace(this.workspaces[prevIndex].id);
  }

  /**
   * Switches to workspace by 0-based index.
   * @param {number} index
   */
  async switchToIndex(index) {
    if (index >= 0 && index < this.workspaces.length) {
      return this.switchWorkspace(this.workspaces[index].id);
    }
  }

  /**
   * Assigns a tab to a workspace.
   * @param {string} workspaceId
   * @param {string} tabId
   */
  addTabToWorkspace(workspaceId, tabId) {
    const ws = this.getWorkspace(workspaceId);
    if (ws) {
      ws.addTabId(tabId);
      this._persist();
    }
  }

  /**
   * Removes a tab from a workspace.
   * @param {string} workspaceId
   * @param {string} tabId
   */
  removeTabFromWorkspace(workspaceId, tabId) {
    const ws = this.getWorkspace(workspaceId);
    if (ws) {
      ws.removeTabId(tabId);
      this._persist();
    }
  }

  /**
   * Sets the active tab ID for a specific workspace.
   * @param {string} workspaceId
   * @param {string} tabId
   */
  setActiveTabForWorkspace(workspaceId, tabId) {
    const ws = this.getWorkspace(workspaceId);
    if (ws) {
      ws.update({ activeTabId: tabId });
      this._persist();
    }
  }

  /**
   * Alias for setActiveTabForWorkspace
   */
  setActiveTab(workspaceId, tabId) {
    return this.setActiveTabForWorkspace(workspaceId, tabId);
  }

  /**
   * Finds the workspace that owns the given tabId.
   * @param {string} tabId
   * @returns {WorkspaceModel|null}
   */
  findWorkspaceByTabId(tabId) {
    return this.workspaces.find((w) => w.tabIds.includes(tabId)) || null;
  }

  /**
   * Moves a tab from its current workspace to target workspace.
   * @param {string} tabId
   * @param {string} targetWorkspaceId
   */
  moveTab(tabId, targetWorkspaceId) {
    const targetWs = this.getWorkspace(targetWorkspaceId);
    if (!targetWs) {
      throw new Error(`Workspace destino ${targetWorkspaceId} não encontrado.`);
    }

    const currentWs = this.findWorkspaceByTabId(tabId);
    if (currentWs) {
      if (currentWs.id === targetWorkspaceId) return;
      currentWs.removeTabId(tabId);
    }

    targetWs.addTabId(tabId);
    this._persist();

    this.emit('tab-moved', {
      tabId,
      fromWorkspaceId: currentWs ? currentWs.id : null,
      toWorkspaceId: targetWorkspaceId
    });
    return { success: true };
  }

  // Aliases for convenience
  getAll() {
    return this.getAllWorkspaces();
  }

  get(id) {
    return this.getWorkspace(id);
  }

  create(options) {
    return this.createWorkspace(options);
  }

  rename(id, name) {
    return this.renameWorkspace(id, name);
  }

  delete(id, options) {
    return this.deleteWorkspace(id, options);
  }

  duplicate(id) {
    return this.duplicateWorkspace(id);
  }

  moveUp(id) {
    return this.moveWorkspaceUp(id);
  }

  moveDown(id) {
    return this.moveWorkspaceDown(id);
  }

  async _persist() {
    this.store.setData({
      activeWorkspaceId: this.activeWorkspaceId,
      workspaces: this.workspaces.map((w) => w.toJSON())
    });
    await this.store.save();
  }
}

module.exports = WorkspaceManager;
