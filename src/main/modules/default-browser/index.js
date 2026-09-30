/**
 * Núcleo Browser - Default Browser Module Entry Point
 * @module modules/default-browser
 */

const DefaultBrowserManager = require('./default-browser-manager');
const WindowsDefaultBrowser = require('./windows-default-browser');

module.exports = {
  DefaultBrowserManager,
  WindowsDefaultBrowser
};
