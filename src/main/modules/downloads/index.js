/**
 * Núcleo Browser - Downloads Subsystem Index
 * @module modules/downloads
 */

const DownloadsManager = require('./downloads-manager');
const DownloadsStore = require('./downloads-store');
const DownloadModel = require('./downloads-model');
const DownloadsUtils = require('./downloads-utils');

module.exports = {
  DownloadsManager,
  DownloadsStore,
  DownloadModel,
  DownloadsUtils
};
