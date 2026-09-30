/**
 * Núcleo Browser - Downloads Subsystem
 * Prepared for future milestone: Download manager, progress tracking, virus scan hooks
 * @module modules/downloads
 */

class DownloadManager {
  constructor(browserEngine) {
    this.engine = browserEngine;
    this.downloads = new Map();
  }

  async initialize() {
    // Future: Listen to session 'will-download' events
  }

  getActiveDownloads() {
    return Array.from(this.downloads.values());
  }
}

module.exports = DownloadManager;
