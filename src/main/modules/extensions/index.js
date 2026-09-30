/**
 * Núcleo Browser - Chromium Extensions Subsystem
 * Native integration with Chromium / Electron Session Extensions
 * @module modules/extensions
 */

const ExtensionManager = require('./extension-manager');
const ExtensionLoader = require('./extension-loader');
const ExtensionStore = require('./extension-store');
const ExtensionValidator = require('./extension-validator');
const ExtensionEvents = require('./extension-events');

module.exports = {
  ExtensionManager,
  ExtensionLoader,
  ExtensionStore,
  ExtensionValidator,
  ExtensionEvents
};
