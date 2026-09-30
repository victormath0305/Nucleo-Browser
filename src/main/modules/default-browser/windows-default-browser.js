/**
 * Núcleo Browser - Windows Default Browser Handler
 * Inspects and requests default browser registration using official Windows APIs.
 * @module modules/default-browser/windows-default-browser
 */

const { app, shell } = require('electron');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

class WindowsDefaultBrowser {
  constructor() {
    this.protocols = ['http', 'https'];
  }

  /**
   * Checks whether Núcleo Browser is currently the default handler for HTTP and HTTPS.
   * Uses both Electron native check and Windows registry inspection.
   * @returns {Promise<{ isDefault: boolean, http: boolean, https: boolean, details?: string }>}
   */
  async isDefault() {
    if (!app || typeof app.isDefaultProtocolClient !== 'function') {
      return { isDefault: false, http: false, https: false, details: 'Electron app API unavailable' };
    }

    try {
      const httpDefault = app.isDefaultProtocolClient('http');
      const httpsDefault = app.isDefaultProtocolClient('https');

      // Also verify via Windows registry for UserChoice if on Windows
      let registryProgId = null;
      if (process.platform === 'win32') {
        try {
          const { stdout } = await execAsync(
            'reg query "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice" /v ProgId',
            { timeout: 2000 }
          );
          const match = stdout.match(/ProgId\s+REG_SZ\s+(\S+)/i);
          if (match && match[1]) {
            registryProgId = match[1];
          }
        } catch {}
      }

      const isCurrentApp = httpDefault && httpsDefault;

      return {
        isDefault: isCurrentApp,
        http: httpDefault,
        https: httpsDefault,
        currentProgId: registryProgId,
        details: isCurrentApp
          ? 'Núcleo Browser é o navegador padrão do Windows'
          : 'Núcleo Browser não é o navegador padrão do Windows'
      };
    } catch (err) {
      console.warn('[WindowsDefaultBrowser] Error checking default status:', err.message);
      return { isDefault: false, http: false, https: false, error: err.message };
    }
  }

  /**
   * Requests Windows to register Núcleo Browser as the default browser.
   * Registers protocols and launches the official Windows Default Apps Settings page
   * as required by modern Windows (10/11) security architecture.
   * @returns {Promise<{ success: boolean, openedSettings: boolean, isDefault: boolean, message: string }>}
   */
  async requestDefault() {
    if (!app) {
      return { success: false, openedSettings: false, isDefault: false, message: 'App indisponível' };
    }

    try {
      // 1. Register protocol clients with Windows
      let regHttp = false;
      let regHttps = false;

      if (typeof app.setAsDefaultProtocolClient === 'function') {
        regHttp = app.setAsDefaultProtocolClient('http');
        regHttps = app.setAsDefaultProtocolClient('https');
      }

      // 2. On Windows 10 and 11, UserChoice hash requires user confirmation in Windows Settings
      let openedSettings = false;
      if (process.platform === 'win32' && shell && typeof shell.openExternal === 'function') {
        try {
          // Official URI for Windows Default Apps settings page
          await shell.openExternal('ms-settings:defaultapps');
          openedSettings = true;
        } catch (err) {
          console.warn('[WindowsDefaultBrowser] Could not open ms-settings:defaultapps:', err.message);
        }
      }

      // 3. Re-verify immediate state
      const check = await this.isDefault();

      return {
        success: regHttp || regHttps || openedSettings,
        openedSettings,
        isDefault: check.isDefault,
        message: check.isDefault
          ? 'Núcleo Browser agora é o navegador padrão.'
          : 'As configurações de aplicativos padrão do Windows foram abertas. Selecione o Núcleo Browser como navegador padrão.'
      };
    } catch (err) {
      console.error('[WindowsDefaultBrowser] Error requesting default browser:', err);
      return {
        success: false,
        openedSettings: false,
        isDefault: false,
        message: `Falha ao solicitar navegador padrão: ${err.message}`
      };
    }
  }
}

module.exports = WindowsDefaultBrowser;
