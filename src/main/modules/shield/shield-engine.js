/**
 * Núcleo Browser - Shield Blocking Decision Engine
 * High-performance indexing (Set, Map, Suffix trees, Regexes) with LRU decision cache.
 * @module modules/shield/shield-engine
 */

const MAX_CACHE_SIZE = 2000;

class ShieldEngine {
  constructor() {
    // Fast O(1) exact domain lookup
    this.exactDomains = new Map(); // domain -> category

    // Suffix and wildcard domain rules
    this.wildcardDomains = []; // [{ domain, regex, category }]

    // Regex URL pattern rules
    this.urlPatterns = []; // [{ pattern, regex, category }]

    // Whitelist / Exception rules
    this.exceptionDomains = new Set();
    this.exceptionPatterns = []; // [{ regex }]

    // LRU-style decision cache: Map<url, DecisionResult>
    this.decisionCache = new Map();

    this.rulesCount = 0;
  }

  /**
   * Clears the current rules database and cache.
   */
  reset() {
    this.exactDomains.clear();
    this.wildcardDomains = [];
    this.urlPatterns = [];
    this.exceptionDomains.clear();
    this.exceptionPatterns = [];
    this.decisionCache.clear();
    this.rulesCount = 0;
  }

  /**
   * Ingests an array of structured parsed rules (from FilterParser).
   * @param {Object[]} rules
   */
  loadRules(rules) {
    this.reset();

    for (const rule of rules) {
      if (!rule) continue;

      if (rule.type === 'EXCEPTION_DOMAIN') {
        this.exceptionDomains.add(rule.domain.toLowerCase());
      } else if (rule.type === 'EXCEPTION_PATTERN') {
        this.exceptionPatterns.push(rule.regex);
      } else if (rule.type === 'DOMAIN') {
        this.exactDomains.set(rule.domain.toLowerCase(), rule.category || 'ads');
      } else if (rule.type === 'WILDCARD_DOMAIN') {
        this.wildcardDomains.push({
          domain: rule.domain.toLowerCase(),
          regex: rule.regex,
          category: rule.category || 'ads'
        });
      } else if (rule.type === 'URL_PATTERN') {
        this.urlPatterns.push({
          pattern: rule.pattern,
          regex: rule.regex,
          category: rule.category || 'other'
        });
      }
      this.rulesCount++;
    }
  }

  /**
   * Empties the decision cache (called on whitelist or rule changes).
   */
  clearCache() {
    this.decisionCache.clear();
  }

  /**
   * Internal helper to cache a decision with LRU bounding.
   */
  _cacheDecision(key, decision) {
    if (this.decisionCache.size >= MAX_CACHE_SIZE) {
      // Remove oldest entry (first item in Map iterator)
      const oldestKey = this.decisionCache.keys().next().value;
      if (oldestKey) this.decisionCache.delete(oldestKey);
    }
    this.decisionCache.set(key, decision);
    return decision;
  }

  /**
   * Evaluates a URL against loaded filter rules.
   * @param {string} targetUrl - Request target URL
   * @param {Object} [context] - Context options e.g. { siteDomain, isSiteWhitelisted }
   * @returns {{ action: 'ALLOW'|'BLOCK', category?: string, reason: string }}
   */
  shouldBlock(targetUrl, context = {}) {
    if (!targetUrl || typeof targetUrl !== 'string') {
      return { action: 'ALLOW', reason: 'Invalid URL' };
    }

    // 1. Safety check: Never block internal, file, extension, or data protocols
    if (
      targetUrl.startsWith('nucleo:') ||
      targetUrl.startsWith('file:') ||
      targetUrl.startsWith('devtools:') ||
      targetUrl.startsWith('data:') ||
      targetUrl.startsWith('blob:') ||
      targetUrl.startsWith('chrome:') ||
      targetUrl.startsWith('chrome-extension:')
    ) {
      return { action: 'ALLOW', reason: 'Internal protocol is safe' };
    }

    // 2. Context site whitelist check (User explicitly turned off Shield on current site)
    if (context.isSiteWhitelisted) {
      return { action: 'ALLOW', reason: 'Site is whitelisted by user' };
    }

    // 3. Check decision cache
    if (this.decisionCache.has(targetUrl)) {
      return this.decisionCache.get(targetUrl);
    }

    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return { action: 'ALLOW', reason: 'Unparseable URL' };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 4. Check rule exceptions (whitelist rules)
    if (this.exceptionDomains.has(hostname)) {
      return this._cacheDecision(targetUrl, {
        action: 'ALLOW',
        reason: 'Matched exception domain rule'
      });
    }

    for (const regex of this.exceptionPatterns) {
      if (regex.test(targetUrl)) {
        return this._cacheDecision(targetUrl, {
          action: 'ALLOW',
          reason: 'Matched exception pattern'
        });
      }
    }

    // 5. Check exact domains & subdomains (O(1) lookups per domain segment)
    // E.g. for "ad.tracker.doubleclick.net", check:
    // "ad.tracker.doubleclick.net" -> "tracker.doubleclick.net" -> "doubleclick.net"
    const parts = hostname.split('.');
    for (let i = 0; i < parts.length - 1; i++) {
      const candidate = parts.slice(i).join('.');
      if (this.exactDomains.has(candidate)) {
        const category = this.exactDomains.get(candidate);
        return this._cacheDecision(targetUrl, {
          action: 'BLOCK',
          category,
          reason: `Exact domain match: ${candidate}`
        });
      }
    }

    // 6. Check wildcard domain rules
    for (const rule of this.wildcardDomains) {
      if (rule.regex.test(hostname) || hostname.endsWith(`.${rule.domain}`)) {
        return this._cacheDecision(targetUrl, {
          action: 'BLOCK',
          category: rule.category,
          reason: `Wildcard domain match: ${rule.domain}`
        });
      }
    }

    // 7. Check URL pattern rules
    for (const rule of this.urlPatterns) {
      if (rule.regex.test(targetUrl)) {
        return this._cacheDecision(targetUrl, {
          action: 'BLOCK',
          category: rule.category,
          reason: `URL pattern match: ${rule.pattern}`
        });
      }
    }

    // 8. No rules matched -> ALLOW
    return this._cacheDecision(targetUrl, {
      action: 'ALLOW',
      reason: 'No blocking rules matched'
    });
  }

  getRulesCount() {
    return this.rulesCount;
  }

  getCacheSize() {
    return this.decisionCache.size;
  }
}

module.exports = ShieldEngine;
