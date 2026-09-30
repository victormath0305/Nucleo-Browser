/**
 * Núcleo Browser - Shield Filter Parser
 * Interprets blocking rules, wildcards, URL patterns and exceptions.
 * @module modules/shield/filter-parser
 */

class FilterParser {
  /**
   * Infers a rule category from its text pattern.
   * @param {string} text
   * @returns {'ads'|'trackers'|'analytics'|'other'}
   */
  static inferCategory(text) {
    const lower = text.toLowerCase();
    if (/tracker|tracking|beacon|telemetry|pixel|fingerprint|stats|spy|audience/i.test(lower)) {
      return 'trackers';
    }
    if (/analytic|metric|measurement|telemetry|log/i.test(lower)) {
      return 'analytics';
    }
    if (/ad[s]?[-_.]|advert|banner|pop[up]?|sponsor|promo|click|affiliate|doubleclick|adnxs/i.test(lower)) {
      return 'ads';
    }
    return 'other';
  }

  /**
   * Converts a wildcard glob string (with *) into a safe RegExp.
   * @param {string} glob
   * @returns {RegExp}
   */
  static globToRegex(glob) {
    // Escape regex special characters except *
    const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`, 'i');
  }

  /**
   * Converts a URL pattern (e.g. '* /ads/*') into a RegExp that matches substrings.
   * @param {string} pattern
   * @returns {RegExp}
   */
  static urlPatternToRegex(pattern) {
    let clean = pattern.trim();
    // Remove leading/trailing wildcards as RegExp.test handles substring matches
    if (clean.startsWith('*')) clean = clean.slice(1);
    if (clean.endsWith('*')) clean = clean.slice(0, -1);

    const escaped = clean.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(escaped, 'i');
  }

  /**
   * Parses a single rule line.
   * @param {string} rawLine
   * @param {string} [forcedCategory]
   * @returns {Object|null} Structured rule or null if comment/invalid
   */
  static parseLine(rawLine, forcedCategory = null) {
    if (!rawLine || typeof rawLine !== 'string') return null;

    let line = rawLine.trim();
    if (!line || line.startsWith('!') || line.startsWith('#')) {
      return null; // Empty line or comment
    }

    const isException = line.startsWith('@@');
    if (isException) {
      line = line.slice(2).trim();
    }

    const category = forcedCategory || FilterParser.inferCategory(line);

    // ABP syntax: ||domain.com^ or ||domain.com
    if (line.startsWith('||')) {
      let domainPart = line.slice(2);
      // Remove trailing separator ^ or /
      domainPart = domainPart.replace(/[\^/].*$/, '').trim().toLowerCase();
      if (!domainPart) return null;

      return {
        raw: rawLine,
        type: isException ? 'EXCEPTION_DOMAIN' : 'DOMAIN',
        domain: domainPart,
        isException,
        category
      };
    }

    // Hostname with leading wildcard: *.example.com or *example.com
    if (/^\*\.[a-zA-Z0-9.-]+$/.test(line) || /^[a-zA-Z0-9.-]+\*$/.test(line)) {
      const cleanHost = line.replace(/^\*\./, '').replace(/\*$/, '').toLowerCase();
      return {
        raw: rawLine,
        type: isException ? 'EXCEPTION_DOMAIN' : 'WILDCARD_DOMAIN',
        domain: cleanHost,
        regex: FilterParser.globToRegex(line.toLowerCase()),
        isException,
        category
      };
    }

    // URL path pattern with wildcards: e.g. */ads/*, */analytics/*
    if (line.includes('/') || line.includes('*')) {
      return {
        raw: rawLine,
        type: isException ? 'EXCEPTION_PATTERN' : 'URL_PATTERN',
        pattern: line,
        regex: FilterParser.urlPatternToRegex(line),
        isException,
        category
      };
    }

    // Plain hostname or domain: e.g. tracker.example.com
    if (/^[a-zA-Z0-9.-]+$/.test(line)) {
      return {
        raw: rawLine,
        type: isException ? 'EXCEPTION_DOMAIN' : 'DOMAIN',
        domain: line.toLowerCase(),
        isException,
        category
      };
    }

    return null;
  }

  /**
   * Parses an array or multiline string of rules.
   * @param {string|string[]} input
   * @param {string} [defaultCategory]
   * @returns {Object[]}
   */
  static parseRules(input, defaultCategory = null) {
    const lines = Array.isArray(input) ? input : String(input).split(/\r?\n/);
    const parsedRules = [];

    for (const line of lines) {
      const rule = FilterParser.parseLine(line, defaultCategory);
      if (rule) {
        parsedRules.push(rule);
      }
    }

    return parsedRules;
  }
}

module.exports = FilterParser;
