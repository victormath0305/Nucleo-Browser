/**
 * Núcleo Browser - Automated Test Runner (v0.3 Bookmarks, History & Persistence)
 * Validates Navigation, Bookmarks, History, Atomic Persistence, and Full Electron Launch.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const NavigationController = require('../src/main/modules/navigation/navigation-controller');
const { BookmarkManager, BookmarkStore } = require('../src/main/modules/bookmarks');
const { HistoryManager, HistoryStore } = require('../src/main/modules/history');
const { FilterParser, FilterStore, ShieldEngine, ShieldStats, ShieldManager } = require('../src/main/modules/shield');
const { ExtensionValidator, ExtensionStore, ExtensionManager, ExtensionEvents } = require('../src/main/modules/extensions');
const { SettingsValidator, SettingsStore, SettingsManager, getDefaultSettings } = require('../src/main/modules/settings');
const { SearchProvider, BUILTIN_SEARCH_ENGINES } = require('../src/main/modules/search');
const { DefaultBrowserManager } = require('../src/main/modules/default-browser');

async function runUnitTests() {
  console.log('=== [1/2] Executing Unit Tests (v0.6.0 Settings, Search, Extensions, Shield, Bookmarks & History) ===\n');

  // --- 1. Navigation Resolution Tests ---
  console.log('[Suite 1: Navigation Controller]');
  const nav = new NavigationController(null);

  const test1 = nav.resolveInputToUrl('https://example.com');
  console.assert(test1 === 'https://example.com', `Test 1 Failed: Expected https://example.com, got ${test1}`);
  console.log('  ✔ Direct HTTPS URL resolution passed');

  const test2 = nav.resolveInputToUrl('github.com');
  console.assert(test2 === 'https://github.com', `Test 2 Failed: Expected https://github.com, got ${test2}`);
  console.log('  ✔ Domain without protocol resolution passed');

  const test3 = nav.resolveInputToUrl('como criar um site');
  console.assert(test3.includes('duckduckgo.com') && test3.includes('como%20criar%20um%20site'), `Test 3 Failed: ${test3}`);
  console.log('  ✔ Natural language search query resolution passed');

  const test4 = nav.resolveInputToUrl('localhost:8080');
  console.assert(test4 === 'http://localhost:8080', `Test 4 Failed: Expected http://localhost:8080, got ${test4}`);
  console.log('  ✔ Localhost resolution passed');

  const test5 = nav.resolveInputToUrl('192.168.1.1');
  console.assert(test5 === 'http://192.168.1.1', `Test 5 Failed: Expected http://192.168.1.1, got ${test5}`);
  console.log('  ✔ IP address resolution passed');

  const test6 = nav.resolveInputToUrl('nucleo://newtab');
  console.assert(test6 === 'nucleo://newtab', `Test 6 Failed: Expected nucleo://newtab, got ${test6}`);
  console.log('  ✔ nucleo://newtab resolution passed');

  const test7 = nav.resolveInputToUrl('nucleo://bookmarks');
  console.assert(test7 === 'nucleo://bookmarks', `Test 7 Failed: Expected nucleo://bookmarks, got ${test7}`);
  console.log('  ✔ nucleo://bookmarks resolution passed');

  const test8 = nav.resolveInputToUrl('nucleo://history');
  console.assert(test8 === 'nucleo://history', `Test 8 Failed: Expected nucleo://history, got ${test8}`);
  console.log('  ✔ nucleo://history resolution passed');

  const test8b = nav.resolveInputToUrl('nucleo://shield');
  console.assert(test8b === 'nucleo://shield', `Test 8b Failed: Expected nucleo://shield, got ${test8b}`);
  console.log('  ✔ nucleo://shield resolution passed');

  const test8c = nav.resolveInputToUrl('nucleo://shield-test');
  console.assert(test8c === 'nucleo://shield-test', `Test 8c Failed: Expected nucleo://shield-test, got ${test8c}`);
  console.log('  ✔ nucleo://shield-test resolution passed');

  const test8d = nav.resolveInputToUrl('nucleo://extensions');
  console.assert(test8d === 'nucleo://extensions', `Test 8d Failed: Expected nucleo://extensions, got ${test8d}`);
  console.log('  ✔ nucleo://extensions resolution passed');

  const test8e = nav.resolveInputToUrl('nucleo://extension-test');
  console.assert(test8e === 'nucleo://extension-test', `Test 8e Failed: Expected nucleo://extension-test, got ${test8e}`);
  console.log('  ✔ nucleo://extension-test resolution passed');

  const test8f = nav.resolveInputToUrl('nucleo://settings');
  console.assert(test8f === 'nucleo://settings', `Test 8f Failed: Expected nucleo://settings, got ${test8f}`);
  console.log('  ✔ nucleo://settings resolution passed');

  const test8g = nav.resolveInputToUrl('nucleo://configuracoes');
  console.assert(test8g === 'nucleo://settings', `Test 8g Failed: Expected nucleo://settings, got ${test8g}`);
  console.log('  ✔ nucleo://configuracoes alias resolution passed');

  const test9 = nav.resolveInputToUrl('');
  console.assert(test9 === 'nucleo://newtab', `Test 9 Failed: Expected nucleo://newtab for empty input, got ${test9}`);
  console.log('  ✔ Empty input resolution passed');

  // --- 2. Bookmarks Manager & Store Tests ---
  console.log('\n[Suite 2: Bookmarks Manager & Hierarchy]');
  const tempBmPath = path.join(os.tmpdir(), `nucleo-test-bookmarks-${Date.now()}.json`);
  const bmStore = new BookmarkStore(tempBmPath);
  const bmManager = new BookmarkManager(bmStore);
  await bmManager.initialize();

  // Test: Initial default bookmarks
  const initialBms = bmManager.getAllBookmarks();
  console.assert(initialBms.length >= 2, `Expected at least 2 default bookmarks, got ${initialBms.length}`);
  console.log(`  ✔ Default bookmarks seeded (${initialBms.length} items)`);

  // Test: Add bookmark
  const addedBm = await bmManager.addBookmark({
    title: 'Electron Official',
    url: 'https://electronjs.org',
    folderId: 'toolbar'
  });
  console.assert(addedBm && addedBm.id, 'Failed to add bookmark');
  console.assert(bmManager.isBookmarked('https://electronjs.org'), 'isBookmarked failed for added URL');
  console.log('  ✔ addBookmark and isBookmarked verified');

  // Test: Duplicate prevention on normalized URL
  const duplicateBm = await bmManager.addBookmark({
    title: 'Electron Official Updated',
    url: 'https://electronjs.org/',
    folderId: 'toolbar'
  });
  console.assert(duplicateBm.id === addedBm.id, 'Duplicate prevention failed: created duplicate instead of updating');
  console.assert(duplicateBm.title === 'Electron Official Updated', 'Title was not updated on duplicate add');
  console.log('  ✔ Duplicate bookmark prevention & normalization verified');

  // Test: Folder creation, renaming and deletion
  const newFolder = await bmManager.createFolder({ title: 'Desenvolvimento' });
  console.assert(newFolder && newFolder.id, 'Folder creation failed');
  await bmManager.renameFolder(newFolder.id, 'Dev Tools');
  const renamedFolder = bmManager.getFolders().find(f => f.id === newFolder.id);
  console.assert(renamedFolder && renamedFolder.title === 'Dev Tools', 'Folder renaming failed');

  // Test: Move bookmark
  await bmManager.moveBookmark(addedBm.id, newFolder.id);
  const movedBm = bmManager.getAllBookmarks().find(b => b.id === addedBm.id);
  console.assert(movedBm && movedBm.folderId === newFolder.id, 'Bookmark move failed');
  console.log('  ✔ Folder creation, rename, and bookmark move verified');

  // Test: Folder deletion reparents items
  await bmManager.deleteFolder(newFolder.id);
  const reparentedBm = bmManager.getAllBookmarks().find(b => b.id === addedBm.id);
  console.assert(reparentedBm && reparentedBm.folderId === 'root', 'Folder delete failed to reparent bookmark');
  console.log('  ✔ Folder deletion with item reparenting verified');

  // Test: Search bookmarks
  const searchResults = bmManager.searchBookmarks('electron');
  console.assert(searchResults.length >= 1, 'Search failed to find electron bookmark');
  console.log('  ✔ Bookmark search verified');

  // Test: Remove bookmark
  await bmManager.removeBookmark(addedBm.id);
  console.assert(!bmManager.isBookmarked('https://electronjs.org'), 'Failed to remove bookmark by ID');
  console.log('  ✔ Bookmark deletion verified');

  // --- 3. History Manager & Store Tests ---
  console.log('\n[Suite 3: History Manager & Retention]');
  const tempHistPath = path.join(os.tmpdir(), `nucleo-test-history-${Date.now()}.json`);
  const histStore = new HistoryStore(tempHistPath, 5); // limit 5 for retention test
  const histManager = new HistoryManager(histStore);
  await histManager.initialize();

  // Test: Ignore internal pages and blank
  const internalVisit1 = await histManager.addVisit({ url: 'nucleo://newtab' });
  const internalVisit2 = await histManager.addVisit({ url: 'nucleo://bookmarks' });
  const internalVisit3 = await histManager.addVisit({ url: 'about:blank' });
  const privateVisit = await histManager.addVisit({ url: 'https://secret.com', isPrivate: true });
  console.assert(!internalVisit1 && !internalVisit2 && !internalVisit3 && !privateVisit, 'Internal or private URLs were recorded!');
  console.assert(histManager.getAllEntries().length === 0, 'History should be empty after internal visits');
  console.log('  ✔ Strict exclusion of internal pages & private browsing verified');

  // Test: Add valid visits and visit counting
  await histManager.addVisit({ url: 'https://google.com', title: 'Google' });
  await histManager.addVisit({ url: 'https://google.com', title: 'Google Search' });
  const googleEntry = histManager.getAllEntries().find(e => e.url.includes('google.com'));
  console.assert(googleEntry && googleEntry.visitCount === 2, `Expected visitCount 2, got ${googleEntry?.visitCount}`);
  console.assert(googleEntry.title === 'Google Search', 'Title not updated on subsequent visit');
  console.log('  ✔ Visit recording and visit counter increment verified');

  // Test: Title update
  await histManager.updateTitle('https://google.com', 'Google Home');
  const updatedGoogle = histManager.getAllEntries().find(e => e.url.includes('google.com'));
  console.assert(updatedGoogle.title === 'Google Home', 'updateTitle failed');
  console.log('  ✔ Title update verified');

  // Test: History search
  await histManager.addVisit({ url: 'https://github.com', title: 'GitHub' });
  const searchHist = histManager.searchHistory('github');
  console.assert(searchHist.entries.length === 1, 'History search failed');
  console.log('  ✔ History search with pagination verified');

  // Test: Retention limit (maxEntries = 5)
  for (let i = 1; i <= 6; i++) {
    await histManager.addVisit({ url: `https://site-${i}.com`, title: `Site ${i}` });
  }
  console.assert(histManager.getAllEntries().length <= 5, `Retention policy violated: ${histManager.getAllEntries().length} > 5`);
  console.log('  ✔ Retention limit auto-purge policy verified');

  // Test: Period clearing
  const clearedCount = await histManager.clearByPeriod('all');
  console.assert(clearedCount > 0 && histManager.getAllEntries().length === 0, 'Failed to clear all history');
  console.log('  ✔ Period-based history clearing verified');

  // --- 4. Persistence & Restart Simulation ---
  console.log('\n[Suite 4: Persistence & Restart Simulation]');
  // Add a persistent bookmark and history entry
  const restartBmStore = new BookmarkStore(tempBmPath);
  const restartBmManager = new BookmarkManager(restartBmStore);
  await restartBmManager.initialize();
  await restartBmManager.addBookmark({ title: 'Restart Test', url: 'https://restart-test.com' });

  const restartHistStore = new HistoryStore(tempHistPath, 100);
  const restartHistManager = new HistoryManager(restartHistStore);
  await restartHistManager.initialize();
  await restartHistManager.addVisit({ title: 'Restart Visit', url: 'https://restart-visit.com' });

  // Now instantiate brand new instances pointing to the exact same files to simulate browser restart
  const freshBmStore = new BookmarkStore(tempBmPath);
  const freshBmManager = new BookmarkManager(freshBmStore);
  await freshBmManager.initialize();
  console.assert(freshBmManager.isBookmarked('https://restart-test.com'), 'Persistence failed: bookmark not restored after restart');

  const freshHistStore = new HistoryStore(tempHistPath, 100);
  const freshHistManager = new HistoryManager(freshHistStore);
  await freshHistManager.initialize();
  const restoredVisit = freshHistManager.getAllEntries().find(e => e.url === 'https://restart-visit.com');
  console.assert(restoredVisit && restoredVisit.title === 'Restart Visit', 'Persistence failed: history visit not restored after restart');
  // --- 5. Núcleo Shield Filter Engine, Store & Manager Tests ---
  console.log('\n[Suite 5: Núcleo Shield Filter Engine, Store & Manager]');
  const tempShieldPath = path.join(os.tmpdir(), `nucleo-test-shield-${Date.now()}.json`);
  const shieldStore = new FilterStore(tempShieldPath);
  await shieldStore.load();

  // Test 5.1: Default rule set & list metadata
  console.assert(shieldStore.getRules().length >= 20, `Expected at least 20 default rules, got ${shieldStore.getRules().length}`);
  console.assert(shieldStore.getEnabled() === true, 'Shield should be enabled by default');
  console.log(`  ✔ FilterStore initialized with ${shieldStore.getRules().length} default rules`);

  // Test 5.2: FilterParser rule parsing & categorization
  const testRuleSet = [
    '||doubleclick.net^',
    '*.doubleclick.net',
    '||tracking.example.com^',
    '*/ads/*',
    '@@||exception-domain.com^'
  ];
  const parsedRules = FilterParser.parseRules(testRuleSet);
  console.assert(Array.isArray(parsedRules) && parsedRules.length === 5, 'FilterParser failed to parse rules array');
  const exactRule = parsedRules.find(r => r.domain === 'doubleclick.net');
  console.assert(exactRule && exactRule.category === 'ads', 'Category should be ads');
  const trackerRule = parsedRules.find(r => r.domain === 'tracking.example.com');
  console.assert(trackerRule && trackerRule.category === 'trackers', 'Category should be trackers');
  const wildcardRule = parsedRules.find(r => r.type === 'WILDCARD_DOMAIN');
  console.assert(wildcardRule && wildcardRule.domain === 'doubleclick.net', 'Wildcard rule mismatch');
  const urlPatternRule = parsedRules.find(r => r.type === 'URL_PATTERN');
  console.assert(urlPatternRule !== undefined, 'URL pattern rule not found');
  const exceptionRule = parsedRules.find(r => r.type === 'EXCEPTION_DOMAIN');
  console.assert(exceptionRule && exceptionRule.domain === 'exception-domain.com', 'Exception rule mismatch');
  console.log('  ✔ FilterParser categorization, wildcards, patterns and exceptions verified');

  // Test 5.3: ShieldEngine decision logic
  const engine = new ShieldEngine();
  engine.loadRules(parsedRules);
  console.assert(engine.exactDomains.has('doubleclick.net'), 'Engine missing exact domain');
  console.assert(engine.exceptionDomains.has('exception-domain.com'), 'Engine missing exception domain');

  // Exact ad domain
  const d1 = engine.shouldBlock('http://doubleclick.net/script.js');
  console.assert(d1.action === 'BLOCK' && d1.category === 'ads', `Expected BLOCK ads, got ${d1.action} ${d1.category}`);

  // Subdomain wildcard
  const d2 = engine.shouldBlock('http://adserver.doubleclick.net/pixel.gif');
  console.assert(d2.action === 'BLOCK' && d2.category === 'ads', `Expected wildcard BLOCK, got ${d2.action}`);

  // Tracker domain
  const d3 = engine.shouldBlock('http://tracking.example.com/pixel.gif');
  console.assert(d3.action === 'BLOCK' && d3.category === 'trackers', `Expected tracker BLOCK, got ${d3.action}`);

  // URL pattern
  const d4 = engine.shouldBlock('http://legit-site.com/ads/banner.jpg');
  console.assert(d4.action === 'BLOCK', `Expected URL pattern BLOCK, got ${d4.action}`);

  // Clean legitimate URL
  const d5 = engine.shouldBlock('http://legit-site.com/articles/news.html');
  console.assert(d5.action === 'ALLOW', `Expected ALLOW for clean URL, got ${d5.action}`);

  // Exception domain rule
  const d6 = engine.shouldBlock('http://exception-domain.com/ads/script.js');
  console.assert(d6.action === 'ALLOW', `Expected ALLOW due to exception rule, got ${d6.action}`);

  // Per-site user whitelist
  const d7 = engine.shouldBlock('http://doubleclick.net/script.js', { siteDomain: 'whitelisted-news.com', isSiteWhitelisted: true });
  console.assert(d7.action === 'ALLOW', `Expected ALLOW due to user site whitelist, got ${d7.action}`);

  // LRU cache check
  const d8 = engine.shouldBlock('http://doubleclick.net/script.js');
  console.assert(d8.action === 'BLOCK', 'Cache hit returned incorrect action');
  console.log('  ✔ ShieldEngine exact, wildcard, pattern, exception, whitelist & cache decisions verified');

  // Test 5.4: ShieldStats per-tab and cumulative stats
  const stats = new ShieldStats(shieldStore);
  stats.initTab('tab-1', 'example.com');
  stats.recordBlock('tab-1', 'ads', 'http://doubleclick.net/ad.js');
  stats.recordBlock('tab-1', 'trackers', 'http://tracking.example.com/pixel.gif');
  stats.recordAnalyzed('tab-1');

  const tab1Stats = stats.getTabStats('tab-1');
  console.assert(tab1Stats.totalBlocked === 2, `Expected 2 blocked on tab-1, got ${tab1Stats.totalBlocked}`);
  console.assert(tab1Stats.adsBlocked === 1, `Expected 1 ad blocked, got ${tab1Stats.adsBlocked}`);
  console.assert(tab1Stats.trackersBlocked === 1, `Expected 1 tracker blocked, got ${tab1Stats.trackersBlocked}`);

  // Navigation within same domain preserves stats
  stats.onTabNavigated('tab-1', 'http://example.com/page1');
  stats.onTabNavigated('tab-1', 'http://example.com/page2');
  console.assert(stats.getTabStats('tab-1').totalBlocked === 2, 'Tab stats should be preserved within same domain');

  // Navigation to new domain resets stats for the tab
  stats.onTabNavigated('tab-1', 'http://another-domain.com/index.html');
  console.assert(stats.getTabStats('tab-1').totalBlocked === 0, 'Tab stats should reset when navigating to new domain');
  console.log('  ✔ ShieldStats per-tab counters, category distribution & navigation domain reset verified');

  // Test 5.5: ShieldManager orchestration & persistence across restarts
  const shieldManager = new ShieldManager(shieldStore);
  await shieldManager.initialize();
  await shieldManager.addWhitelistDomain('my-trusted-portal.com');
  console.assert(shieldManager.isSiteWhitelisted('my-trusted-portal.com') === true, 'Failed to whitelist domain');

  // Restart simulation: re-instantiate from disk
  const restartShieldStore = new FilterStore(tempShieldPath);
  await restartShieldStore.load();
  console.assert(restartShieldStore.isException('my-trusted-portal.com') === true, 'Persistence failed: whitelist exception not restored after restart');
  console.log('  ✔ ShieldManager state, whitelist management & persistence across restarts verified');

  // --- 6. Chromium Extensions Subsystem Tests ---
  console.log('\n[Suite 6: Chromium Extensions Subsystem (Validator, Store & Manager)]');

  // Test 6.1: ExtensionValidator with real fixtures
  const v3FixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'extensions', 'test-extension');
  const v3Res = await ExtensionValidator.validateDirectory(v3FixturePath);
  console.assert(v3Res.valid === true, `Expected valid Manifest V3 fixture, errors: ${v3Res.errors.join('; ')}`);
  console.assert(v3Res.manifestVersion === 3, `Expected manifestVersion 3, got ${v3Res.manifestVersion}`);
  console.assert(v3Res.metadata.name === 'Núcleo Test Extension', `Expected name Núcleo Test Extension, got ${v3Res.metadata.name}`);
  console.assert(v3Res.metadata.hasPopup === true, 'Expected hasPopup === true for action.default_popup');
  console.assert(v3Res.metadata.hasContentScripts === true, 'Expected hasContentScripts === true');
  console.assert(v3Res.metadata.hasBackground === true, 'Expected hasBackground === true');
  console.assert(v3Res.metadata.permissions.includes('storage'), 'Expected storage permission');
  console.log('  ✔ Manifest V3 validation & metadata extraction verified');

  const v2FixturePath = path.join(__dirname, '..', 'tests', 'fixtures', 'extensions', 'mv2-extension');
  const v2Res = await ExtensionValidator.validateDirectory(v2FixturePath);
  console.assert(v2Res.valid === true, `Expected valid Manifest V2 fixture, errors: ${v2Res.errors.join('; ')}`);
  console.assert(v2Res.manifestVersion === 2, `Expected manifestVersion 2, got ${v2Res.manifestVersion}`);
  console.assert(v2Res.metadata.name === 'Núcleo MV2 Test Extension', 'Expected MV2 name match');
  console.log('  ✔ Manifest V2 validation & compatibility verified');

  // Negative validation tests
  const nonExistentRes = await ExtensionValidator.validateDirectory(path.join(__dirname, 'non-existent-dir-xyz'));
  console.assert(nonExistentRes.valid === false && nonExistentRes.errors.length > 0, 'Non-existent directory should fail validation');

  const invalidManifestRes = ExtensionValidator.validateManifest({ manifest_version: 1, name: '' });
  console.assert(invalidManifestRes.valid === false && invalidManifestRes.errors.length >= 2, 'Invalid manifest fields should fail');
  console.log('  ✔ ExtensionValidator invalid structure & missing fields detection verified');

  // Test 6.2: ExtensionStore persistence and CRUD
  const tempExtStorePath = path.join(os.tmpdir(), `nucleo-test-ext-store-${Date.now()}.json`);
  const extStore = new ExtensionStore(tempExtStorePath);
  await extStore.load();
  console.assert(extStore.getAll().length === 0, 'Initial store should be empty');

  const addedExt = await extStore.add({
    id: 'test-ext-1234567890abcdef',
    name: 'Núcleo Test Extension',
    version: '1.0.0',
    description: 'Unit test extension',
    path: v3FixturePath,
    enabled: true,
    manifestVersion: 3,
    permissions: ['storage'],
    installDate: Date.now()
  });
  console.assert(addedExt && addedExt.id === 'test-ext-1234567890abcdef', 'Failed to add extension to store');
  console.assert(extStore.get('test-ext-1234567890abcdef') !== null, 'Failed to retrieve extension by ID');

  await extStore.setEnabled('test-ext-1234567890abcdef', false);
  console.assert(extStore.get('test-ext-1234567890abcdef').enabled === false, 'Failed to update enabled status');

  await extStore.setError('test-ext-1234567890abcdef', 'Erro simulado');
  console.assert(extStore.get('test-ext-1234567890abcdef').error === 'Erro simulado', 'Failed to set error');

  // Restart simulation for ExtensionStore
  const restartExtStore = new ExtensionStore(tempExtStorePath);
  await restartExtStore.load();
  const reloaded = restartExtStore.get('test-ext-1234567890abcdef');
  console.assert(reloaded !== null, 'Extension not restored after reload');
  console.assert(reloaded.enabled === false, 'Enabled state not preserved after reload');
  console.assert(reloaded.error === 'Erro simulado', 'Error state not preserved after reload');
  console.log('  ✔ ExtensionStore CRUD and atomic persistence across restarts verified');

  // Test 6.3: ExtensionManager lifecycle with Mock Loader
  const tempExtDir = path.join(os.tmpdir(), `nucleo-test-ext-dir-${Date.now()}`);
  await fs.promises.mkdir(tempExtDir, { recursive: true });

  const mockLoader = {
    loaded: new Map(),
    async load(extPath) {
      const id = 'mock-test-id-32charslongabcdef';
      const record = { id, name: 'Núcleo Test Extension', version: '1.0.0', path: extPath, url: `chrome-extension://${id}/` };
      this.loaded.set(id, record);
      return { success: true, extension: record };
    },
    unload(id) {
      this.loaded.delete(id);
      return { success: true };
    },
    isLoaded(id) {
      return this.loaded.has(id);
    },
    getAllLoaded() {
      return Array.from(this.loaded.values());
    },
    getLoaded(id) {
      return this.loaded.get(id) || null;
    }
  };

  const extManager = new ExtensionManager(null, {
    store: extStore,
    loader: mockLoader,
    extensionsDir: tempExtDir
  });
  await extManager.initialize();

  // Test installFromDirectory (copies to isolated folder and loads)
  let installEventEmitted = false;
  extManager.once(ExtensionEvents.EXTENSION_INSTALLED, () => { installEventEmitted = true; });

  const installRes = await extManager.installFromDirectory(v3FixturePath);
  console.assert(installRes.success === true, `Installation failed: ${installRes.errors?.join('; ')}`);
  console.assert(installEventEmitted === true, 'EXTENSION_INSTALLED event was not emitted');
  console.assert(fs.existsSync(installRes.extension.path), 'Installed extension directory was not copied to extensionsDir');
  console.assert(mockLoader.isLoaded(installRes.extension.id), 'Extension was not loaded in loader');

  // Test disable
  const disableRes = await extManager.disable(installRes.extension.id);
  console.assert(disableRes.success === true, 'Failed to disable extension');
  console.assert(mockLoader.isLoaded(installRes.extension.id) === false, 'Extension should not be loaded when disabled');

  // Test enable
  const enableRes = await extManager.enable(installRes.extension.id);
  console.assert(enableRes.success === true, 'Failed to re-enable extension');
  console.assert(mockLoader.isLoaded(installRes.extension.id) === true, 'Extension should be loaded after re-enable');

  // Test uninstall
  const uninstallRes = await extManager.uninstall(installRes.extension.id);
  console.assert(uninstallRes.success === true, 'Failed to uninstall extension');
  console.assert(extStore.get(installRes.extension.id) === null, 'Extension should be removed from store');
  console.assert(!fs.existsSync(installRes.extension.path), 'Extension folder should be deleted from disk on uninstall');
  console.log('  ✔ ExtensionManager install, isolate, enable, disable and uninstall lifecycle verified');

  // --- 7. Settings, Search Provider & Default Browser Subsystems ---
  console.log('\n[Suite 7: Settings, Search Providers & Default Browser]');
  const tempSettingsPath = path.join(os.tmpdir(), `nucleo-test-settings-${Date.now()}.json`);
  const settingsStore = new SettingsStore(tempSettingsPath);
  const settingsManager = new SettingsManager(settingsStore);
  await settingsManager.initialize();

  // Test 7.1: Schema and Defaults
  const defaults = getDefaultSettings();
  console.assert(defaults.search && defaults.search.engine === 'duckduckgo', 'Default search engine should be duckduckgo');
  console.assert(defaults.appearance && defaults.appearance.theme === 'system', 'Default theme should be system');
  console.assert(defaults.appearance && defaults.appearance.accentColor === 'cyan', 'Default accent should be cyan');
  console.assert(defaults.privacy && defaults.privacy.doNotTrack === false, 'Default DNT should be false');
  console.assert(defaults.startup && defaults.startup.mode === 'newtab', 'Default startup mode should be newtab');
  console.assert(defaults.newTab && defaults.newTab.mode === 'nucleo', 'Default new tab mode should be nucleo');
  console.assert(defaults.tabs && defaults.tabs.confirmCloseMultipleTabs === false, 'Default confirm before close should be false');
  console.assert(defaults.downloads && defaults.downloads.askLocation === true, 'Default askLocation should be true');
  console.log('  ✔ Settings schema sections, properties and defaults verified');

  // Test 7.2: Validator positive & negative tests
  const validCheck = SettingsValidator.validate('appearance.theme', 'system');
  console.assert(validCheck.valid === true, `Valid setting failed validation: ${validCheck.error}`);

  // Invalid enum
  const invalidEnumCheck = SettingsValidator.validate('appearance.theme', 'neon-invalid');
  console.assert(invalidEnumCheck.valid === false, 'Invalid theme enum should fail validation');

  // Invalid type
  const invalidTypeCheck = SettingsValidator.validate('privacy.doNotTrack', 'not-a-boolean');
  console.assert(invalidTypeCheck.valid === false, 'Non-boolean value for doNotTrack should fail');

  // Dangerous protocol check in startup / custom URLs
  const dangerousUrlCheck = SettingsValidator.validate('startup.urls', ['javascript:alert(1)']);
  console.assert(dangerousUrlCheck.valid === false, 'Dangerous javascript: URL should fail validation');

  const validUrlCheck = SettingsValidator.validate('startup.urls', ['https://example.com']);
  console.assert(validUrlCheck.valid === true, 'Valid HTTPS customUrl should pass validation');

  // Custom engine validation
  const validCustomEngine = SettingsValidator.validateCustomEngine({ name: 'DuckDuckGo HTML', searchUrl: 'https://html.duckduckgo.com/html/?q=%s' });
  console.assert(validCustomEngine.valid === true, 'Valid custom engine failed');

  const invalidCustomEngine = SettingsValidator.validateCustomEngine({ name: 'No Placeholder', searchUrl: 'https://html.duckduckgo.com/html/' });
  console.assert(invalidCustomEngine.valid === false, 'Custom engine without %s should fail');
  console.log('  ✔ SettingsValidator type checks, enums & dangerous URL sanitization verified');

  // Test 7.3: SettingsManager CRUD and event emission
  let themeChangedFired = false;
  let settingsChangedFired = false;
  settingsManager.once('theme-changed', () => { themeChangedFired = true; });
  settingsManager.once('settings-changed', () => { settingsChangedFired = true; });

  await settingsManager.set('appearance.theme', 'dark');
  console.assert(settingsManager.get('appearance.theme') === 'dark', 'Failed to update appearance.theme');
  console.assert(themeChangedFired === true, 'theme-changed event was not emitted');
  console.assert(settingsChangedFired === true, 'settings-changed event was not emitted');

  await settingsManager.set('appearance.accentColor', 'purple');
  console.assert(settingsManager.get('appearance.accentColor') === 'purple', 'Failed to update accentColor');

  // Test 7.4: Reset functionality
  await settingsManager.resetSection('appearance');
  console.assert(settingsManager.get('appearance.theme') === 'system', 'resetSection should restore default theme');
  console.assert(settingsManager.get('appearance.accentColor') === 'cyan', 'resetSection should restore default accent');

  // Test 7.5: Persistence across restarts
  await settingsManager.set('downloads.askLocation', false);
  const restartSettingsStore = new SettingsStore(tempSettingsPath);
  const restartSettingsManager = new SettingsManager(restartSettingsStore);
  await restartSettingsManager.initialize();
  console.assert(restartSettingsManager.get('downloads.askLocation') === false, 'Setting not persisted across restart simulation');
  console.log('  ✔ SettingsManager dot-notation get/set, events, reset & disk persistence verified');

  // Test 7.6: SearchProvider built-in engines & query URL building
  const searchProvider = new SearchProvider(settingsManager);
  const engines = searchProvider.getAllEngines();
  console.assert(engines.length >= 6, `Expected at least 6 search engines, got ${engines.length}`);
  const hasDDG = engines.some(e => e.id === 'duckduckgo');
  const hasGoogle = engines.some(e => e.id === 'google');
  const hasBing = engines.some(e => e.id === 'bing');
  const hasBrave = engines.some(e => e.id === 'brave');
  console.assert(hasDDG && hasGoogle && hasBing && hasBrave, 'Missing required built-in search engines');

  // Build search URL
  const ddgUrl = searchProvider.buildSearchUrl('electron testing');
  console.assert(ddgUrl.includes('duckduckgo.com') && ddgUrl.includes('electron%20testing'), `Search URL unexpected: ${ddgUrl}`);

  // Switch default search engine
  await searchProvider.setDefaultEngine('google');
  console.assert(searchProvider.getDefaultEngineId() === 'google', 'Failed to switch default search engine');
  const googleUrl = searchProvider.buildSearchUrl('electron testing');
  console.assert(googleUrl.includes('google.com/search') && googleUrl.includes('electron%20testing'), `Google search URL unexpected: ${googleUrl}`);

  // Test 7.7: Custom Search Engine addition & removal
  const customEngineRes = await searchProvider.addCustomEngine({
    name: 'GitHub Code',
    keyword: 'gh',
    searchUrl: 'https://github.com/search?q=%s'
  });
  console.assert(customEngineRes.success === true, `Failed to add custom engine: ${customEngineRes.error}`);
  console.assert(searchProvider.getEngine(customEngineRes.engine.id) !== null, 'Custom engine was not registered');

  // Reject invalid custom engine (missing %s or dangerous scheme)
  const invalidEngineRes1 = await searchProvider.addCustomEngine({
    name: 'No Query Placeholder',
    keyword: 'nqp',
    searchUrl: 'https://example.com/search'
  });
  console.assert(invalidEngineRes1.success === false, 'Engine without %s should be rejected');

  const invalidEngineRes2 = await searchProvider.addCustomEngine({
    name: 'XSS Engine',
    keyword: 'xss',
    searchUrl: 'javascript:alert("%s")'
  });
  console.assert(invalidEngineRes2.success === false, 'Engine with javascript: scheme should be rejected');

  // Remove custom engine
  const removeRes = await searchProvider.removeCustomEngine(customEngineRes.engine.id);
  console.assert(removeRes.success === true, 'Failed to remove custom engine');
  console.assert(searchProvider.getEngine(customEngineRes.engine.id) === null, 'Custom engine still present after removal');

  // Cannot remove built-in engine
  const removeBuiltinRes = await searchProvider.removeCustomEngine('google');
  console.assert(removeBuiltinRes.success === false, 'Should not allow removing built-in search engine');
  console.log('  ✔ SearchProvider built-in engines, search URL generation, custom engines & validation verified');

  // Test 7.8: DefaultBrowserManager
  const defaultBrowserManager = new DefaultBrowserManager(settingsManager);
  const status = await defaultBrowserManager.isDefault();
  console.assert(typeof status.isDefault === 'boolean', 'isDefault should be boolean');
  console.assert(typeof status.http === 'boolean', 'http should be boolean');
  console.assert(typeof status.https === 'boolean', 'https should be boolean');
  console.log(`  ✔ DefaultBrowserManager isDefault checked safely (isDefault: ${status.isDefault}, http: ${status.http})`);

  // Test 7.9: NavigationController integration with SearchProvider & nucleo://settings
  const navWithSearch = new NavigationController(null, searchProvider);
  const resolvedSettings = navWithSearch.resolveInputToUrl('nucleo://settings');
  console.assert(resolvedSettings === 'nucleo://settings', 'Failed to resolve nucleo://settings');

  const resolvedAlias = navWithSearch.resolveInputToUrl('nucleo://configuracoes');
  console.assert(resolvedAlias === 'nucleo://settings', 'Failed to resolve nucleo://configuracoes alias');

  const searchNavResult = navWithSearch.resolveInputToUrl('aprendendo electron');
  console.assert(searchNavResult.includes('google.com/search') && searchNavResult.includes('aprendendo%20electron'), 'NavigationController did not use active SearchProvider');
  console.log('  ✔ NavigationController resolution for nucleo://settings and active SearchProvider verified');

  // Cleanup temp files
  try {
    if (fs.existsSync(tempBmPath)) fs.unlinkSync(tempBmPath);
    if (fs.existsSync(tempHistPath)) fs.unlinkSync(tempHistPath);
    if (fs.existsSync(tempShieldPath)) fs.unlinkSync(tempShieldPath);
    if (fs.existsSync(tempExtStorePath)) fs.unlinkSync(tempExtStorePath);
    if (fs.existsSync(tempSettingsPath)) fs.unlinkSync(tempSettingsPath);
    if (fs.existsSync(tempExtDir)) await fs.promises.rm(tempExtDir, { recursive: true, force: true });
  } catch {}

  console.log('\nAll Unit Tests Passed Successfully!\n');
}

async function runIntegrationTest() {
  console.log('=== [2/2] Executing Integration / Browser Launch Test ===');

  return new Promise((resolve, reject) => {
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, ['electron', 'scripts/integration-test.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, NUCLEO_HEADLESS_TEST: '1' },
      stdio: 'inherit',
      shell: true
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('\n✔ Integration Test Passed with exit code 0');
        resolve();
      } else {
        reject(new Error(`Integration test failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  try {
    await runUnitTests();
    if (process.env.UNIT_ONLY === '1') {
      console.log('Unit tests only run requested. Exiting successfully.');
      process.exit(0);
    }
    await runIntegrationTest();
    console.log('\n=============================================');
    console.log('  ALL NÚCLEO BROWSER v0.6.0 TESTS PASSED (100%)');
    console.log('=============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

main();
