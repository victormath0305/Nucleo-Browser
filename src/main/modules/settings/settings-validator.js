/**
 * Núcleo Browser - Settings Validator
 * Validates settings keys, types, allowed values and sanitizes URLs.
 * @module modules/settings/settings-validator
 */

const { SETTINGS_SCHEMA } = require('./settings-schema');

const DANGEROUS_PROTOCOLS = ['javascript:', 'data:', 'file:', 'vbscript:'];

class SettingsValidator {
  /**
   * Checks whether a key is defined in the schema.
   * @param {string} key
   * @returns {boolean}
   */
  static isKnownKey(key) {
    return Boolean(SETTINGS_SCHEMA[key]);
  }

  /**
   * Validates a key-value pair against the schema.
   * @param {string} key
   * @param {*} value
   * @returns {{ valid: boolean, error?: string, sanitizedValue?: any }}
   */
  static validate(key, value) {
    const rule = SETTINGS_SCHEMA[key];
    if (!rule) {
      return { valid: false, error: `Chave de configuração desconhecida: "${key}"` };
    }

    // Null/undefined check
    if (value === undefined || value === null) {
      return { valid: false, error: `Valor inválido para "${key}": não pode ser nulo ou indefinido` };
    }

    // Type check
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== rule.type) {
      return { valid: false, error: `Tipo incompatível para "${key}": esperado ${rule.type}, recebido ${actualType}` };
    }

    // Enum check
    if (rule.enum && !rule.enum.includes(value)) {
      return {
        valid: false,
        error: `Valor inválido para "${key}": "${value}". Opções permitidas: [${rule.enum.join(', ')}]`
      };
    }

    // Special validation: newTab.customUrl
    if (key === 'newTab.customUrl') {
      const sanitized = this.sanitizeUrl(value);
      if (!sanitized.valid) {
        return { valid: false, error: sanitized.error };
      }
      return { valid: true, sanitizedValue: sanitized.url };
    }

    // Special validation: search.customEngines
    if (key === 'search.customEngines') {
      if (!Array.isArray(value)) {
        return { valid: false, error: 'search.customEngines deve ser uma lista' };
      }
      for (const item of value) {
        const itemRes = this.validateCustomEngine(item);
        if (!itemRes.valid) {
          return { valid: false, error: itemRes.error };
        }
      }
    }

    // Special validation: startup.urls
    if (key === 'startup.urls') {
      if (!Array.isArray(value)) {
        return { valid: false, error: 'startup.urls deve ser uma lista' };
      }
      for (const u of value) {
        const s = this.sanitizeUrl(u);
        if (!s.valid) return { valid: false, error: `URL de inicialização inválida: ${u}` };
      }
    }

    return { valid: true, sanitizedValue: value };
  }

  /**
   * Sanitizes and validates a URL to prevent dangerous protocols.
   * @param {string} rawUrl
   * @returns {{ valid: boolean, url?: string, error?: string }}
   */
  static sanitizeUrl(rawUrl) {
    if (typeof rawUrl !== 'string') {
      return { valid: false, error: 'URL deve ser uma string' };
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
      return { valid: false, error: 'URL não pode ser vazia' };
    }

    const lower = trimmed.toLowerCase();
    for (const proto of DANGEROUS_PROTOCOLS) {
      if (lower.startsWith(proto)) {
        return { valid: false, error: `Protocolo perigoso proibido: "${proto}"` };
      }
    }

    try {
      // Must be parsable as valid URL or standard domain
      if (/^https?:\/\//i.test(trimmed) || /^nucleo:\/\//i.test(trimmed)) {
        const parsed = new URL(trimmed);
        if (!['http:', 'https:', 'nucleo:'].includes(parsed.protocol)) {
          return { valid: false, error: `Protocolo "${parsed.protocol}" não suportado` };
        }
        return { valid: true, url: trimmed };
      }

      // If no scheme provided, prefix with https://
      if (/^[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/.test(trimmed)) {
        return { valid: true, url: `https://${trimmed}` };
      }

      return { valid: false, error: `Formato de URL inválido: "${trimmed}"` };
    } catch (err) {
      return { valid: false, error: `Falha ao interpretar URL: ${err.message}` };
    }
  }

  /**
   * Validates a custom search engine object.
   * @param {Object} engine
   * @returns {{ valid: boolean, error?: string }}
   */
  static validateCustomEngine(engine) {
    if (!engine || typeof engine !== 'object') {
      return { valid: false, error: 'Buscador personalizado deve ser um objeto' };
    }

    if (!engine.name || typeof engine.name !== 'string' || !engine.name.trim()) {
      return { valid: false, error: 'O nome do buscador é obrigatório' };
    }

    if (!engine.searchUrl || typeof engine.searchUrl !== 'string') {
      return { valid: false, error: 'A URL de pesquisa do buscador é obrigatória' };
    }

    const trimmedUrl = engine.searchUrl.trim();
    const lowerUrl = trimmedUrl.toLowerCase();

    for (const proto of DANGEROUS_PROTOCOLS) {
      if (lowerUrl.startsWith(proto)) {
        return { valid: false, error: `Protocolo proibido no buscador: "${proto}"` };
      }
    }

    if (!trimmedUrl.includes('%s')) {
      return { valid: false, error: 'A URL do buscador deve conter o marcador de pesquisa "%s"' };
    }

    try {
      const parsed = new URL(trimmedUrl.replace('%s', 'test'));
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, error: 'Buscadores devem usar protocolo HTTP ou HTTPS' };
      }
    } catch (err) {
      return { valid: false, error: `URL do buscador inválida: ${err.message}` };
    }

    return { valid: true };
  }
}

module.exports = SettingsValidator;
