/**
 * Núcleo Browser - Shield Module Index
 * Native ad, tracker, and privacy protection subsystem.
 * @module modules/shield
 */

const FilterParser = require('./filter-parser');
const FilterStore = require('./filter-store');
const ShieldStats = require('./shield-stats');
const ShieldEngine = require('./shield-engine');
const ShieldManager = require('./shield-manager');

module.exports = {
  FilterParser,
  FilterStore,
  ShieldStats,
  ShieldEngine,
  ShieldManager
};
