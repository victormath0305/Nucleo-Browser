/**
 * Núcleo Browser - Electron Integration Test Suite (v0.3 Bookmarks, History & Persistence)
 * Tests tab lifecycle, bookmarks bar toggle, star state, internal nucleo:// pages,
 * automatic history recording, and real HTTPS navigation.
 */

const { app } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const AppConfig = require('../src/main/config/app-config');
const BrowserEngine = require('../src/main/core/browser-engine');
const BrowserWindowController = require('../src/main/core/browser-window');
const TabManager = require('../src/main/modules/tabs/tab-manager');
const NavigationController = require('../src/main/modules/navigation/navigation-controller');
const { BookmarkManager, BookmarkStore } = require('../src/main/modules/bookmarks');
const { HistoryManager, HistoryStore } = require('../src/main/modules/history');
const { ShieldManager, FilterStore } = require('../src/main/modules/shield');
const { ExtensionManager, ExtensionStore } = require('../src/main/modules/extensions');
const { SettingsManager, SettingsStore } = require('../src/main/modules/settings');
const { SearchProvider } = require('../src/main/modules/search');
const { DefaultBrowserManager } = require('../src/main/modules/default-browser');
const { WorkspaceManager, WorkspaceStore } = require('../src/main/modules/workspaces');
const IpcHandlerRegistry = require('../src/main/ipc/ipc-handlers');

const tempBmPath = path.join(os.tmpdir(), `nucleo-int-bm-${Date.now()}.json`);
const tempHistPath = path.join(os.tmpdir(), `nucleo-int-hist-${Date.now()}.json`);
const tempShieldPath = path.join(os.tmpdir(), `nucleo-int-shield-${Date.now()}.json`);
const tempExtPath = path.join(os.tmpdir(), `nucleo-int-ext-${Date.now()}.json`);
const tempSettingsPath = path.join(os.tmpdir(), `nucleo-int-settings-${Date.now()}.json`);
const tempWsPath = path.join(os.tmpdir(), `nucleo-int-ws-${Date.now()}.json`);
const tempExtDir = path.join(os.tmpdir(), `nucleo-int-ext-dir-${Date.now()}`);

