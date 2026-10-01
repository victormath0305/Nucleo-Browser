/**
 * Núcleo Browser - Workspace Data Model
 * Validates, serializes and encapsulates a single Workspace entity.
 * @module modules/workspaces/workspace-model
 */

const ALLOWED_COLORS = ['cyan', 'indigo', 'purple', 'green', 'amber', 'red', 'pink'];
const ALLOWED_ICONS = ['home', 'briefcase', 'book', 'code', 'gamepad', 'school', 'folder', 'star'];

class WorkspaceModel {
  /**
   * @param {Object} data
   * @param {string} data.id
   * @param {string} data.name
   * @param {string} [data.color='cyan']
   * @param {string} [data.icon='briefcase']
   * @param {number} [data.createdAt]
   * @param {number} [data.updatedAt]
   * @param {string|null} [data.activeTabId=null]
   * @param {Array<string>} [data.tabIds=[]]
   */
  constructor(data = {}) {
    this.id = String(data.id || '').trim() || `ws-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    this.name = WorkspaceModel.sanitizeName(data.name || 'Novo Workspace');
    this.color = ALLOWED_COLORS.includes(data.color) ? data.color : 'cyan';
    this.icon = ALLOWED_ICONS.includes(data.icon) ? data.icon : 'briefcase';
    this.createdAt = typeof data.createdAt === 'number' ? data.createdAt : Date.now();
    this.updatedAt = typeof data.updatedAt === 'number' ? data.updatedAt : this.createdAt;
    this.activeTabId = data.activeTabId || null;
    this.tabIds = Array.isArray(data.tabIds) ? [...new Set(data.tabIds.filter(Boolean))] : [];
  }

  /**
   * Sanitizes and validates a workspace name.
   * @param {string} name
   * @returns {string}
   */
  static sanitizeName(name) {
    if (typeof name !== 'string') return 'Workspace';
    const trimmed = name.trim().replace(/[\r\n\t]/g, ' ');
    if (!trimmed) return 'Workspace';
    return trimmed.slice(0, 40);
  }

  /**
   * Validates if a name is legally acceptable.
   * @param {string} name
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateName(name) {
    if (typeof name !== 'string' || !name.trim()) {
      return { valid: false, error: 'O nome do workspace não pode estar vazio.' };
    }
    const trimmed = name.trim();
    if (trimmed.length > 40) {
      return { valid: false, error: 'O nome do workspace deve ter no máximo 40 caracteres.' };
    }
    return { valid: true };
  }

  /**
   * Updates workspace properties safely.
   * @param {Object} updates
   */
  update(updates = {}) {
    if (updates.name !== undefined) {
      this.name = WorkspaceModel.sanitizeName(updates.name);
    }
    if (updates.color && ALLOWED_COLORS.includes(updates.color)) {
      this.color = updates.color;
    }
    if (updates.icon && ALLOWED_ICONS.includes(updates.icon)) {
      this.icon = updates.icon;
    }
    if (updates.activeTabId !== undefined) {
      this.activeTabId = updates.activeTabId;
    }
    if (Array.isArray(updates.tabIds)) {
      this.tabIds = [...new Set(updates.tabIds.filter(Boolean))];
    }
    this.updatedAt = Date.now();
  }

  addTabId(tabId) {
    if (tabId && !this.tabIds.includes(tabId)) {
      this.tabIds.push(tabId);
      this.updatedAt = Date.now();
    }
  }

  removeTabId(tabId) {
    const idx = this.tabIds.indexOf(tabId);
    if (idx !== -1) {
      this.tabIds.splice(idx, 1);
      if (this.activeTabId === tabId) {
        this.activeTabId = this.tabIds.length > 0 ? this.tabIds[0] : null;
      }
      this.updatedAt = Date.now();
    }
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      icon: this.icon,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      activeTabId: this.activeTabId,
      tabIds: [...this.tabIds]
    };
  }
}

module.exports = {
  WorkspaceModel,
  ALLOWED_COLORS,
  ALLOWED_ICONS
};
