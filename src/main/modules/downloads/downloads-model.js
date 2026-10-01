/**
 * Núcleo Browser - Download Model
 * Represents a single download item with lifecycle state, progress, and metadata.
 * @module modules/downloads/downloads-model
 */

const DownloadsUtils = require('./downloads-utils');

class DownloadModel {
  /**
   * @param {Object} options 
   */
  constructor(options = {}) {
    this.id = options.id || `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.filename = DownloadsUtils.sanitizeFilename(options.filename || 'download');
    this.url = options.url || '';
    this.finalUrl = options.finalUrl || this.url;
    this.mimeType = options.mimeType || '';
    this.savePath = options.savePath || '';
    this.totalBytes = typeof options.totalBytes === 'number' ? options.totalBytes : 0;
    this.receivedBytes = typeof options.receivedBytes === 'number' ? options.receivedBytes : 0;
    this.state = options.state || 'downloading'; // 'downloading' | 'paused' | 'completed' | 'cancelled' | 'interrupted' | 'failed'
    this.progress = typeof options.progress === 'number' ? options.progress : DownloadsUtils.calculateProgress(this.receivedBytes, this.totalBytes);
    this.speed = typeof options.speed === 'number' ? options.speed : 0;
    this.estimatedTimeRemaining = typeof options.estimatedTimeRemaining === 'number' ? options.estimatedTimeRemaining : null;
    this.startTime = options.startTime || Date.now();
    this.endTime = options.endTime || null;
    this.error = options.error || null;
    this.paused = !!options.paused;
    this.cancelled = !!options.cancelled;
    this.completed = !!options.completed;
    this.canResume = options.canResume !== undefined ? !!options.canResume : true;
    this.workspaceId = options.workspaceId || null;
    this.tabId = options.tabId || null;
    this.fileCategory = options.fileCategory || DownloadsUtils.getFileCategory(this.filename, this.mimeType);
  }

  /**
   * Updates download progress and calculates speed/eta.
   * @param {number} receivedBytes 
   * @param {number} totalBytes 
   * @param {number} speed 
   * @param {number} eta 
   * @param {boolean} canResume 
   */
  updateProgress(receivedBytes, totalBytes, speed = 0, eta = null, canResume = true) {
    this.receivedBytes = receivedBytes;
    if (totalBytes > 0) {
      this.totalBytes = totalBytes;
    }
    this.speed = speed;
    this.estimatedTimeRemaining = eta;
    this.canResume = canResume;
    this.progress = DownloadsUtils.calculateProgress(this.receivedBytes, this.totalBytes);

    if (this.state !== 'paused' && this.state !== 'cancelled' && this.state !== 'failed') {
      this.state = 'downloading';
      this.paused = false;
    }
  }

  /**
   * Marks download as paused.
   */
  pause() {
    this.state = 'paused';
    this.paused = true;
    this.speed = 0;
    this.estimatedTimeRemaining = null;
  }

  /**
   * Resumes paused download.
   */
  resume() {
    this.state = 'downloading';
    this.paused = false;
  }

  /**
   * Marks download as successfully completed.
   */
  complete() {
    this.state = 'completed';
    this.completed = true;
    this.paused = false;
    this.cancelled = false;
    this.progress = 100;
    this.speed = 0;
    this.estimatedTimeRemaining = 0;
    this.endTime = Date.now();
    if (this.totalBytes <= 0 && this.receivedBytes > 0) {
      this.totalBytes = this.receivedBytes;
    }
  }

  /**
   * Marks download as cancelled by user.
   */
  cancel() {
    this.state = 'cancelled';
    this.cancelled = true;
    this.paused = false;
    this.speed = 0;
    this.estimatedTimeRemaining = null;
    this.endTime = Date.now();
  }

  /**
   * Marks download as failed or interrupted.
   * @param {string} errorMessage 
   */
  fail(errorMessage = 'Download falhou ou foi interrompido') {
    this.state = 'failed';
    this.error = errorMessage;
    this.paused = false;
    this.speed = 0;
    this.estimatedTimeRemaining = null;
    this.endTime = Date.now();
  }

  /**
   * Serializes download model to JSON object.
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      filename: this.filename,
      url: this.url,
      finalUrl: this.finalUrl,
      mimeType: this.mimeType,
      savePath: this.savePath,
      totalBytes: this.totalBytes,
      receivedBytes: this.receivedBytes,
      state: this.state,
      progress: this.progress,
      speed: this.speed,
      estimatedTimeRemaining: this.estimatedTimeRemaining,
      startTime: this.startTime,
      endTime: this.endTime,
      error: this.error,
      paused: this.paused,
      cancelled: this.cancelled,
      completed: this.completed,
      canResume: this.canResume,
      workspaceId: this.workspaceId,
      tabId: this.tabId,
      fileCategory: this.fileCategory,
      // Formatted helpers for renderer display
      formattedTotal: DownloadsUtils.formatBytes(this.totalBytes),
      formattedReceived: DownloadsUtils.formatBytes(this.receivedBytes),
      formattedSpeed: DownloadsUtils.formatSpeed(this.speed),
      formattedEta: DownloadsUtils.formatDuration(this.estimatedTimeRemaining)
    };
  }

  /**
   * Rehydrates DownloadModel from stored JSON data.
   * @param {Object} data 
   * @returns {DownloadModel}
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid download data');
    }
    // If loaded from disk and was still 'downloading' or 'paused', mark as interrupted/cancelled
    let state = data.state;
    if (state === 'downloading' || state === 'paused') {
      state = 'interrupted';
    }

    return new DownloadModel({
      ...data,
      state,
      paused: state === 'paused',
      completed: state === 'completed',
      cancelled: state === 'cancelled'
    });
  }
}

module.exports = DownloadModel;
