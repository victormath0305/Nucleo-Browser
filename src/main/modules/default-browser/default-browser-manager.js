/**
 * Núcleo Browser - Default Browser Manager
 * Platform abstraction for detecting and requesting default browser status.
 * @module modules/default-browser/default-browser-manager
 */

const { EventEmitter } = require('events');
const WindowsDefaultBrowser = require('./windows-default-browser');

class DefaultBrowserManager extends EventEmitter {
  /**
   * @param {import('../settings/settings-manager')} [settingsManager]
   */
  constructor(settingsManager = null) {
    super();
    this.settingsManager = settingsManager;

    if (process.platform === 'win32') {
      this.handler = new WindowsDefaultBrowser();
    } else {
      // Fallback stub for other platforms
      this.handler = {
        isDefault: async () => ({ isDefault: false, http: false, https: false, details: 'Não suportado nesta plataforma' }),
        requestDefault: async () => ({ success: false, openedSettings: false, isDefault: false, message: 'Plataforma não suportada' })
      };
    }
  }

  /**
   * Checks whether Núcleo Browser is currently the default system browser.
   * Updates settings cache accordingly.
   * @returns {Promise<{ isDefault: boolean, http: boolean, https: boolean, details?: string }>}
   */
  async isDefault() {
    const result = await this.handler.isDefault();

    if (this.settingsManager) {
      await this.settingsManager.set('browser.default', result.isDefault);
    }

    return result;
  }

  /**
   * Requests the operating system to set Núcleo Browser as default.
   * @returns {Promise<{ success: boolean, openedSettings: boolean, isDefault: boolean, message: string }>}
   */
  async requestDefault() {
    const result = await this.handler.requestDefault();

    if (this.settingsManager && result.isDefault !== undefined) {
      await this.settingsManager.set('browser.default', result.isDefault);
    }

    this.emit('default-status-changed', result);
    return result;
  }
}

module.exports = DefaultBrowserManager;
