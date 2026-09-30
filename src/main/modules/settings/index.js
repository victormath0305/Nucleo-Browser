/**
 * Núcleo Browser - Settings Module Entry Point
 * @module modules/settings
 */

const SettingsManager = require('./settings-manager');
const SettingsStore = require('./settings-store');
const SettingsValidator = require('./settings-validator');
const { SETTINGS_SCHEMA, SECTIONS } = require('./settings-schema');
const { getDefaultSettings, getFlatDefaults } = require('./settings-defaults');

module.exports = {
  SettingsManager,
  SettingsStore,
  SettingsValidator,
  SETTINGS_SCHEMA,
  SECTIONS,
  getDefaultSettings,
  getFlatDefaults
};
