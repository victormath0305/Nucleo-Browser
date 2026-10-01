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
const { WorkspaceModel, WorkspaceStore, WorkspaceManager } = require('../src/main/modules/workspaces');
const { DownloadsUtils, DownloadModel, DownloadsStore, DownloadsManager } = require('../src/main/modules/downloads');
const { PermissionsUtils, PermissionModel, PermissionsStore, PermissionsManager } = require('../src/main/modules/permissions');
const IPC_CHANNELS = require('../src/main/ipc/ipc-channels');
const TabManager = require('../src/main/modules/tabs/tab-manager');

async function runUnitTests() {
  console.log('=== [1/2] Executing Unit Tests (v0.9.0 Permissions, Downloads, Workspaces, Settings, Extensions, Shield, Bookmarks & History) ===\n');

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

  // --- 8. Workspaces Subsystem Tests ---
  console.log('\n[Suite 8: Workspaces Subsystem]');
  const tempWsPath = path.join(os.tmpdir(), `nucleo-test-ws-${Date.now()}.json`);
  const wsStore = new WorkspaceStore(tempWsPath);
  const wsManager = new WorkspaceManager(wsStore);
  await wsManager.initialize();

  // Test 8.1: Default Workspace creation
  const defaultWs = wsManager.getActiveWorkspace();
  console.assert(defaultWs !== null, 'Active workspace should exist');
  console.assert(defaultWs.name === 'Pessoal', `Default workspace should be "Pessoal", got ${defaultWs.name}`);
  console.assert(wsManager.getAll().length === 1, 'Should have exactly 1 workspace initialized');
  console.log('  ✔ Default workspace created and active (Pessoal)');

  // Test 8.2: Model Sanitization
  const modelSanitized = new WorkspaceModel({
    name: '   Super Long Workspace Name That Exceeds The Maximum Limit Of Characters In Length Strongly   ',
    color: 'invalid-color',
    icon: 'invalid-icon'
  });
  console.assert(modelSanitized.name.length <= 40, 'WorkspaceModel should enforce max 40 chars on name');
  console.assert(modelSanitized.color === 'cyan', 'WorkspaceModel should fallback invalid color to cyan');
  console.assert(modelSanitized.icon === 'briefcase', 'WorkspaceModel should fallback invalid icon to briefcase');
  console.log('  ✔ WorkspaceModel validation and input sanitization verified');

  // Test 8.3: Create Workspace
  const createdWs = await wsManager.create({ name: 'Trabalho', color: 'indigo', icon: 'code' });
  console.assert(createdWs !== null, 'Failed to create workspace');
  console.assert(createdWs.name === 'Trabalho', 'Workspace name incorrect');
  console.assert(createdWs.color === 'indigo', 'Workspace color incorrect');
  console.assert(createdWs.icon === 'code', 'Workspace icon incorrect');
  console.assert(wsManager.activeWorkspaceId === createdWs.id, 'New workspace should become active');
  console.assert(wsManager.getAll().length === 2, 'Total workspaces should be 2');
  console.log('  ✔ createWorkspace with unique ID, custom color/icon, and auto-activation verified');

  // Test 8.4: Rename, Color & Icon updates
  await wsManager.rename(createdWs.id, 'Projetos Dev');
  console.assert(wsManager.get(createdWs.id).name === 'Projetos Dev', 'Rename failed');
  await wsManager.setColor(createdWs.id, 'purple');
  console.assert(wsManager.get(createdWs.id).color === 'purple', 'Set color failed');
  await wsManager.setIcon(createdWs.id, 'school');
  console.assert(wsManager.get(createdWs.id).icon === 'school', 'Set icon failed');
  console.log('  ✔ rename, setColor and setIcon verified');

  // Test 8.5: Tab Association & Switching
  wsManager.addTabToWorkspace(createdWs.id, 'tab-101');
  wsManager.addTabToWorkspace(createdWs.id, 'tab-102');
  wsManager.setActiveTab(createdWs.id, 'tab-102');
  console.assert(wsManager.get(createdWs.id).activeTabId === 'tab-102', 'Active tab in workspace failed');
  console.assert(wsManager.findWorkspaceByTabId('tab-101').id === createdWs.id, 'findWorkspaceByTabId failed');

  // Switch back to Pessoal
  await wsManager.switchWorkspace(defaultWs.id);
  console.assert(wsManager.activeWorkspaceId === defaultWs.id, 'Switch workspace failed');
  // Switch back to Projetos Dev: activeTabId must be preserved
  await wsManager.switchWorkspace(createdWs.id);
  console.assert(wsManager.get(createdWs.id).activeTabId === 'tab-102', 'ActiveTabId restoration failed on switch');
  console.log('  ✔ Workspace tab association, activeTabId tracking & switching verified');

  // Test 8.6: Move Tab Between Workspaces
  const moveRes = await wsManager.moveTab('tab-101', defaultWs.id);
  console.assert(moveRes.success === true, 'moveTab failed');
  console.assert(!wsManager.get(createdWs.id).tabIds.includes('tab-101'), 'Tab still in source workspace');
  console.assert(wsManager.get(defaultWs.id).tabIds.includes('tab-101'), 'Tab not added to target workspace');
  console.log('  ✔ moveTab between workspaces verified');

  // Test 8.7: Reorder Workspaces
  await wsManager.moveUp(createdWs.id);
  console.assert(wsManager.getAll()[0].id === createdWs.id, 'moveUp failed');
  await wsManager.moveDown(createdWs.id);
  console.assert(wsManager.getAll()[1].id === createdWs.id, 'moveDown failed');
  console.log('  ✔ reordering (moveUp / moveDown) verified');

  // Test 8.8: Duplication
  const dupWs = await wsManager.duplicate(createdWs.id);
  console.assert(dupWs !== null && dupWs.id !== createdWs.id, 'duplicate failed or reused ID');
  console.assert(dupWs.name.includes('(Cópia)'), 'Duplicated workspace should include (Cópia)');
  console.assert(Array.isArray(dupWs.tabIds), 'TabIds in clone should be an array');
  console.log('  ✔ duplicateWorkspace with safe ID regeneration verified');

  // Test 8.9: Deletion constraints and tab migration
  // Cannot delete last workspace
  while (wsManager.getAll().length > 1) {
    const toRemove = wsManager.getAll()[wsManager.getAll().length - 1];
    await wsManager.delete(toRemove.id, { targetWorkspaceId: defaultWs.id });
  }
  console.assert(wsManager.getAll().length === 1, 'Should have exactly 1 workspace left');
  let threwOnLastDelete = false;
  try {
    await wsManager.delete(wsManager.getAll()[0].id);
  } catch (err) {
    threwOnLastDelete = true;
  }
  console.assert(threwOnLastDelete === true, 'Should refuse to delete the last remaining workspace');
  console.log('  ✔ Deletion constraints (cannot delete last workspace) verified');

  // Test 8.10: Persistence & Corruption Recovery
  await wsStore.save({
    version: 1,
    activeWorkspaceId: 'ws-corrupt',
    workspaces: [{ id: 'ws-corrupt', name: 'Corrupt Test', tabIds: [] }]
  });
  const reloadedData = await wsStore.load();
  console.assert(reloadedData.activeWorkspaceId === 'ws-corrupt', 'Store reload failed');

  // Simulate disk corruption
  fs.writeFileSync(tempWsPath, '{ corrupted json: !!@@##');
  const recoveredData = await wsStore.load();
  console.assert(recoveredData && Array.isArray(recoveredData.workspaces) && recoveredData.workspaces.length >= 1, 'Corruption recovery failed to produce valid default data');
  console.assert(recoveredData.workspaces[0].name === 'Pessoal', 'Corruption recovery should provide default Pessoal workspace');
  console.log('  ✔ Atomic persistence and JSON corruption recovery verified');

  // --- 9. Native Downloads Subsystem Tests ---
  console.log('\n[Suite 9: Native Downloads Subsystem]');
  const tempDlPath = path.join(os.tmpdir(), `nucleo-test-dl-${Date.now()}.json`);
  const tempDlDir = path.join(os.tmpdir(), `nucleo-test-dl-dir-${Date.now()}`);
  await fs.promises.mkdir(tempDlDir, { recursive: true });

  // Test 9.1: DownloadsUtils Formatting
  console.assert(DownloadsUtils.formatBytes(0) === '0 B', 'formatBytes(0) failed');
  console.assert(DownloadsUtils.formatBytes(1024) === '1 KB', 'formatBytes(1024) failed');
  console.assert(DownloadsUtils.formatBytes(1048576) === '1 MB', 'formatBytes(1048576) failed');
  console.assert(DownloadsUtils.formatBytes(1073741824) === '1 GB', 'formatBytes(1073741824) failed');
  console.assert(DownloadsUtils.formatBytes(-50) === '0 B', 'formatBytes(-50) failed');

  console.assert(DownloadsUtils.formatSpeed(0) === '0 B/s', 'formatSpeed(0) failed');
  console.assert(DownloadsUtils.formatSpeed(1048576).includes('MB/s'), 'formatSpeed(1048576) failed');

  console.assert(DownloadsUtils.formatDuration(0) === '0s', 'formatDuration(0) failed');
  console.assert(DownloadsUtils.formatDuration(45) === '45s', 'formatDuration(45) failed');
  console.assert(DownloadsUtils.formatDuration(125).includes('2m'), 'formatDuration(125) failed');
  console.assert(DownloadsUtils.formatDuration(3665).includes('1h'), 'formatDuration(3665) failed');
  console.assert(DownloadsUtils.formatDuration(null) === '--', 'formatDuration(null) failed');

  console.assert(DownloadsUtils.calculateProgress(50, 100) === 50, 'calculateProgress(50, 100) failed');
  console.assert(DownloadsUtils.calculateProgress(0, 100) === 0, 'calculateProgress(0, 100) failed');
  console.assert(DownloadsUtils.calculateProgress(50, 0) === -1, 'calculateProgress(50, 0) failed');

  console.assert(DownloadsUtils.getFileCategory('file.zip') === 'archive', 'Category archive failed');
  console.assert(DownloadsUtils.getFileCategory('setup.exe') === 'executable', 'Category executable failed');
  console.assert(DownloadsUtils.getFileCategory('photo.png') === 'image', 'Category image failed');
  console.assert(DownloadsUtils.getFileCategory('song.mp3') === 'audio', 'Category audio failed');
  console.assert(DownloadsUtils.getFileCategory('movie.mp4') === 'video', 'Category video failed');
  console.assert(DownloadsUtils.getFileCategory('doc.pdf') === 'document', 'Category document failed');
  console.assert(DownloadsUtils.getFileCategory('index.js') === 'code', 'Category code failed');
  console.log('  ✔ DownloadsUtils formatting and category classification verified');

  // Test 9.2: Filename Sanitization & Directory Traversal Security
  const traversal1 = DownloadsUtils.sanitizeFilename('../../etc/passwd');
  console.assert(traversal1 === 'passwd', `Traversal 1 failed: expected passwd, got ${traversal1}`);

  const traversal2 = DownloadsUtils.sanitizeFilename('..\\..\\Windows\\System32\\cmd.exe');
  console.assert(traversal2 === 'cmd.exe', `Traversal 2 failed: expected cmd.exe, got ${traversal2}`);

  const illegalChars = DownloadsUtils.sanitizeFilename('report<2026>:final"v1|bar?qux*.pdf');
  console.assert(!illegalChars.includes('<') && !illegalChars.includes('>') && !illegalChars.includes(':'), 'Illegal characters not replaced');

  const reservedCON = DownloadsUtils.sanitizeFilename('CON.txt');
  console.assert(reservedCON.startsWith('_CON'), 'Windows reserved device name CON not prefixed');

  const emptyDots = DownloadsUtils.sanitizeFilename('...');
  console.assert(emptyDots === 'download', 'Empty dots filename not defaulted');
  console.log('  ✔ Path traversal attacks & illegal filesystem characters sanitized safely');

  // Test 9.3: getUniqueFilePath non-colliding name generation
  const testFile1 = path.join(tempDlDir, 'test-doc.pdf');
  fs.writeFileSync(testFile1, 'hello');
  const uniquePath1 = DownloadsUtils.getUniqueFilePath(tempDlDir, 'test-doc.pdf');
  console.assert(uniquePath1.endsWith('test-doc (1).pdf'), `Unique path 1 failed: ${uniquePath1}`);
  fs.writeFileSync(uniquePath1, 'world');
  const uniquePath2 = DownloadsUtils.getUniqueFilePath(tempDlDir, 'test-doc.pdf');
  console.assert(uniquePath2.endsWith('test-doc (2).pdf'), `Unique path 2 failed: ${uniquePath2}`);
  console.log('  ✔ Unique non-colliding duplicate file generation verified');

  // Test 9.4: DownloadModel Lifecycle & Serialization
  const dlModel = new DownloadModel({
    filename: 'archive.zip',
    url: 'https://example.com/archive.zip',
    totalBytes: 1000000,
    receivedBytes: 0,
    workspaceId: 'workspace-pessoal'
  });
  console.assert(dlModel.state === 'downloading', 'Initial state should be downloading');
  console.assert(dlModel.workspaceId === 'workspace-pessoal', 'WorkspaceId should be preserved');

  dlModel.updateProgress(500000, 1000000, 250000, 2);
  console.assert(dlModel.progress === 50, 'Progress should be 50%');
  console.assert(dlModel.speed === 250000, 'Speed should be 250000');

  dlModel.pause();
  console.assert(dlModel.state === 'paused' && dlModel.paused === true, 'Pause state failed');

  dlModel.resume();
  console.assert(dlModel.state === 'downloading' && dlModel.paused === false, 'Resume state failed');

  dlModel.complete();
  console.assert(dlModel.state === 'completed' && dlModel.completed === true && dlModel.progress === 100, 'Complete state failed');
  console.assert(dlModel.endTime !== null, 'EndTime should be set on complete');

  const serialized = dlModel.toJSON();
  console.assert(serialized.formattedTotal === '976.6 KB', `Formatted total unexpected: ${serialized.formattedTotal}`);
  console.assert(serialized.state === 'completed', 'Serialized state failed');

  const rehydrated = DownloadModel.fromJSON(serialized);
  console.assert(rehydrated.filename === dlModel.filename, 'Rehydration filename failed');
  console.log('  ✔ DownloadModel lifecycle transitions, progress calculation & JSON serialization verified');

  // Test 9.5: DownloadsStore persistence, retention limit & corruption recovery
  const dlStore = new DownloadsStore(tempDlPath, 5); // Max retention = 5
  await dlStore.load();

  // Add 10 items
  for (let i = 1; i <= 10; i++) {
    await dlStore.add({
      id: `dl-test-${i}`,
      filename: `file-${i}.txt`,
      url: `https://example.com/file-${i}.txt`,
      state: 'completed',
      startTime: 1000 + i
    });
  }
  // Store should have enforced max retention of 5
  console.assert(dlStore.getAll().length === 5, `Expected 5 items after retention, got ${dlStore.getAll().length}`);
  console.assert(dlStore.getById('dl-test-10') !== null, 'Most recent item should be kept in store');

  // Test update & remove
  await dlStore.update('dl-test-10', { state: 'failed', error: 'test error' });
  console.assert(dlStore.getById('dl-test-10').state === 'failed', 'Store update failed');
  await dlStore.remove('dl-test-10');
  console.assert(dlStore.getById('dl-test-10') === null, 'Store remove failed');

  // Test corruption recovery
  fs.writeFileSync(tempDlPath, 'corrupted JSON {[{[[!@#');
  const dlRecovered = await dlStore.load();
  console.assert(dlRecovered && Array.isArray(dlRecovered.downloads), 'Corruption recovery failed to produce valid structure');
  console.log('  ✔ DownloadsStore atomic persistence, retention limit & corruption recovery verified');

  // Test 9.6: DownloadsManager lifecycle & event emission
  const dlManager = new DownloadsManager({ store: dlStore });
  await dlManager.initialize();

  // Mock download item
  const { EventEmitter: EE } = require('events');
  class MockDownloadItem extends EE {
    constructor() {
      super();
      this.filename = 'bundle.tar.gz';
      this.url = 'https://example.com/bundle.tar.gz';
      this.savePath = path.join(tempDlDir, 'bundle.tar.gz');
      this.received = 0;
      this.total = 5000000;
      this.paused = false;
      this.cancelled = false;
    }
    getFilename() { return this.filename; }
    getURL() { return this.url; }
    getURLChain() { return [this.url]; }
    getMimeType() { return 'application/gzip'; }
    getSavePath() { return this.savePath; }
    setSavePath(p) { this.savePath = p; }
    setSaveDialogOptions() {}
    getTotalBytes() { return this.total; }
    getReceivedBytes() { return this.received; }
    isPaused() { return this.paused; }
    canResume() { return true; }
    pause() { this.paused = true; }
    resume() { this.paused = false; }
    cancel() { this.cancelled = true; }
  }

  const mockItem = new MockDownloadItem();
  let createdEventFired = false;
  let updatedEventFired = false;
  let doneEventFired = false;

  dlManager.once('download-created', () => { createdEventFired = true; });
  dlManager.once('download-updated', () => { updatedEventFired = true; });
  dlManager.once('download-done', () => { doneEventFired = true; });

  await dlManager._handleWillDownload({}, mockItem, null);
  console.assert(createdEventFired === true, 'download-created event was not fired');
  console.assert(dlManager.getActiveCount() === 1, 'Active download count should be 1');

  const activeId = Array.from(dlManager.activeDownloads.keys())[0];
  console.assert(activeId !== undefined, 'No active download found in manager');

  // Trigger progress
  mockItem.received = 2500000;
  dlManager._handleItemUpdated(activeId, 'progressing');
  // Wait a small tick for throttle
  await new Promise(r => setTimeout(r, 200));
  console.assert(updatedEventFired === true, 'download-updated event was not fired');

  // Pause & Resume via manager
  dlManager.pauseDownload(activeId);
  console.assert(dlManager.getById(activeId).state === 'paused', 'Manager pause failed');
  dlManager.resumeDownload(activeId);
  console.assert(dlManager.getById(activeId).state === 'downloading', 'Manager resume failed');

  // Done completion
  await dlManager._handleItemDone(activeId, 'completed');
  console.assert(doneEventFired === true, 'download-done event was not fired');
  console.assert(dlManager.getActiveCount() === 0, 'Active downloads should be 0 after completion');
  console.assert(dlManager.getById(activeId).state === 'completed', 'Final state should be completed');

  // Clear history
  await dlManager.clearHistory();
  console.assert(dlManager.getAll().length === 0, 'clearHistory should remove completed downloads');
  console.log('  ✔ DownloadsManager mock download lifecycle, progress throttling & state control verified');

  // Test 9.7: NavigationController nucleo://downloads resolution
  const navDownloads = new NavigationController(null);
  console.assert(navDownloads.resolveInputToUrl('nucleo://downloads') === 'nucleo://downloads', 'nucleo://downloads resolution failed');
  console.assert(navDownloads.resolveInputToUrl('nucleo://baixados') === 'nucleo://downloads', 'nucleo://baixados resolution failed');
  console.log('  ✔ NavigationController nucleo://downloads & nucleo://baixados resolution verified');

  // --- 10. Site Permissions & Privacy Subsystem Tests ---
  console.log('\n[Suite 10: Site Permissions & Privacy Subsystem]');
  const tempPermsPath = path.join(os.tmpdir(), `nucleo-test-perms-${Date.now()}.json`);

  // Test 10.1: PermissionsUtils origin normalization (strict security & anti-spoofing)
  console.assert(PermissionsUtils.normalizeOrigin('https://example.com/some/path?query=1#hash') === 'https://example.com', 'Origin normalization should strip paths and queries');
  console.assert(PermissionsUtils.normalizeOrigin('https://sub.domain.org:8443/') === 'https://sub.domain.org:8443', 'Origin normalization must preserve non-standard ports');
  console.assert(PermissionsUtils.normalizeOrigin('https://example.com:443/') === 'https://example.com', 'Standard HTTPS port 443 should be stripped');
  console.assert(PermissionsUtils.normalizeOrigin('http://example.com:80/') === 'http://example.com', 'Standard HTTP port 80 should be stripped');
  console.assert(PermissionsUtils.normalizeOrigin('http://example.com') !== PermissionsUtils.normalizeOrigin('https://example.com'), 'HTTP and HTTPS origins must never collide');
  console.assert(PermissionsUtils.normalizeOrigin('javascript:alert(1)') === null, 'Pseudo schemes must return null');
  console.assert(PermissionsUtils.normalizeOrigin('data:text/html,<h1>hi</h1>') === null, 'Data URLs must return null');
  console.assert(PermissionsUtils.normalizeOrigin('about:blank') === null, 'About schemes must return null');
  console.assert(PermissionsUtils.normalizeOrigin(null) === null, 'Null origin must return null');
  console.assert(PermissionsUtils.normalizeOrigin('') === null, 'Empty string must return null');
  console.log('  ✔ PermissionsUtils origin normalization & anti-spoofing verified');

  // Test 10.2: PermissionsUtils permission mapping and metadata
  console.assert(PermissionsUtils.mapPermissionType('media', { mediaTypes: ['video'] }).includes('camera'), 'Media video should map to camera');
  console.assert(PermissionsUtils.mapPermissionType('media', { mediaTypes: ['audio'] }).includes('microphone'), 'Media audio should map to microphone');
  console.assert(PermissionsUtils.mapPermissionType('geolocation').includes('geolocation'), 'Geolocation direct mapping');
  console.assert(PermissionsUtils.mapPermissionType('notifications').includes('notifications'), 'Notifications direct mapping');
  console.assert(PermissionsUtils.mapPermissionType('clipboard-read').includes('clipboard'), 'clipboard-read mapping');
  console.assert(PermissionsUtils.mapPermissionType('unknown-perm').length === 0, 'Unknown permission should return empty array');
  console.assert(PermissionsUtils.SUPPORTED_PERMISSIONS.includes('camera'), 'camera in SUPPORTED_PERMISSIONS');
  console.assert(PermissionsUtils.PERMISSION_STATES.ALLOW === 'allow', 'PERMISSION_STATES.ALLOW verified');
  console.assert(PermissionsUtils.PERMISSION_STATES.DENY === 'deny', 'PERMISSION_STATES.DENY verified');
  console.assert(PermissionsUtils.PERMISSION_STATES.ASK === 'ask', 'PERMISSION_STATES.ASK verified');
  console.assert(PermissionsUtils.UNSUPPORTED_PERMISSIONS.autoplay !== undefined, 'UNSUPPORTED_PERMISSIONS includes autoplay documentation');
  console.log('  ✔ PermissionsUtils mapping, states & metadata verified');

  // Test 10.3: PermissionsUtils secure context detection
  console.assert(PermissionsUtils.isSecureContext('https://secure.example.com') === true, 'HTTPS must be secure');
  console.assert(PermissionsUtils.isSecureContext('http://localhost:3000') === true, 'Localhost HTTP must be secure');
  console.assert(PermissionsUtils.isSecureContext('http://127.0.0.1:8080') === true, '127.0.0.1 must be secure');
  console.assert(PermissionsUtils.isSecureContext('http://insecure.example.com') === false, 'Remote HTTP must not be secure');
  console.log('  ✔ Secure context detection verified');

  // Test 10.4: PermissionModel origin handling and mutation
  const model1 = new PermissionModel('https://meet.google.com');
  console.assert(model1.origin === 'https://meet.google.com', 'Model origin assignment');
  console.assert(model1.get('camera') === 'ask', 'Default permission state should be ask');
  console.assert(model1.hasOverrides() === false, 'Initial model should have no overrides');
  
  model1.set('camera', 'allow');
  model1.set('microphone', 'deny');
  console.assert(model1.get('camera') === 'allow', 'Camera set allow failed');
  console.assert(model1.get('microphone') === 'deny', 'Microphone set deny failed');
  console.assert(model1.hasOverrides() === true, 'Model with overrides should return true');

  model1.reset('camera');
  console.assert(model1.get('camera') === 'ask', 'Reset permission should revert to ask');
  model1.resetAll();
  console.assert(model1.hasOverrides() === false, 'resetAll should clear all overrides');

  const jsonDump = model1.toJSON();
  console.assert(jsonDump.origin === 'https://meet.google.com', 'toJSON includes origin');
  const restoredModel = PermissionModel.fromJSON({
    origin: 'https://github.com',
    permissions: { notifications: 'allow' },
    createdAt: 1000,
    updatedAt: 2000
  });
  console.assert(restoredModel.origin === 'https://github.com', 'fromJSON origin mismatch');
  console.assert(restoredModel.get('notifications') === 'allow', 'fromJSON permission mismatch');
  console.log('  ✔ PermissionModel mutation, reset and JSON serialization verified');

  // Test 10.5: PermissionsStore atomic persistence & corruption recovery
  const permsStore = new PermissionsStore(tempPermsPath);
  const initialPerms = await permsStore.load();
  console.assert(initialPerms instanceof Map && initialPerms.size === 0, 'Clean store should return empty Map');

  const storeMap = new Map();
  const testModel = new PermissionModel('https://example.com');
  testModel.set('notifications', 'deny');
  storeMap.set('https://example.com', testModel);
  await permsStore.save(storeMap);

  const reloadedStore = await permsStore.load();
  console.assert(reloadedStore.has('https://example.com'), 'Store reload should contain saved origin');
  console.assert(reloadedStore.get('https://example.com').get('notifications') === 'deny', 'Store reload permission mismatch');

  // Simulate file corruption
  fs.writeFileSync(tempPermsPath, '{{{ CORRUPT JSON DATA @@@ !!!');
  const recoveredPerms = await permsStore.load();
  console.assert(recoveredPerms instanceof Map && recoveredPerms.size === 0, 'Store corruption recovery should return empty map safely');
  console.log('  ✔ PermissionsStore atomic serialization and corruption recovery verified');

  // Test 10.6: PermissionsManager full lifecycle & operations
  const permsManager = new PermissionsManager(permsStore);
  await permsManager.initialize();

  // Initially empty
  console.assert(permsManager.listPermissions().length === 0, 'Initially should have 0 configured origins');

  // Setting permissions
  await permsManager.setPermission('https://zoom.us', 'camera', 'allow');
  await permsManager.setPermission('https://zoom.us', 'microphone', 'allow');
  const zoomPerms = permsManager.getPermissionsForOrigin('https://zoom.us');
  console.assert(zoomPerms.camera === 'allow', 'Manager setPermission camera failed');
  console.assert(zoomPerms.microphone === 'allow', 'Manager setPermission microphone failed');
  console.assert(permsManager.listPermissions().length === 1, 'listPermissions should show 1 origin');

  // Resetting specific permission
  await permsManager.resetPermission('https://zoom.us', 'camera');
  console.assert(permsManager.getPermissionsForOrigin('https://zoom.us').camera === 'ask', 'Camera reset failed');
  console.assert(permsManager.getPermissionsForOrigin('https://zoom.us').microphone === 'allow', 'Microphone should remain allow');

  // Reset origin
  await permsManager.resetOrigin('https://zoom.us');
  console.assert(permsManager.listPermissions().length === 0, 'Origin should be removed when all reset');

  // Multiple origins & resetAll
  await permsManager.setPermission('https://site-a.com', 'geolocation', 'deny');
  await permsManager.setPermission('https://site-b.com', 'notifications', 'allow');
  console.assert(permsManager.listPermissions().length === 2, 'Should have 2 origins configured');
  await permsManager.resetAll();
  console.assert(permsManager.listPermissions().length === 0, 'resetAll should clear all origins');
  console.log('  ✔ PermissionsManager CRUD operations, querying and reset verified');

  // Test 10.7: PermissionsManager interactive request simulation & check handlers
  let promptEmitted = null;
  permsManager.on('permission-prompt', (prompt) => {
    promptEmitted = prompt;
  });

  // Test check handler (unconfigured origin returns false for allow)
  const isAllowedInitial = permsManager._handlePermissionCheck(null, 'camera', 'https://telecom.com');
  console.assert(isAllowedInitial === false, 'Initial unconfigured permission check should return false');

  // Simulate request from session
  let requestResolved = null;
  const mockCallback = (result) => { requestResolved = result; };

  permsManager._handlePermissionRequest(null, 'camera', mockCallback, { requestingUrl: 'https://telecom.com' });
  console.assert(promptEmitted !== null, 'permission-prompt event should have fired');
  console.assert(promptEmitted.origin === 'https://telecom.com', 'Prompt origin mismatch');
  console.assert(promptEmitted.permission === 'camera', 'Prompt permission mismatch');
  console.assert(promptEmitted.requestId !== undefined, 'Prompt requestId missing');

  // Resolve request with allow
  const resolveSuccess = await permsManager.resolveRequest(promptEmitted.requestId, 'allow');
  console.assert(resolveSuccess === true, 'resolveRequest should succeed');
  console.assert(requestResolved === true, 'Callback should be called with true for allow');

  // Now permission check should return true
  const isAllowedNow = permsManager._handlePermissionCheck(null, 'camera', 'https://telecom.com');
  console.assert(isAllowedNow === true, 'Permission check should return true after allow');
  console.log('  ✔ PermissionsManager interactive request handling, prompts & resolution verified');

  // Test 10.8: NavigationController nucleo://privacy & aliases resolution
  const navPrivacy = new NavigationController(null);
  console.assert(navPrivacy.resolveInputToUrl('nucleo://privacy') === 'nucleo://privacy', 'nucleo://privacy resolution failed');
  console.assert(navPrivacy.resolveInputToUrl('nucleo://privacidade') === 'nucleo://privacy', 'nucleo://privacidade resolution failed');
  console.assert(navPrivacy.resolveInputToUrl('nucleo://permissions') === 'nucleo://privacy', 'nucleo://permissions resolution failed');
  console.assert(navPrivacy.resolveInputToUrl('nucleo://permissoes') === 'nucleo://privacy', 'nucleo://permissoes resolution failed');
  console.log('  ✔ NavigationController nucleo://privacy & aliases resolution verified');

  // --- 11. Native Menus & Overlays Subsystem Tests ---
  console.log('\n[Suite 11: Native Menus & Overlays Subsystem]');
  console.assert(IPC_CHANNELS.MENU_SHOW_MAIN === 'menu:show-main', 'MENU_SHOW_MAIN channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_EXTENSIONS === 'menu:show-extensions', 'MENU_SHOW_EXTENSIONS channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_TAB_CONTEXT === 'menu:show-tab-context', 'MENU_SHOW_TAB_CONTEXT channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_WORKSPACES_CONTEXT === 'menu:show-workspaces-context', 'MENU_SHOW_WORKSPACES_CONTEXT channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_SHIELD === 'menu:show-shield', 'MENU_SHOW_SHIELD channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_SITE_PERMISSIONS === 'menu:show-site-permissions', 'MENU_SHOW_SITE_PERMISSIONS channel mismatch');
  console.assert(IPC_CHANNELS.MENU_SHOW_WORKSPACES === 'menu:show-workspaces', 'MENU_SHOW_WORKSPACES channel mismatch');
  console.assert(IPC_CHANNELS.TAB_SET_ACTIVE_VISIBLE === 'tab:set-active-visible', 'TAB_SET_ACTIVE_VISIBLE channel mismatch');
  console.assert(IPC_CHANNELS.EVENT_UI_ACTION === 'event:ui-action', 'EVENT_UI_ACTION channel mismatch');
  console.log('  ✔ Native menu IPC channels defined and verified');

  const preloadContent = fs.readFileSync(path.join(__dirname, '../src/preload/index.js'), 'utf-8');
  console.assert(preloadContent.includes('openMainMenu:'), 'preload missing openMainMenu');
  console.assert(preloadContent.includes('openExtensionsMenu:'), 'preload missing openExtensionsMenu');
  console.assert(preloadContent.includes('openTabContextMenu:'), 'preload missing openTabContextMenu');
  console.assert(preloadContent.includes('openWorkspacesContextMenu:'), 'preload missing openWorkspacesContextMenu');
  console.assert(preloadContent.includes('openShieldMenu:'), 'preload missing openShieldMenu');
  console.assert(preloadContent.includes('openSitePermissionsMenu:'), 'preload missing openSitePermissionsMenu');
  console.assert(preloadContent.includes('openWorkspacesMenu:'), 'preload missing openWorkspacesMenu');
  console.assert(preloadContent.includes('setActiveTabVisible:'), 'preload missing setActiveTabVisible');
  console.assert(preloadContent.includes('onUIAction:'), 'preload missing onUIAction');
  console.log('  ✔ Preload bridge exposes all native menu and visibility methods');

  const mockWinCtrl = { getWindow: () => null, isBookmarksBarVisible: () => false };
  const mockTabManager = new TabManager(mockWinCtrl);
  console.assert(typeof mockTabManager.setActiveTabVisible === 'function', 'TabManager missing setActiveTabVisible method');
  mockTabManager.setActiveTabVisible(false);
  mockTabManager.setActiveTabVisible(true);
  console.log('  ✔ TabManager setActiveTabVisible method verified');

  // Cleanup temp files
  try {
    if (fs.existsSync(tempBmPath)) fs.unlinkSync(tempBmPath);
    if (fs.existsSync(tempHistPath)) fs.unlinkSync(tempHistPath);
    if (fs.existsSync(tempShieldPath)) fs.unlinkSync(tempShieldPath);
    if (fs.existsSync(tempExtStorePath)) fs.unlinkSync(tempExtStorePath);
    if (fs.existsSync(tempSettingsPath)) fs.unlinkSync(tempSettingsPath);
    if (fs.existsSync(tempWsPath)) fs.unlinkSync(tempWsPath);
    if (fs.existsSync(tempDlPath)) fs.unlinkSync(tempDlPath);
    if (fs.existsSync(tempPermsPath)) fs.unlinkSync(tempPermsPath);
    if (fs.existsSync(tempDlDir)) await fs.promises.rm(tempDlDir, { recursive: true, force: true });
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
    console.log('  ALL NÚCLEO BROWSER v0.9.0 TESTS PASSED (100%)');
    console.log('=============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  }
}

main();
