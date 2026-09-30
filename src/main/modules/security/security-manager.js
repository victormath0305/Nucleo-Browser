/**
 * Núcleo Browser - Security Manager
 * @module modules/security/security-manager
 */

const AppConfig = require('../../config/app-config');

class SecurityManager {
  constructor(sessionInstance) {
    this.session = sessionInstance;
  }

  applyPolicies() {
    if (!this.session) return;

    // 1. Strict Permission Handling
    this.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
      const url = details.requestingUrl;
      console.log(`[SecurityManager] Permission requested: "${permission}" by ${url}`);

      // In v0.1, block dangerous device permissions by default
      if (AppConfig.security.defaultPermissionsBlocked.includes(permission)) {
        return callback(false);
      }

      // Allow basic harmless permissions or deny by default
      callback(false);
    });

    this.session.setPermissionCheckHandler((webContents, permission, requestingOrigin) => {
      if (AppConfig.security.defaultPermissionsBlocked.includes(permission)) {
        return false;
      }
      return false;
    });
  }

  /**
   * Secures a specific WebContents instance against malicious navigations and escape attempts.
   * @param {import('electron').WebContents} webContents
   */
  secureWebContents(webContents) {
    // Prevent creation of unmanaged native windows/popups
    webContents.setWindowOpenHandler((details) => {
      const url = details.url;
      try {
        const parsed = new URL(url);
        if (!AppConfig.security.allowedProtocols.includes(parsed.protocol)) {
          console.warn(`[SecurityManager] Blocked popup with unsafe protocol: ${url}`);
          return { action: 'deny' };
        }
      } catch {
        return { action: 'deny' };
      }

      // Allow navigation in same view or prepare for tab opening
      webContents.loadURL(url);
      return { action: 'deny' };
    });

    // Guard against will-navigate to dangerous schemes
    webContents.on('will-navigate', (event, navigationUrl) => {
      try {
        const parsed = new URL(navigationUrl);
        if (!AppConfig.security.allowedProtocols.includes(parsed.protocol)) {
          event.preventDefault();
          console.warn(`[SecurityManager] Blocked navigation to unsafe scheme: ${navigationUrl}`);
        }
      } catch {
        event.preventDefault();
      }
    });
  }
}

module.exports = SecurityManager;
