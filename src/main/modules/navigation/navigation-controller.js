/**
 * Núcleo Browser - Navigation Controller
 * @module modules/navigation/navigation-controller
 */

const { pathToFileURL } = require('url');
const AppConfig = require('../../config/app-config');

class NavigationController {
  constructor(tabManager, searchProvider = null) {
    this.tabManager = tabManager;
    this.searchProvider = searchProvider;
  }

  setSearchProvider(searchProvider) {
    this.searchProvider = searchProvider;
  }

  /**
   * Returns the fully resolved local URL for the new tab page.
   * @returns {string}
   */
  getNewTabUrl() {
    return 'nucleo://newtab';
  }

  /**
   * Resolves a user input string into a valid navigatable URL.
   * Handles URLs, localhost, IP addresses, domains with TLDs, and search queries.
   * @param {string} input - User query or URL
   * @returns {string} Fully qualified URL
   */
  resolveInputToUrl(input) {
    if (!input || typeof input !== 'string') {
      return this.getNewTabUrl();
    }

    const trimmed = input.trim();
    if (trimmed.length === 0 || trimmed === 'nucleo://newtab' || trimmed === 'about:blank') {
      return this.getNewTabUrl();
    }

    // Block dangerous pseudo-protocols
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      console.warn('[NavigationController] Blocked dangerous protocol input:', trimmed.slice(0, 30));
      return 'about:blank';
    }

    if (trimmed === 'nucleo://bookmarks' || trimmed === 'nucleo://favoritos') {
      return 'nucleo://bookmarks';
    }

    if (trimmed === 'nucleo://history' || trimmed === 'nucleo://historico') {
      return 'nucleo://history';
    }

    if (trimmed === 'nucleo://shield' || trimmed === 'nucleo://protecao') {
      return 'nucleo://shield';
    }

    if (trimmed === 'nucleo://shield-test') {
      return 'nucleo://shield-test';
    }

    if (trimmed === 'nucleo://extensions' || trimmed === 'nucleo://extensoes') {
      return 'nucleo://extensions';
    }

    if (trimmed === 'nucleo://extension-test') {
      return 'nucleo://extension-test';
    }

    if (trimmed === 'nucleo://settings' || trimmed === 'nucleo://configuracoes') {
      return 'nucleo://settings';
    }

    // Explicit nucleo:// protocol
    if (/^nucleo:\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Already explicit protocol
    if (/^(https?|ftp|file):\/\//i.test(trimmed)) {
      return trimmed;
    }

    // Localhost with optional port
    if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return `http://${trimmed}`;
    }

    // IPv4 address with optional port
    if (/^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return `http://${trimmed}`;
    }

    // Standard domain with valid TLD (no spaces, contains dot with >=2 letter TLD)
    const domainWithTldRegex = /^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
    if (domainWithTldRegex.test(trimmed)) {
      return `https://${trimmed}`;
    }

    // Otherwise, treat as a search query via SearchProvider
    if (this.searchProvider && typeof this.searchProvider.buildSearchUrl === 'function') {
      return this.searchProvider.buildSearchUrl(trimmed);
    }

    const searchTemplate = AppConfig.navigation.defaultSearchEngine.searchUrl;
    return searchTemplate.replace('%s', encodeURIComponent(trimmed));
  }

  /**
   * Navigates the currently active tab or specified tab to the given input.
   * @param {string} input - URL or search query
   * @param {string} [tabId] - Optional tab ID; defaults to active tab
   */
  async navigate(input, tabId = null) {
    const tab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
    if (!tab) {
      console.warn('[NavigationController] No active tab to navigate');
      return;
    }

    const targetUrl = this.resolveInputToUrl(input);
    await tab.loadUrl(targetUrl);
  }

  /**
   * Navigates back in active tab's history.
   */
  goBack(tabId = null) {
    const tab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
    if (tab && tab.canGoBack()) {
      tab.goBack();
    }
  }

  /**
   * Navigates forward in active tab's history.
   */
  goForward(tabId = null) {
    const tab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
    if (tab && tab.canGoForward()) {
      tab.goForward();
    }
  }

  /**
   * Reloads the active tab.
   */
  reload(tabId = null) {
    const tab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
    if (tab) {
      tab.reload();
    }
  }

  /**
   * Stops loading on the active tab.
   */
  stop(tabId = null) {
    const tab = tabId ? this.tabManager.getTab(tabId) : this.tabManager.getActiveTab();
    if (tab) {
      tab.stop();
    }
  }
}

module.exports = NavigationController;