app.whenReady().then(async () => {
  console.log('--- Initializing Integration Test Environment (v0.7.0 Workspaces, Settings, Extensions & Shield) ---');
  await fs.promises.mkdir(tempExtDir, { recursive: true });

  const engine = new BrowserEngine();
  await engine.initialize();

  const settingsStore = new SettingsStore(tempSettingsPath);
  const settingsManager = new SettingsManager(settingsStore);
  await settingsManager.initialize();

  const searchProvider = new SearchProvider(settingsManager);
  const defaultBrowserManager = new DefaultBrowserManager(settingsManager);

  const bookmarkStore = new BookmarkStore(tempBmPath);
  const bookmarkManager = new BookmarkManager(bookmarkStore);
  await bookmarkManager.initialize();

  const historyStore = new HistoryStore(tempHistPath, 100);
  const historyManager = new HistoryManager(historyStore);
  await historyManager.initialize();

  const shieldStore = new FilterStore(tempShieldPath);
  const shieldManager = new ShieldManager(shieldStore);
  await shieldManager.initialize();

  const extensionStore = new ExtensionStore(tempExtPath);
  const extensionManager = new ExtensionManager(engine, {
    store: extensionStore,
    extensionsDir: tempExtDir
  });
  await extensionManager.initialize();

  const workspaceStore = new WorkspaceStore(tempWsPath);
  const workspaceManager = new WorkspaceManager(workspaceStore);
  await workspaceManager.initialize();

  const windowController = new BrowserWindowController();
  const tabManager = new TabManager(
    windowController,
    historyManager,
    bookmarkManager,
    shieldManager,
    settingsManager,
    searchProvider,
    workspaceManager
  );
  windowController.setTabManager(tabManager);

  shieldManager.attachToSession(engine.getSession(), tabManager, windowController);

  const navigationController = new NavigationController(tabManager, searchProvider);
  const ipcRegistry = new IpcHandlerRegistry({
    windowController,
    tabManager,
    navigationController,
    devToolsManager: { toggleWebContentsDevTools: () => {}, toggleChromeDevTools: () => {} },
    bookmarkManager,
    historyManager,
    shieldManager,
    extensionManager,
    settingsManager,
    searchProvider,
    defaultBrowserManager,
    workspaceManager,
    browserEngine: engine
  });
  ipcRegistry.registerAll();

  const win = windowController.createMainWindow();
  console.log('✔ Main window created successfully:', win.getTitle());

  // Test 1: Tab creation (initial tab)
  console.log('\n[Test 1] Criação de aba inicial...');
  const tab1 = tabManager.createTab(AppConfig.navigation.defaultHomepage, true);
  console.assert(tab1 && tab1.id, 'Test 1 Failed: Tab 1 was not created');
  console.assert(tabManager.tabs.size === 1, `Test 1 Failed: Expected 1 tab, got ${tabManager.tabs.size}`);
  console.log(`✔ Tab 1 created with id: ${tab1.id}`);

  // Test 2: Criação de múltiplas abas
  console.log('\n[Test 2] Criação de múltiplas abas...');
  const tab2 = tabManager.createTab('nucleo://newtab', true);
  const tab3 = tabManager.createTab('about:blank', false);
  console.assert(tabManager.tabs.size === 3, `Test 2 Failed: Expected 3 tabs, got ${tabManager.tabs.size}`);
  console.log(`✔ Created 3 tabs total. Tab IDs: [${Array.from(tabManager.tabs.keys()).join(', ')}]`);

  // Test 3: Ativação de aba
  console.log('\n[Test 3] Ativação de aba...');
  tabManager.setActiveTab(tab3.id);
  console.assert(tabManager.activeTabId === tab3.id, `Test 3 Failed: Tab 3 is not active`);
  console.assert(tab3.view.getVisible() === true, 'Test 3 Failed: Tab 3 should be visible');
  console.assert(tab1.view.getVisible() === false, 'Test 3 Failed: Tab 1 should be hidden');
  console.log(`✔ Active tab switched to: ${tabManager.activeTabId}`);

  // Test 4: Fechamento de aba
  console.log('\n[Test 4] Fechamento de aba...');
  tabManager.closeTab(tab3.id);
  console.assert(!tabManager.tabs.has(tab3.id), 'Test 4 Failed: Tab 3 should be deleted');
  console.assert(tabManager.activeTabId !== tab3.id, 'Test 4 Failed: Active tab should switch away from tab 3');
  console.log(`✔ Tab 3 closed. Remaining tabs: ${tabManager.tabs.size}`);

  // Test 5: Troca cíclica com Ctrl+Tab e Ctrl+Shift+Tab
  console.log('\n[Test 5] Troca cíclica de abas...');
  const currentActiveBefore = tabManager.activeTabId;
  tabManager.switchNextTab();
  console.assert(tabManager.activeTabId !== currentActiveBefore, 'Test 5 Failed: Tab did not switch with switchNextTab');
  tabManager.switchPreviousTab();
  console.assert(tabManager.activeTabId === currentActiveBefore, 'Test 5 Failed: Tab did not revert with switchPreviousTab');
  console.log('✔ Tab cycling passed');

  // Test 6: Atalhos Ctrl+T e Ctrl+W
  console.log('\n[Test 6] Atalhos Ctrl+T e Ctrl+W...');
  const countBeforeCtrlT = tabManager.tabs.size;
  tabManager._handleTabKeyboardShortcut({ control: true, key: 't' }, { preventDefault: () => {} }, tabManager.activeTabId);
  console.assert(tabManager.tabs.size === countBeforeCtrlT + 1, 'Test 6 Failed: Ctrl+T did not create a new tab');
  const createdTabId = tabManager.activeTabId;
  tabManager._handleTabKeyboardShortcut({ control: true, key: 'w' }, { preventDefault: () => {} }, createdTabId);
  console.assert(!tabManager.tabs.has(createdTabId), 'Test 6 Failed: Ctrl+W did not close the active tab');
  console.log('✔ Ctrl+T and Ctrl+W shortcuts verified');

  // Test 7: Duplicação de aba
  console.log('\n[Test 7] Duplicação de aba...');
  const activeTabForDup = tabManager.getActiveTab();
  const dupTab = tabManager.duplicateTab(activeTabForDup.id);
  console.assert(dupTab && dupTab.url === activeTabForDup.url, 'Test 7 Failed: Duplicated tab URL mismatch');
  console.log(`✔ Duplicated tab ${activeTabForDup.id} into new tab ${dupTab.id}`);

  // Test 8: Fechar abas à direita & fechar outras abas
  console.log('\n[Test 8] Fechar abas à direita e outras abas...');
  const firstTabId = Array.from(tabManager.tabs.keys())[0];
  tabManager.closeTabsToTheRight(firstTabId);
  console.assert(tabManager.tabs.size === 1, `Test 8 Failed: Expected 1 tab remaining, got ${tabManager.tabs.size}`);
  console.log('✔ closeTabsToTheRight verified');

  // Test 9: Bookmarks Bar toggle e redimensionamento dinâmico
  console.log('\n[Test 9] Barra de favoritos e ajuste dinâmico de layout...');
  console.assert(windowController.isBookmarksBarVisible() === false, 'Test 9 Failed: Bookmarks bar should be hidden by default');
  const baseBounds = windowController.getWebContentBounds();
  console.assert(baseBounds.y === 78, `Test 9 Failed: Base bounds Y expected 78, got ${baseBounds.y}`);

  // Toggle visible
  windowController.toggleBookmarksBar();
  console.assert(windowController.isBookmarksBarVisible() === true, 'Test 9 Failed: Bookmarks bar should be visible');
  const visibleBounds = windowController.getWebContentBounds();
  console.assert(visibleBounds.y === 110, `Test 9 Failed: Visible bounds Y expected 110 (78+32), got ${visibleBounds.y}`);

  // Toggle hidden again
  windowController.toggleBookmarksBar();
  console.assert(windowController.isBookmarksBarVisible() === false, 'Test 9 Failed: Bookmarks bar should be hidden');
  console.assert(windowController.getWebContentBounds().y === 78, 'Test 9 Failed: Bounds Y did not return to 78');
  console.log('✔ Bookmarks bar toggle and dynamic bounds resize verified');

  // Test 10: Adicionar/Remover favorito e verificação de estrela
  console.log('\n[Test 10] Gerenciador de favoritos e estado de estrela...');
  console.assert(bookmarkManager.isBookmarked('https://example.com') === false, 'Initial state should not be bookmarked');
  await bookmarkManager.addBookmark({ title: 'Example Domain', url: 'https://example.com' });
  console.assert(bookmarkManager.isBookmarked('https://example.com') === true, 'isBookmarked should be true after adding');
  await bookmarkManager.removeBookmarkByUrl('https://example.com');
  console.assert(bookmarkManager.isBookmarked('https://example.com') === false, 'isBookmarked should be false after removal');
  console.log('✔ Bookmark add/remove and star state sync verified');

  // Test 11: Páginas internas nucleo://bookmarks, nucleo://history, nucleo://shield e nucleo://shield-test
  console.log('\n[Test 11] Páginas internas nucleo://bookmarks, nucleo://history e nucleo://shield...');
  const bmTab = tabManager.createTab('nucleo://bookmarks', true);
  await new Promise((resolve) => {
    bmTab.webContents.once('did-stop-loading', () => {
      console.log(`   Internal Bookmarks URL: ${bmTab.url}, Title: ${bmTab.title}`);
      console.assert(bmTab.url.includes('nucleo://bookmarks'), 'URL should be nucleo://bookmarks');
      console.assert(bmTab.isSecure === true, 'Internal page should be marked secure');
      resolve();
    });
  });

  const histTab = tabManager.createTab('nucleo://history', true);
  await new Promise((resolve) => {
    histTab.webContents.once('did-stop-loading', () => {
      console.log(`   Internal History URL: ${histTab.url}, Title: ${histTab.title}`);
      console.assert(histTab.url.includes('nucleo://history'), 'URL should be nucleo://history');
      console.assert(histTab.isSecure === true, 'Internal page should be marked secure');
      resolve();
    });
  });

  const shieldTab = tabManager.createTab('nucleo://shield', true);
  await new Promise((resolve) => {
    shieldTab.webContents.once('did-stop-loading', () => {
      console.log(`   Internal Shield URL: ${shieldTab.url}, Title: ${shieldTab.title}`);
      console.assert(shieldTab.url.includes('nucleo://shield'), 'URL should be nucleo://shield');
      console.assert(shieldTab.isSecure === true, 'Internal page should be marked secure');
      resolve();
    });
  });

  const shieldTestTab = tabManager.createTab('nucleo://shield-test', true);
  await new Promise((resolve) => {
    shieldTestTab.webContents.once('did-stop-loading', () => {
      console.log(`   Internal Shield Test URL: ${shieldTestTab.url}, Title: ${shieldTestTab.title}`);
      console.assert(shieldTestTab.url.includes('nucleo://shield-test'), 'URL should be nucleo://shield-test');
      console.assert(shieldTestTab.isSecure === true, 'Internal page should be marked secure');
      resolve();
    });
  });

  // Test 11b: Deterministic blocking in shield-test tab
  console.log('\n[Test 11b] Verificação de bloqueio em tempo real com Núcleo Shield...');
  const blockResult = await shieldTestTab.webContents.executeJavaScript(`
    (async () => {
      let adBlocked = false;
      let trackerBlocked = false;
      try {
        await fetch('http://shield-test-ad.local/banner.jpg', { mode: 'no-cors' });
      } catch (e) {
        adBlocked = true;
      }
      try {
        await fetch('http://shield-test-tracker.local/pixel.gif', { mode: 'no-cors' });
      } catch (e) {
        trackerBlocked = true;
      }
      return { adBlocked, trackerBlocked };
    })()
  `);

  console.assert(blockResult.adBlocked === true, 'Ad request should be blocked by Núcleo Shield');
  console.assert(blockResult.trackerBlocked === true, 'Tracker request should be blocked by Núcleo Shield');
  const liveTabStats = shieldManager.getTabStats(shieldTestTab.id);
  console.assert(liveTabStats && liveTabStats.totalBlocked >= 2, `Expected >= 2 blocked requests, got ${liveTabStats?.totalBlocked}`);
  console.assert(liveTabStats.adsBlocked >= 1, `Expected >= 1 ad blocked, got ${liveTabStats?.adsBlocked}`);
  console.assert(liveTabStats.trackersBlocked >= 1, `Expected >= 1 tracker blocked, got ${liveTabStats?.trackersBlocked}`);
  console.log(`✔ Live request interception verified: ${liveTabStats.totalBlocked} blocked (${liveTabStats.adsBlocked} ads, ${liveTabStats.trackersBlocked} trackers)`);

  // Test 11c: Whitelisting toggle verification
  console.log('\n[Test 11c] Gerenciamento de exceções (Whitelist)...');
  await shieldManager.addWhitelistDomain('shield-test-blocked.local');
  console.assert(shieldManager.isSiteWhitelisted('shield-test-blocked.local') === true, 'Domain should be whitelisted');
  await shieldManager.removeWhitelistDomain('shield-test-blocked.local');
  console.assert(shieldManager.isSiteWhitelisted('shield-test-blocked.local') === false, 'Domain should be removed from whitelist');
  console.log('✔ Whitelist domain addition and removal verified');

  // Test 11d: Carregamento seguro das páginas de extensões (nucleo://extensions e nucleo://extension-test)
  console.log('\n[Test 11d] Carregamento seguro das páginas de extensões...');
  const extTab = tabManager.createTab('nucleo://extensions', true);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout loading nucleo://extensions')), 10000);
    extTab.webContents.once('did-stop-loading', () => {
      clearTimeout(timeout);
      console.log(`   URL: ${extTab.webContents.getURL()} | Title: ${extTab.title}`);
      console.assert(extTab.title.includes('Extensões'), 'nucleo://extensions title mismatch');
      resolve();
    });
  });

  const extTestTab = tabManager.createTab('nucleo://extension-test', true);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout loading nucleo://extension-test')), 10000);
    extTestTab.webContents.once('did-stop-loading', () => {
      clearTimeout(timeout);
      console.log(`   URL: ${extTestTab.webContents.getURL()} | Title: ${extTestTab.title}`);
      console.assert(extTestTab.title.includes('Extension Test'), 'nucleo://extension-test title mismatch');
      resolve();
    });
  });
  console.log('✔ Páginas nucleo://extensions e nucleo://extension-test carregadas com sucesso');

  // Test 11e: Instalação de extensão Chromium local (Manifest V3)
  console.log('\n[Test 11e] Instalação de extensão Chromium local (Manifest V3)...');
  const fixturePath = path.join(__dirname, '../tests/fixtures/extensions/test-extension');
  const installResult = await extensionManager.installFromDirectory(fixturePath);
  console.assert(installResult && installResult.success === true, 'Failed to install test extension: ' + JSON.stringify(installResult?.errors));
  const installedExt = installResult.extension;
  console.assert(installedExt && installedExt.id, 'Failed to get installed extension record');
  console.assert(installedExt.name === 'Núcleo Test Extension', 'Extension name mismatch');
  console.assert(installedExt.manifestVersion === 3, 'Extension manifest version mismatch');
  console.assert(installedExt.enabled === true, 'Extension should be enabled by default');
  console.assert(extensionManager.getExtension(installedExt.id) !== null, 'Extension not found in manager');
  console.assert(extensionManager.loader.isLoaded(installedExt.id) === true, 'Extension not loaded in Electron session');
  console.log(`✔ Extensão instalada com sucesso: ${installedExt.name} (ID: ${installedExt.id}, v${installedExt.version})`);

  // Test 11f: Isolamento de segurança (Sandbox e sem Node APIs)
  console.log('\n[Test 11f] Isolamento de segurança (Sandbox e sem Node APIs)...');
  const secCheck = await extTestTab.webContents.executeJavaScript(`
    ({
      hasRequire: typeof window.require !== 'undefined',
      hasProcess: typeof window.process !== 'undefined',
      hasBuffer: typeof window.Buffer !== 'undefined',
      hasNucleoAPI: typeof window.nucleoAPI !== 'undefined'
    })
  `);
  console.assert(secCheck.hasRequire === false, 'Security violation: window.require is exposed');
  console.assert(secCheck.hasProcess === false, 'Security violation: window.process is exposed');
  console.assert(secCheck.hasBuffer === false, 'Security violation: window.Buffer is exposed');
  console.assert(secCheck.hasNucleoAPI === true, 'nucleoAPI should be exposed in internal test page');
  console.log('✔ Isolamento de segurança estrito verificado (Sandbox ativo, Node APIs indisponíveis)');

  // Test 11g: Desativação dinâmica da extensão
  console.log('\n[Test 11g] Desativação dinâmica da extensão...');
  const disableResult = await extensionManager.disableExtension(installedExt.id);
  console.assert(disableResult && disableResult.success === true, 'Failed to disable extension');
  const disabledExt = extensionManager.getExtension(installedExt.id);
  console.assert(disabledExt && disabledExt.enabled === false, 'Extension enabled state should be false');
  console.assert(extensionManager.loader.isLoaded(installedExt.id) === false, 'Extension should be unloaded from session');
  console.log('✔ Extensão desativada e descarregada da sessão');

  // Test 11h: Reativação dinâmica da extensão
  console.log('\n[Test 11h] Reativação dinâmica da extensão...');
  const enableResult = await extensionManager.enableExtension(installedExt.id);
  console.assert(enableResult && enableResult.success === true, 'Failed to enable extension');
  const enabledExt = extensionManager.getExtension(installedExt.id);
  console.assert(enabledExt && enabledExt.enabled === true, 'Extension enabled state should be true');
  console.assert(extensionManager.loader.isLoaded(installedExt.id) === true, 'Extension should be reloaded in session');
  console.log('✔ Extensão reativada e recarregada na sessão');

  // Test 11i: Desinstalação da extensão e limpeza de diretório
  console.log('\n[Test 11i] Desinstalação da extensão e limpeza de diretório...');
  const isolatedDir = installedExt.path;
  console.assert(fs.existsSync(isolatedDir) === true, 'Isolated extension directory should exist before uninstall');
  const uninstallResult = await extensionManager.uninstallExtension(installedExt.id);
  console.assert(uninstallResult && uninstallResult.success === true, 'Uninstall should return true');
  console.assert(extensionManager.getExtension(installedExt.id) === null, 'Extension record should be removed from store');
  console.assert(fs.existsSync(isolatedDir) === false, 'Isolated extension directory should be deleted on uninstall');
  console.assert(fs.existsSync(fixturePath) === true, 'Original fixture folder should remain untouched');
  console.log('✔ Extensão desinstalada, diretório isolado removido e arquivos de origem preservados');

  // Verify internal pages were NOT recorded in browsing history
  console.assert(historyManager.getAllEntries().length === 0, 'Internal nucleo:// pages were incorrectly recorded in history!');
  console.log('✔ Internal pages loaded securely and excluded from history');

  // Test 12: Carregamento de HTTPS real e gravação automática no Histórico
  console.log('\n[Test 12] Carregamento HTTPS real e gravação automática no Histórico...');
  const httpsTab = tabManager.createTab('https://example.com', true);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout loading https://example.com')), 15000);
    httpsTab.webContents.once('did-stop-loading', () => {
      clearTimeout(timeout);
      console.log(`   HTTPS URL: ${httpsTab.webContents.getURL()}`);
      console.log(`   Title: ${httpsTab.title}`);
      console.log(`   isSecure: ${httpsTab.isSecure}`);
      console.assert(httpsTab.isSecure === true, 'HTTPS page should be secure');
      resolve();
    });
  });

  // Verify automatic history recording
  const recordedVisits = historyManager.getAllEntries();
  console.assert(recordedVisits.length >= 1, `Expected at least 1 history visit, got ${recordedVisits.length}`);
  const exampleVisit = recordedVisits.find(v => v.url.includes('example.com'));
  console.assert(exampleVisit !== undefined, 'https://example.com was not recorded in history!');
  console.assert(exampleVisit.visitCount >= 1, 'Visit count was not recorded');
  console.log(`✔ Automatic history recorded: ${exampleVisit.url} (visits: ${exampleVisit.visitCount})`);

  // Test 13: Fechamento da última aba (nunca deixa a janela vazia)
  console.log('\n[Test 13] Fechamento da última aba...');
  const allTabIds = Array.from(tabManager.tabs.keys());
  for (const id of allTabIds) {
    tabManager.closeTab(id);
  }
  console.assert(tabManager.tabs.size >= 1, `Expected >= 1 tab, got ${tabManager.tabs.size}`);
  console.assert(tabManager.getActiveTab() !== null, 'Active tab is null');
  console.log(`✔ Last tab closed -> Initial tab created automatically (${tabManager.tabs.size} tab active)`);

  // Test 14: Configurações, nucleo://settings e Search Provider
  console.log('\n[Test 14] Configurações, nucleo://settings e Search Provider...');
  const settingsTab = tabManager.createTab('nucleo://settings', true);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout loading nucleo://settings')), 10000);
    settingsTab.webContents.once('did-stop-loading', () => {
      clearTimeout(timeout);
      console.log(`   Settings URL: ${settingsTab.webContents.getURL()}`);
      console.log(`   Settings Title: ${settingsTab.title}`);
      console.assert(settingsTab.title.includes('Configurações'), 'Settings tab title should contain Configurações');
      resolve();
    });
  });

  // Test changing default search engine live
  await settingsManager.set('search.engine', 'google');
  console.assert(searchProvider.getDefaultEngineId() === 'google', 'Default engine was not updated in searchProvider');

  // Verify omnibox navigation generates google search URL
  const searchUrl = navigationController.resolveInputToUrl('nucleo browser test');
  console.assert(searchUrl.includes('google.com/search') && searchUrl.includes('nucleo%20browser%20test'), `Search URL incorrect: ${searchUrl}`);
  console.log(`✔ Omnibox search resolution updated to Google: ${searchUrl}`);

  // Test Default Browser query
  const defaultBrowserStatus = await defaultBrowserManager.isDefault();
  console.assert(typeof defaultBrowserStatus.isDefault === 'boolean', 'isDefault should be boolean');
  console.log(`✔ Default Browser check passed (isDefault: ${defaultBrowserStatus.isDefault})`);

  // Close the settings tab
  tabManager.closeTab(settingsTab.id);

  // Verify nucleo://settings was excluded from browsing history
  const historyEntries = historyManager.getAllEntries();
  const settingsInHistory = historyEntries.some(e => e.url && e.url.includes('settings'));
  console.assert(!settingsInHistory, 'nucleo://settings was improperly recorded in history!');
  console.log('✔ nucleo://settings verified, omnibox search updated, and excluded from history');

  // Test 15: Workspaces — Contextos de Abas, Isolamento e Transição sem Recarregar
  console.log('\n[Test 15] Workspaces — Contextos de Abas, Isolamento e Transição sem Recarregar...');
  
  // 15.1: Initial default workspace
  const activeWs = workspaceManager.getActiveWorkspace();
  console.assert(activeWs !== null, 'Test 15.1 Failed: No active workspace found');
  console.assert(activeWs.name === 'Pessoal', `Test 15.1 Failed: Expected Pessoal, got ${activeWs.name}`);
  console.log(`✔ Workspace padrão ativo verificado: ${activeWs.name} (${activeWs.id})`);

  // 15.2: Create new workspace "Trabalho"
  const trabalhoWs = await workspaceManager.createWorkspace({ name: 'Trabalho', color: 'indigo', icon: 'briefcase' });
  console.assert(trabalhoWs && trabalhoWs.id, 'Test 15.2 Failed: Failed to create Trabalho workspace');
  console.assert(workspaceManager.activeWorkspaceId === trabalhoWs.id, 'Test 15.2 Failed: New workspace should be active');

  // Create tabs in "Trabalho"
  const tabTrabalho1 = tabManager.createTab('nucleo://newtab', true, trabalhoWs.id);
  const tabTrabalho2 = tabManager.createTab('about:blank', false, trabalhoWs.id);
  console.assert(tabManager.getAllTabs().length === 2, `Test 15.2 Failed: Expected 2 tabs in Trabalho, got ${tabManager.getAllTabs().length}`);
  console.assert(tabTrabalho1.view.getVisible() === true, 'Test 15.2 Failed: Active tab in Trabalho should be visible');
  console.log(`✔ Workspace Trabalho criado com 2 abas isoladas (IDs: ${tabTrabalho1.id}, ${tabTrabalho2.id})`);

  // 15.3: Switch to Pessoal without destroying or reloading views
  await tabManager.switchWorkspace(activeWs.id);
  console.assert(workspaceManager.activeWorkspaceId === activeWs.id, 'Test 15.3 Failed: Active workspace should be Pessoal');
  // In Pessoal, Trabalho's tabs must have view.getVisible() === false
  console.assert(tabTrabalho1.view.getVisible() === false, 'Test 15.3 Failed: Tab from inactive workspace must be hidden');
  console.assert(tabTrabalho2.view.getVisible() === false, 'Test 15.3 Failed: Inactive tab from inactive workspace must be hidden');
  console.log('✔ Transição para Pessoal: WebContentsViews do workspace Trabalho ocultadas com estado intacto');

  // 15.4: Switch back to Trabalho and check visibility restored
  await tabManager.switchWorkspace(trabalhoWs.id);
  console.assert(tabTrabalho1.view.getVisible() === true, 'Test 15.4 Failed: Active tab in Trabalho should be visible again');
  console.log('✔ Retorno ao workspace Trabalho: aba ativa restaurada com visibilidade imediata sem reload');

  // 15.5: Move tab from Trabalho to Pessoal
  const moveTabResult = await tabManager.moveTabToWorkspace(tabTrabalho2.id, activeWs.id, false);
  console.assert(moveTabResult && moveTabResult.success === true, 'Test 15.5 Failed: moveTabToWorkspace failed');
  console.assert(!workspaceManager.getWorkspace(trabalhoWs.id).tabIds.includes(tabTrabalho2.id), 'Test 15.5 Failed: Tab still in source workspace');
  console.assert(workspaceManager.getWorkspace(activeWs.id).tabIds.includes(tabTrabalho2.id), 'Test 15.5 Failed: Tab not in target workspace');
  console.log('✔ Mover aba entre workspaces verificado com sucesso');

  // 15.6: Duplicate workspace
  const dupWs = await workspaceManager.duplicateWorkspace(trabalhoWs.id);
  console.assert(dupWs && dupWs.id !== trabalhoWs.id, 'Test 15.6 Failed: Duplication failed or reused ID');
  console.assert(dupWs.name.includes('(Cópia)'), 'Test 15.6 Failed: Duplicate name should include (Cópia)');
  console.log(`✔ Duplicação segura de workspace verificada: ${dupWs.name}`);

  // 15.7: Delete workspace with tab migration
  await workspaceManager.deleteWorkspace(dupWs.id, { targetWorkspaceId: activeWs.id });
  console.assert(workspaceManager.getWorkspace(dupWs.id) === null, 'Test 15.7 Failed: Workspace was not deleted');
  console.log('✔ Exclusão de workspace com migração segura de abas verificada');

  console.log('\n--- Teardown ---');
  tabManager.destroyAll();
  windowController.close();

  // Cleanup test files
  try {
    if (fs.existsSync(tempBmPath)) fs.unlinkSync(tempBmPath);
    if (fs.existsSync(tempHistPath)) fs.unlinkSync(tempHistPath);
    if (fs.existsSync(tempShieldPath)) fs.unlinkSync(tempShieldPath);
    if (fs.existsSync(tempExtPath)) fs.unlinkSync(tempExtPath);
    if (fs.existsSync(tempSettingsPath)) fs.unlinkSync(tempSettingsPath);
    if (fs.existsSync(tempWsPath)) fs.unlinkSync(tempWsPath);
    if (fs.existsSync(tempExtDir)) fs.rmSync(tempExtDir, { recursive: true, force: true });
  } catch {}

  console.log('✔ All resources cleaned up cleanly.');

  setTimeout(() => {
    app.quit();
    process.exit(0);
  }, 400);
}).catch((err) => {
  console.error('Integration test failed with error:', err);
  app.quit();
  process.exit(1);
});
