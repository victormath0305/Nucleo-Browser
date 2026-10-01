/**
 * Núcleo Browser - Download Utilities
 * Formatting, filename sanitization, duplicate resolution, and path security.
 * @module modules/downloads/downloads-utils
 */

const fs = require('fs');
const path = require('path');

class DownloadsUtils {
  /**
   * Formats byte count to human-readable string (B, KB, MB, GB, TB).
   * @param {number} bytes 
   * @param {number} decimals 
   * @returns {string}
   */
  static formatBytes(bytes, decimals = 1) {
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
      return '0 B';
    }
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const safeIndex = Math.min(i, sizes.length - 1);
    const value = parseFloat((bytes / Math.pow(k, safeIndex)).toFixed(dm));

    return `${value} ${sizes[safeIndex]}`;
  }

  /**
   * Formats download transfer speed in bytes per second.
   * @param {number} bytesPerSec 
   * @returns {string}
   */
  static formatSpeed(bytesPerSec) {
    if (!bytesPerSec || bytesPerSec <= 0 || isNaN(bytesPerSec)) {
      return '0 B/s';
    }
    return `${this.formatBytes(bytesPerSec, 1)}/s`;
  }

  /**
   * Formats estimated time remaining in seconds to human-readable format.
   * @param {number} seconds 
   * @returns {string}
   */
  static formatDuration(seconds) {
    if (seconds === null || seconds === undefined || isNaN(seconds) || seconds < 0 || !isFinite(seconds)) {
      return '--';
    }

    const sec = Math.round(seconds);
    if (sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;

    const mins = Math.floor(sec / 60);
    const remSec = sec % 60;
    if (mins < 60) {
      return remSec > 0 ? `${mins}m ${remSec}s` : `${mins}m`;
    }

    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    if (hours < 24) {
      return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
    }

    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }

  /**
   * Calculates progress percentage from received and total bytes.
   * @param {number} receivedBytes 
   * @param {number} totalBytes 
   * @returns {number} 0 to 100, or -1 if total is unknown
   */
  static calculateProgress(receivedBytes, totalBytes) {
    if (!totalBytes || totalBytes <= 0 || isNaN(totalBytes)) {
      return -1; // Indeterminate
    }
    if (!receivedBytes || receivedBytes <= 0) {
      return 0;
    }
    const percent = Math.min(100, Math.round((receivedBytes / totalBytes) * 100));
    return percent;
  }

  /**
   * Sanitizes a filename, preventing directory traversal and removing invalid Windows chars.
   * Forbidden characters: < > : " / \ | ? * and control chars (0x00-0x1F).
   * @param {string} rawFilename 
   * @returns {string}
   */
  static sanitizeFilename(rawFilename) {
    if (!rawFilename || typeof rawFilename !== 'string') {
      return 'download';
    }

    // Strip URL decoding or multiple layers
    let clean = rawFilename.trim();
    try {
      if (clean.includes('%')) {
        clean = decodeURIComponent(clean);
      }
    } catch {
      // Ignore URI malformed
    }

    // Strip leading/trailing directory paths or traversal patterns
    clean = path.basename(clean);
    clean = clean.replace(/^[.\\/]+/, '');

    // Remove forbidden Windows filesystem characters: < > : " / \ | ? * and ASCII control chars
    // eslint-disable-next-line no-control-regex
    clean = clean.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

    // Windows reserved device names (CON, PRN, AUX, NUL, COM1..9, LPT1..9)
    const baseName = path.parse(clean).name.toUpperCase();
    const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    if (reserved.test(baseName)) {
      clean = `_${clean}`;
    }

    // Trim trailing dots and spaces (invalid in Windows)
    clean = clean.replace(/[. ]+$/, '');

    if (!clean || clean === '.' || clean === '..') {
      return 'download';
    }

    // Limit maximum filename length (Windows MAX_PATH compatibility)
    if (clean.length > 200) {
      const ext = path.extname(clean);
      const name = path.basename(clean, ext);
      clean = name.slice(0, 190) + ext;
    }

    return clean;
  }

  /**
   * Generates a non-colliding filepath in the destination directory.
   * E.g. 'report.pdf' -> 'report (1).pdf', 'report (2).pdf'
   * @param {string} destinationDir 
   * @param {string} filename 
   * @returns {string} Safe absolute file path
   */
  static getUniqueFilePath(destinationDir, filename) {
    const safeFilename = this.sanitizeFilename(filename);
    const targetDir = path.resolve(destinationDir);

    let finalPath = path.join(targetDir, safeFilename);
    if (!fs.existsSync(finalPath)) {
      return finalPath;
    }

    const ext = path.extname(safeFilename);
    const baseName = path.basename(safeFilename, ext);
    let counter = 1;

    while (fs.existsSync(finalPath) && counter < 10000) {
      finalPath = path.join(targetDir, `${baseName} (${counter})${ext}`);
      counter++;
    }

    return finalPath;
  }

  /**
   * Infers file category / type from extension or MIME type.
   * Categories: 'document', 'archive', 'image', 'audio', 'video', 'executable', 'code', 'generic'
   * @param {string} filename 
   * @param {string} mimeType 
   * @returns {string}
   */
  static getFileCategory(filename = '', mimeType = '') {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mime = (mimeType || '').toLowerCase();

    if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
      return 'archive';
    }
    if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'apk'].includes(ext) || mime.includes('x-msdownload')) {
      return 'executable';
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'].includes(ext) || mime.startsWith('image/')) {
      return 'image';
    }
    if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'].includes(ext) || mime.startsWith('audio/')) {
      return 'audio';
    }
    if (['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv'].includes(ext) || mime.startsWith('video/')) {
      return 'video';
    }
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'epub'].includes(ext) || mime.includes('pdf') || mime.includes('document')) {
      return 'document';
    }
    if (['js', 'ts', 'json', 'html', 'css', 'py', 'c', 'cpp', 'rs', 'go', 'java', 'xml', 'yaml', 'yml'].includes(ext)) {
      return 'code';
    }

    return 'generic';
  }
}

module.exports = DownloadsUtils;
