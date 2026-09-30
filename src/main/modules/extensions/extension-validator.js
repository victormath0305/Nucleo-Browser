/**
 * Núcleo Browser - Extension Validator
 * Validates extension structure and manifest.json (Manifest V2 and V3)
 * @module modules/extensions/extension-validator
 */

const fs = require('fs');
const path = require('path');

class ExtensionValidator {
  /**
   * Validates an extension folder on disk.
   * @param {string} directoryPath - Absolute path to unpacked extension directory
   * @returns {Promise<{ valid: boolean, errors: string[], warnings: string[], manifest: Object|null, manifestVersion: number|null, metadata: Object }>}
   */
  static async validateDirectory(directoryPath) {
    const result = {
      valid: false,
      errors: [],
      warnings: [],
      manifest: null,
      manifestVersion: null,
      metadata: {
        name: '',
        version: '',
        description: '',
        permissions: [],
        hostPermissions: [],
        hasBackground: false,
        hasContentScripts: false,
        hasPopup: false,
        action: null,
        icons: null
      }
    };

    if (!directoryPath || typeof directoryPath !== 'string') {
      result.errors.push('Caminho do diretório da extensão inválido ou não fornecido.');
      return result;
    }

    // 1. Check directory existence
    try {
      const stats = await fs.promises.stat(directoryPath);
      if (!stats.isDirectory()) {
        result.errors.push('O caminho fornecido não é um diretório válido.');
        return result;
      }
    } catch (err) {
      result.errors.push(`Diretório não encontrado: ${directoryPath}`);
      return result;
    }

    // 2. Check manifest.json existence
    const manifestPath = path.join(directoryPath, 'manifest.json');
    let rawContent;
    try {
      rawContent = await fs.promises.readFile(manifestPath, 'utf8');
    } catch (err) {
      result.errors.push('Arquivo manifest.json não encontrado no diretório.');
      return result;
    }

    // 3. Parse manifest JSON
    let manifest;
    try {
      manifest = JSON.parse(rawContent);
    } catch (err) {
      result.errors.push(`manifest.json contém JSON inválido ou corrompido: ${err.message}`);
      return result;
    }

    // 4. Validate manifest fields
    const manifestValidation = this.validateManifest(manifest);
    result.errors.push(...manifestValidation.errors);
    result.warnings.push(...manifestValidation.warnings);
    result.manifest = manifestValidation.manifest;
    result.manifestVersion = manifestValidation.manifestVersion;
    result.metadata = manifestValidation.metadata;

    if (result.errors.length > 0) {
      result.valid = false;
      return result;
    }

    // 5. Verify local referenced files exist in directory
    await this._verifyReferencedFiles(directoryPath, manifest, result);

    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validates an in-memory manifest object.
   * @param {Object} manifest
   * @returns {{ valid: boolean, errors: string[], warnings: string[], manifest: Object, manifestVersion: number|null, metadata: Object }}
   */
  static validateManifest(manifest) {
    const errors = [];
    const warnings = [];

    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      return {
        valid: false,
        errors: ['O manifest deve ser um objeto JSON válido.'],
        warnings: [],
        manifest: null,
        manifestVersion: null,
        metadata: {}
      };
    }

    // A. Manifest Version
    const mv = manifest.manifest_version;
    if (mv !== 2 && mv !== 3) {
      errors.push(`Manifest Version não suportado: ${mv}. Apenas Manifest V2 e V3 são aceitos.`);
    }

    // B. Name
    if (!manifest.name || typeof manifest.name !== 'string' || manifest.name.trim().length === 0) {
      errors.push('Campo obrigatório "name" ausente ou inválido no manifest.');
    }

    // C. Version
    if (!manifest.version || typeof manifest.version !== 'string' || !/^\d+(\.\d+)*$/.test(manifest.version.trim())) {
      errors.push('Campo obrigatório "version" ausente ou inválido no manifest (esperado formato numérico, ex: 1.0 ou 2.1.0).');
    }

    // D. Description
    const description = typeof manifest.description === 'string' ? manifest.description.trim() : '';

    // E. Permissions & Host Permissions
    const permissions = Array.isArray(manifest.permissions) ? manifest.permissions.filter(p => typeof p === 'string') : [];
    let hostPermissions = [];

    if (mv === 3) {
      if (Array.isArray(manifest.host_permissions)) {
        hostPermissions = manifest.host_permissions.filter(h => typeof h === 'string');
      }
    } else if (mv === 2) {
      // In MV2, host permissions were often listed directly inside permissions
      hostPermissions = permissions.filter(p => p.includes('://') || p === '<all_urls>');
    }

    // F. Action (MV3) vs Browser Action / Page Action (MV2)
    let actionData = null;
    if (mv === 3 && manifest.action && typeof manifest.action === 'object') {
      actionData = {
        popup: manifest.action.default_popup || null,
        title: manifest.action.default_title || manifest.name || '',
        icon: manifest.action.default_icon || null
      };
    } else if (mv === 2) {
      const act = manifest.browser_action || manifest.page_action;
      if (act && typeof act === 'object') {
        actionData = {
          popup: act.default_popup || null,
          title: act.default_title || manifest.name || '',
          icon: act.default_icon || null
        };
      }
    }

    // G. Background
    let hasBackground = false;
    let backgroundInfo = null;
    if (manifest.background && typeof manifest.background === 'object') {
      hasBackground = true;
      if (mv === 3) {
        backgroundInfo = {
          serviceWorker: manifest.background.service_worker || null,
          type: manifest.background.type || 'module'
        };
      } else {
        backgroundInfo = {
          scripts: Array.isArray(manifest.background.scripts) ? manifest.background.scripts : [],
          page: manifest.background.page || null,
          persistent: manifest.background.persistent !== false
        };
      }
    }

    // H. Content Scripts
    let hasContentScripts = false;
    const contentScripts = [];
    if (Array.isArray(manifest.content_scripts)) {
      hasContentScripts = manifest.content_scripts.length > 0;
      for (const cs of manifest.content_scripts) {
        if (cs && typeof cs === 'object') {
          contentScripts.push({
            matches: Array.isArray(cs.matches) ? cs.matches : [],
            js: Array.isArray(cs.js) ? cs.js : [],
            css: Array.isArray(cs.css) ? cs.css : [],
            runAt: cs.run_at || 'document_idle'
          });
        }
      }
    }

    const metadata = {
      name: (manifest.name || '').trim(),
      version: (manifest.version || '').trim(),
      description,
      manifestVersion: mv || null,
      permissions,
      hostPermissions,
      action: actionData,
      hasPopup: Boolean(actionData && actionData.popup),
      hasBackground,
      background: backgroundInfo,
      hasContentScripts,
      contentScripts,
      icons: manifest.icons || null,
      author: manifest.author || null,
      homepage: manifest.homepage_url || manifest.homepage || null
    };

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      manifest,
      manifestVersion: mv || null,
      metadata
    };
  }

  /**
   * Checks that referenced files in manifest exist in the directory.
   * @private
   */
  static async _verifyReferencedFiles(directoryPath, manifest, result) {
    const checkFile = async (relPath, label, isRequired = true) => {
      if (!relPath || typeof relPath !== 'string') return;
      const fullPath = path.join(directoryPath, relPath);
      try {
        await fs.promises.access(fullPath, fs.constants.R_OK);
      } catch {
        const msg = `Arquivo referenciado para ${label} não encontrado: "${relPath}"`;
        if (isRequired) {
          result.errors.push(msg);
        } else {
          result.warnings.push(msg);
        }
      }
    };

    // Check background
    if (manifest.background) {
      if (manifest.manifest_version === 3 && manifest.background.service_worker) {
        await checkFile(manifest.background.service_worker, 'background.service_worker', true);
      } else if (manifest.manifest_version === 2) {
        if (Array.isArray(manifest.background.scripts)) {
          for (const s of manifest.background.scripts) {
            await checkFile(s, 'background.scripts', true);
          }
        }
        if (manifest.background.page) {
          await checkFile(manifest.background.page, 'background.page', true);
        }
      }
    }

    // Check action popup
    const action = manifest.action || manifest.browser_action || manifest.page_action;
    if (action && action.default_popup) {
      await checkFile(action.default_popup, 'default_popup', false);
    }

    // Check content scripts
    if (Array.isArray(manifest.content_scripts)) {
      for (const cs of manifest.content_scripts) {
        if (Array.isArray(cs.js)) {
          for (const script of cs.js) {
            await checkFile(script, 'content_scripts.js', true);
          }
        }
        if (Array.isArray(cs.css)) {
          for (const style of cs.css) {
            await checkFile(style, 'content_scripts.css', false);
          }
        }
      }
    }
  }
}

module.exports = ExtensionValidator;
