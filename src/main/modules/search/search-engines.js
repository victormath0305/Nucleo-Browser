/**
 * Núcleo Browser - Pre-configured Search Engines
 * Real, verified search engine URLs with %s placeholder.
 * @module modules/search/search-engines
 */

const BUILTIN_SEARCH_ENGINES = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/?q=%s',
    suggestUrl: 'https://duckduckgo.com/ac/?q=%s&type=list',
    keyword: 'd',
    isBuiltin: true
  },
  {
    id: 'google',
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=%s',
    suggestUrl: 'https://suggestqueries.google.com/complete/search?client=chrome&q=%s',
    keyword: 'g',
    isBuiltin: true
  },
  {
    id: 'bing',
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=%s',
    suggestUrl: 'https://api.bing.com/osjson.aspx?query=%s',
    keyword: 'b',
    isBuiltin: true
  },
  {
    id: 'brave',
    name: 'Brave Search',
    searchUrl: 'https://search.brave.com/search?q=%s',
    suggestUrl: 'https://search.brave.com/api/suggest?q=%s',
    keyword: 'br',
    isBuiltin: true
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    searchUrl: 'https://www.ecosia.org/search?q=%s',
    suggestUrl: 'https://ac.ecosia.org/autocomplete?q=%s&type=list',
    keyword: 'e',
    isBuiltin: true
  },
  {
    id: 'startpage',
    name: 'Startpage',
    searchUrl: 'https://www.startpage.com/sp/search?query=%s',
    suggestUrl: 'https://www.startpage.com/suggestions?q=%s',
    keyword: 's',
    isBuiltin: true
  }
];

module.exports = {
  BUILTIN_SEARCH_ENGINES
};
