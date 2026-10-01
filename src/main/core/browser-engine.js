/**
 * Núcleo Browser - Core Engine Manager
 * @module core/browser-engine
 */

const { session, app, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const AppConfig = require('../config/app-config');
const SecurityManager = require('../modules/security/security-manager');

// Register custom privileged scheme before app.whenReady()
try {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'nucleo',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        bypassCSP: true
      }
    }
  ]);
} catch (err) {
  // If already registered or called in sub-process
}

class BrowserEngine {
  constructor() {
    this.session = null;
    this.securityManager = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the Chromium engine, session policies, and internal protocol.
   */
  async initialize() {
    if (this.isInitialized) return;

    this._setupProtocolHandler();

    // Use default persisted session
    this.session = session.defaultSession;

    // Initialize Security Manager
    this.securityManager = new SecurityManager(this.session);
    this.securityManager.applyPolicies();

    // Configure modern Chromium User-Agent to ensure 100% web compatibility
    const defaultUserAgent = this.session.getUserAgent();
    // Remove Electron token from user agent for public web requests so sites don't serve stripped down versions
    const cleanedUserAgent = defaultUserAgent.replace(/Electron\/[0-9\.]+\s/, '');
    this.session.setUserAgent(cleanedUserAgent);

    // Optimize cache and networking
    this.session.setSpellCheckerEnabled(true);

    this.isInitialized = true;
    console.log(`[BrowserEngine] Initialized with Chromium ${process.versions.chrome}`);
  }

  _setupProtocolHandler() {
    try {
      protocol.handle('nucleo', (request) => {
        try {
          const url = new URL(request.url);
          const host = url.host.toLowerCase();
          const pathname = url.pathname;

          let targetPath = null;

          if (pathname.includes('/assets/icons/')) {
            const iconName = path.basename(pathname);
            targetPath = path.join(AppConfig.paths.icons, iconName);
          } else if (pathname.startsWith('/styles/')) {
            targetPath = path.join(path.dirname(AppConfig.paths.rendererHtml), pathname);
          } else if (pathname.startsWith('/scripts/')) {
            targetPath = path.join(path.dirname(AppConfig.paths.rendererHtml), pathname);
          } else if (host === 'bookmarks' || host === 'favoritos') {
            targetPath = AppConfig.paths.bookmarksHtml;
          } else if (host === 'history' || host === 'historico') {
            targetPath = AppConfig.paths.historyHtml;
          } else if (host === 'shield' || host === 'protecao') {
            targetPath = AppConfig.paths.shieldHtml;
          } else if (host === 'shield-test') {
            targetPath = AppConfig.paths.shieldTestHtml;
          } else if (host === 'extensions' || host === 'extensoes') {
            targetPath = AppConfig.paths.extensionsHtml;
          } else if (host === 'extension-test') {
            targetPath = AppConfig.paths.extensionTestHtml;
          } else if (host === 'settings' || host === 'configuracoes') {
            targetPath = AppConfig.paths.settingsHtml;
          } else if (host === 'downloads' || host === 'baixados') {
            targetPath = AppConfig.paths.downloadsHtml;
          } else if (host === 'privacy' || host === 'privacidade' || host === 'permissions' || host === 'permissoes') {
            targetPath = AppConfig.paths.privacyHtml;
          } else if (host === 'newtab') {
            targetPath = AppConfig.paths.newTabHtml;
          } else {
            targetPath = AppConfig.paths.newTabHtml;
          }

          if (targetPath && fs.existsSync(targetPath)) {
            return net.fetch(pathToFileURL(targetPath).toString());
          }

          return new Response('Not Found', { status: 404 });
        } catch (err) {
          console.error('[Núcleo Protocol] Error handling request:', err);
          return new Response('Internal Server Error', { status: 500 });
        }
      });
    } catch (err) {
      console.warn('[Núcleo Protocol] Handler setup warning:', err.message);
    }
  }

  getSession() {
    return this.session || session.defaultSession;
  }

  getSecurityManager() {
    return this.securityManager;
  }
}

module.exports = BrowserEngine;
