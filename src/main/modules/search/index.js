/**
 * Núcleo Browser - Search Module Entry Point
 * @module modules/search
 */

const SearchProvider = require('./search-provider');
const { BUILTIN_SEARCH_ENGINES } = require('./search-engines');

module.exports = {
  SearchProvider,
  BUILTIN_SEARCH_ENGINES
};
