/**
 * Núcleo Browser - UI Controller (v0.3 Bookmarks, History & Local Persistence)
 * Bridges Browser Chrome elements with Main Process via nucleoAPI.
 */

document.addEventListener('DOMContentLoaded', async () => {
  const api = window.nucleoAPI;
  if (!api) {
    console.error('[Núcleo UI] nucleoAPI bridge not found');
    return;
  }

  // DOM Elements - Navigation & Window
  const browserChrome = document.getElementById('browser-chrome');
  const btnBack = document.getElementById('btnBack');
  const btnForward = document.getElementById('btnForward');
  const btnReload = document.getElementById('btnReload');
  const reloadIcon = document.getElementById('reloadIcon');
  const addressInput = document.getElementById('addressInput');
  const omniboxWrapper = document.getElementById('omniboxWrapper');
  const btnOmniboxAction = document.getElementById('btnOmniboxAction');
  const btnBookmark = document.getElementById('btnBookmark');
  const securityBadge = document.getElementById('securityBadge');
  const progressBar = document.getElementById('progressBar');
  const tabsContainer = document.getElementById('tabsContainer');
  const btnNewTab = document.getElementById('btnNewTab');
  const btnMinimize = document.getElementById('btnMinimize');
  const btnMaximize = document.getElementById('btnMaximize');
  const maximizeIcon = document.getElementById('maximizeIcon');
  const btnClose = document.getElementById('btnClose');
  const btnDevTools = document.getElementById('btnDevTools');
  const btnMenu = document.getElementById('btnMenu');

  // DOM Elements - Shield
  const btnShield = document.getElementById('btnShield');
  const shieldBadgeCount = document.getElementById('shieldBadgeCount');
  const shieldPopover = document.getElementById('shieldPopover');
  const shieldPopoverDomain = document.getElementById('shieldPopoverDomain');
  const shieldPopoverStatusBadge = document.getElementById('shieldPopoverStatusBadge');
  const shieldToggleDesc = document.getElementById('shieldToggleDesc');
  const shieldSiteToggle = document.getElementById('shieldSiteToggle');
  const shieldPopBlockedTotal = document.getElementById('shieldPopBlockedTotal');
  const shieldPopBlockedAds = document.getElementById('shieldPopBlockedAds');
  const shieldPopBlockedTrackers = document.getElementById('shieldPopBlockedTrackers');
  const btnOpenShieldSettings = document.getElementById('btnOpenShieldSettings');

  // DOM Elements - Extensions
  const btnExtensions = document.getElementById('btnExtensions');
  const extensionsPopover = document.getElementById('extensionsPopover');
  const extensionsPopoverList = document.getElementById('extensionsPopoverList');
  const btnPopoverManageExt = document.getElementById('btnPopoverManageExt');
  const btnPopoverInstallExt = document.getElementById('btnPopoverInstallExt');
  const btnPopoverOpenManagement = document.getElementById('btnPopoverOpenManagement');

  // DOM Elements - Bookmarks Bar
  const bookmarksBar = document.getElementById('bookmarksBar');
  const bookmarksItems = document.getElementById('bookmarksItems');
  const btnManageBookmarks = document.getElementById('btnManageBookmarks');

  // DOM Elements - Main Menu
  const menuDropdown = document.getElementById('menuDropdown');
  const menuNewTab = document.getElementById('menuNewTab');
  const menuNewWindow = document.getElementById('menuNewWindow');
  const menuCloseTab = document.getElementById('menuCloseTab');
  const menuReload = document.getElementById('menuReload');
  const menuBookmarks = document.getElementById('menuBookmarks');
  const menuToggleBookmarksBar = document.getElementById('menuToggleBookmarksBar');
  const menuHistory = document.getElementById('menuHistory');
  const menuShield = document.getElementById('menuShield');
  const menuExtensions = document.getElementById('menuExtensions');
  const menuDownloads = document.getElementById('menuDownloads');
  const menuDevToolsWeb = document.getElementById('menuDevToolsWeb');
  const menuDevToolsUI = document.getElementById('menuDevToolsUI');
  const menuSettings = document.getElementById('menuSettings');
  const menuAbout = document.getElementById('menuAbout');

  // DOM Elements - Context Menu
  const tabContextMenu = document.getElementById('tabContextMenu');
  const ctxNewTab = document.getElementById('ctxNewTab');
  const ctxReloadTab = document.getElementById('ctxReloadTab');
  const ctxDuplicateTab = document.getElementById('ctxDuplicateTab');
  const ctxCloseTab = document.getElementById('ctxCloseTab');
  const ctxCloseOtherTabs = document.getElementById('ctxCloseOtherTabs');
  const ctxCloseTabsRight = document.getElementById('ctxCloseTabsRight');
  const ctxWorkspaceSubmenu = document.getElementById('ctxWorkspaceSubmenu');

  // DOM Elements - Workspaces
  const btnWorkspaceSelect = document.getElementById('btnWorkspaceSelect');
  const workspaceActiveDot = document.getElementById('workspaceActiveDot');
  const workspaceActiveIcon = document.getElementById('workspaceActiveIcon');
  const workspaceActiveName = document.getElementById('workspaceActiveName');
  const workspacePopover = document.getElementById('workspacePopover');
  const workspaceItemsList = document.getElementById('workspaceItemsList');
  const btnCreateWorkspace = document.getElementById('btnCreateWorkspace');
  const workspaceContextMenu = document.getElementById('workspaceContextMenu');
  const ctxWsRename = document.getElementById('ctxWsRename');
  const ctxWsChangeColor = document.getElementById('ctxWsChangeColor');
  const ctxWsChangeIcon = document.getElementById('ctxWsChangeIcon');
  const ctxWsDuplicate = document.getElementById('ctxWsDuplicate');
  const ctxWsMoveUp = document.getElementById('ctxWsMoveUp');
  const ctxWsMoveDown = document.getElementById('ctxWsMoveDown');
  const ctxWsDelete = document.getElementById('ctxWsDelete');

  // DOM Elements - Modals
  const workspaceEditModal = document.getElementById('workspaceEditModal');
  const workspaceModalTitle = document.getElementById('workspaceModalTitle');
  const wsInputName = document.getElementById('wsInputName');
  const wsColorPicker = document.getElementById('wsColorPicker');
  const wsIconPicker = document.getElementById('wsIconPicker');
  const btnWsModalSave = document.getElementById('btnWsModalSave');
  const btnWsModalCancel = document.getElementById('btnWsModalCancel');
  const btnWsModalClose = document.getElementById('btnWsModalClose');
  const workspaceDeleteModal = document.getElementById('workspaceDeleteModal');
  const wsDeleteMessage = document.getElementById('wsDeleteMessage');
  const btnWsDeleteMoveTabs = document.getElementById('btnWsDeleteMoveTabs');
  const btnWsDeleteCloseTabs = document.getElementById('btnWsDeleteCloseTabs');
  const btnWsDeleteCancel = document.getElementById('btnWsDeleteCancel');
  const btnWsDeleteClose = document.getElementById('btnWsDeleteClose');

  let contextMenuTabId = null;
  let currentTabs = [];
  let currentActiveTabId = null;
  let currentActiveTabUrl = '';
  let currentActiveTabTitle = '';
  let currentActiveTabFavicon = null;
  let currentLoading = false;
  let isBarVisible = false;

  // Workspaces State
  let currentWorkspaces = [];
  let currentActiveWorkspace = null;
  let contextMenuWsId = null;
  let editingWorkspaceId = null;
  let moveTabOnCreate = null;
  let deletingWorkspaceId = null;
  let selectedModalColor = 'cyan';
  let selectedModalIcon = 'briefcase';

  const WORKSPACE_ICONS = [
    { id: 'home', symbol: '🏠', label: 'Início' },
    { id: 'briefcase', symbol: '💼', label: 'Trabalho' },
    { id: 'book', symbol: '📖', label: 'Leitura' },
    { id: 'code', symbol: '💻', label: 'Código' },
    { id: 'gamepad', symbol: '🎮', label: 'Jogos' },
    { id: 'school', symbol: '🎓', label: 'Estudos' },
    { id: 'folder', symbol: '📁', label: 'Pastas' },
    { id: 'star', symbol: '⭐', label: 'Destaque' }
  ];

  const WORKSPACE_COLORS = [
    { id: 'cyan', hex: '#00e5ff' },
    { id: 'indigo', hex: '#6366f1' },
    { id: 'purple', hex: '#a855f7' },
    { id: 'green', hex: '#10b981' },
    { id: 'amber', hex: '#f59e0b' },
    { id: 'red', hex: '#ef4444' },
    { id: 'pink', hex: '#ec4899' }
  ];

  const getIconSymbol = (iconId) => {
    const item = WORKSPACE_ICONS.find((i) => i.id === iconId);
    return item ? item.symbol : '💼';
  };

  const getColorHex = (colorId) => {
    const item = WORKSPACE_COLORS.find((c) => c.id === colorId);
    return item ? item.hex : '#00e5ff';
  };

  const escapeHtml = (str) => {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // Address Bar Helper
  const addressBar = new window.AddressBarHelper(addressInput, omniboxWrapper);

  // --- SVG Icons Helper ---
  const defaultGlobeSvg = `
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="#94a3b8" stroke-width="1.4"/>
      <ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="#94a3b8" stroke-width="1.4"/>
      <line x1="2" y1="8" x2="14" y2="8" stroke="#94a3b8" stroke-width="1.4"/>
    </svg>
  `;

  // --- Star / Bookmarks Helpers ---
  const updateStarState = (isBookmarked) => {
    if (!btnBookmark) return;
    if (isBookmarked) {
      btnBookmark.classList.add('bookmarked');
      btnBookmark.title = 'Remover dos favoritos (Ctrl+D)';
    } else {
      btnBookmark.classList.remove('bookmarked');
      btnBookmark.title = 'Adicionar aos favoritos (Ctrl+D)';
    }
  };

  const syncStarStateForUrl = async (url) => {
    if (!api?.bookmarks || !url) {
      updateStarState(false);
      return;
    }
    try {
      const bookmarked = await api.bookmarks.isBookmarked(url);
      updateStarState(bookmarked);
    } catch {
      updateStarState(false);
    }
  };

  const toggleBookmarkCurrentTab = async () => {
    if (!api?.bookmarks || !currentActiveTabUrl) return;

    // Do not bookmark blank or internal newtab
    if (currentActiveTabUrl === 'about:blank' || currentActiveTabUrl.includes('newtab.html') || currentActiveTabUrl === 'nucleo://newtab') {
      return;
    }

    try {
      const isBookmarked = await api.bookmarks.isBookmarked(currentActiveTabUrl);
      if (isBookmarked) {
        await api.bookmarks.removeByUrl(currentActiveTabUrl);
        updateStarState(false);
      } else {
        await api.bookmarks.add({
          title: currentActiveTabTitle || currentActiveTabUrl,
          url: currentActiveTabUrl,
          favicon: currentActiveTabFavicon
        });
        updateStarState(true);
      }
    } catch (err) {
      console.warn('[Núcleo UI] Error toggling bookmark:', err);
    }
  };

  if (btnBookmark) {
    btnBookmark.addEventListener('click', () => {
      toggleBookmarkCurrentTab();
    });
  }

  // --- Bookmarks Bar Rendering ---
  const renderBookmarksBar = async () => {
    if (!bookmarksItems || !api?.bookmarks) return;

    try {
      const toolbarItems = await api.bookmarks.getToolbar();
      bookmarksItems.innerHTML = '';

      if (!toolbarItems || toolbarItems.length === 0) {
        const hint = document.createElement('span');
        hint.style.fontSize = '11px';
        hint.style.color = '#64748b';
        hint.style.paddingLeft = '6px';
        hint.textContent = 'Favoritos fixados aparecerão aqui';
        bookmarksItems.appendChild(hint);
        return;
      }

      toolbarItems.forEach((b) => {
        const chip = document.createElement('div');
        chip.className = 'bm-chip';
        chip.title = `${b.title}\n${b.url}`;

        const iconEl = document.createElement('span');
        iconEl.className = 'bm-chip-icon';
        if (b.favicon) {
          const img = document.createElement('img');
          img.src = b.favicon;
          img.alt = '';
          img.onerror = () => {
            iconEl.innerHTML = '★';
          };
          iconEl.appendChild(img);
        } else {
          iconEl.innerHTML = '★';
        }

        const titleEl = document.createElement('span');
        titleEl.className = 'bm-chip-title';
        titleEl.textContent = b.title || b.url;

        chip.appendChild(iconEl);
        chip.appendChild(titleEl);

        // Click navigates in current tab
        chip.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey) {
            api.createTab(b.url);
          } else {
            api.navigate(b.url);
          }
        });

        // Middle click opens in new tab
        chip.addEventListener('auxclick', (e) => {
          if (e.button === 1) {
            e.preventDefault();
            api.createTab(b.url);
          }
        });

        bookmarksItems.appendChild(chip);
      });
    } catch (err) {
      console.warn('[Núcleo UI] Error rendering bookmarks bar:', err);
    }
  };

  const updateBookmarksBarDisplay = (visible) => {
    isBarVisible = Boolean(visible);
    if (bookmarksBar) {
      bookmarksBar.classList.toggle('show', isBarVisible);
    }
    if (browserChrome) {
      browserChrome.classList.toggle('with-bookmarks-bar', isBarVisible);
    }
    if (isBarVisible) {
      renderBookmarksBar();
    }
  };

  if (btnManageBookmarks) {
    btnManageBookmarks.addEventListener('click', () => {
      api.createTab('nucleo://bookmarks');
    });
  }

  // --- Núcleo Shield Helpers & Sync ---
  function extractHostname(url) {
    if (!url || typeof url !== 'string') return '';
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase();
    }
  }

  const syncShieldForActiveTab = async (url = currentActiveTabUrl, tabId = currentActiveTabId) => {
    if (!api?.shield) return;
    try {
      const targetId = tabId || currentActiveTabId;
      const targetUrl = url || currentActiveTabUrl;
      const tabStats = await api.shield.getTabStats(targetId);
      const domain = extractHostname(targetUrl);
      const globalStatus = await api.shield.getStatus();
      const isShieldEnabled = globalStatus ? globalStatus.enabled : true;

      // 1. Update Shield Omnibox Badge
      const blockedCount = tabStats ? (tabStats.totalBlocked || 0) : 0;
      if (shieldBadgeCount) {
        if (blockedCount > 0) {
          shieldBadgeCount.textContent = blockedCount > 99 ? '99+' : blockedCount;
          shieldBadgeCount.style.display = 'inline-block';
        } else {
          shieldBadgeCount.style.display = 'none';
        }
      }

      // 2. Check Whitelist
      let isWhitelisted = false;
      if (domain) {
        const exceptions = await api.shield.getWhitelist();
        isWhitelisted = Array.isArray(exceptions) && exceptions.includes(domain);
      }

      // 3. Update Button Appearance
      if (btnShield) {
        btnShield.classList.remove('shield-disabled', 'shield-whitelisted');
        if (!isShieldEnabled) {
          btnShield.classList.add('shield-disabled');
          btnShield.title = 'Núcleo Shield: Desativado globalmente';
        } else if (isWhitelisted) {
          btnShield.classList.add('shield-whitelisted');
          btnShield.title = `Núcleo Shield: Pausado em ${domain}`;
        } else {
          btnShield.title = `Núcleo Shield: Ativo (${blockedCount} bloqueados)`;
        }
      }

      // 4. Update Popover contents if open
      if (shieldPopover && shieldPopover.classList.contains('show')) {
        shieldPopoverDomain.textContent = domain || 'Página do Sistema';

        if (!isShieldEnabled) {
          shieldPopoverStatusBadge.textContent = 'Desativado';
          shieldPopoverStatusBadge.className = 'shield-popover-status-badge disabled';
          shieldSiteToggle.checked = false;
          shieldSiteToggle.disabled = true;
          shieldToggleDesc.textContent = 'Shield desativado nas configurações';
        } else if (isWhitelisted) {
          shieldPopoverStatusBadge.textContent = 'Pausado';
          shieldPopoverStatusBadge.className = 'shield-popover-status-badge whitelisted';
          shieldSiteToggle.checked = false;
          shieldSiteToggle.disabled = false;
          shieldToggleDesc.textContent = 'Proteção desativada neste site';
        } else {
          shieldPopoverStatusBadge.textContent = 'Protegido';
          shieldPopoverStatusBadge.className = 'shield-popover-status-badge';
          shieldSiteToggle.checked = true;
          shieldSiteToggle.disabled = false;
          shieldToggleDesc.textContent = 'Bloquear anúncios e rastreadores';
        }

        shieldPopBlockedTotal.textContent = blockedCount;
        shieldPopBlockedAds.textContent = tabStats ? (tabStats.adsBlocked || 0) : 0;
        shieldPopBlockedTrackers.textContent = tabStats ? (tabStats.trackersBlocked || 0) : 0;
      }
    } catch (err) {
      console.warn('[Núcleo UI] Shield sync error:', err);
    }
  };

  if (btnShield) {
    btnShield.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOpen = shieldPopover.classList.contains('show');
      menuDropdown.classList.remove('show');
      closeTabContextMenu();

      if (isOpen) {
        shieldPopover.classList.remove('show');
      } else {
        shieldPopover.classList.add('show');
        await syncShieldForActiveTab();
      }
    });
  }

  if (shieldSiteToggle) {
    shieldSiteToggle.addEventListener('change', async () => {
      const domain = extractHostname(currentActiveTabUrl);
      if (!domain || !api?.shield) return;
      await api.shield.toggleWhitelist(domain);
      await syncShieldForActiveTab();
    });
  }

  if (btnOpenShieldSettings) {
    btnOpenShieldSettings.addEventListener('click', () => {
      shieldPopover.classList.remove('show');
      api.createTab('nucleo://shield');
    });
  }

  if (menuShield) {
    menuShield.addEventListener('click', () => {
      menuDropdown.classList.remove('show');
      api.createTab('nucleo://shield');
    });
  }

  // --- Extensions Popover Handlers ---
  const updateExtensionsPopover = async () => {
    if (!api.extensions || !extensionsPopoverList) return;
    try {
      const list = await api.extensions.list();
      if (!list || list.length === 0) {
        extensionsPopoverList.innerHTML = '<div class="ext-popover-empty">Nenhuma extensão instalada</div>';
        return;
      }

      extensionsPopoverList.innerHTML = list.map(ext => `
        <div class="ext-popover-item" data-id="${ext.id}" title="${ext.name}">
          <div class="ext-popover-item-left">
            <span class="ext-popover-dot ${ext.enabled ? 'active' : 'inactive'}"></span>
            <span class="ext-popover-name">${ext.name}</span>
            <span class="ext-popover-version">v${ext.version}</span>
          </div>
          ${ext.hasPopup ? '<span class="ext-popover-action-tag">Ação</span>' : ''}
        </div>
      `).join('');

      extensionsPopoverList.querySelectorAll('.ext-popover-item').forEach(item => {
        item.addEventListener('click', async () => {
          const id = item.dataset.id;
          const ext = list.find(e => e.id === id);
          if (ext && ext.hasPopup) {
            const rect = btnExtensions.getBoundingClientRect();
            await api.extensions.openPopup({ id: ext.id, bounds: { x: rect.right, y: rect.bottom } });
          } else {
            api.createTab('nucleo://extensions');
          }
          extensionsPopover.classList.remove('show');
        });
      });
    } catch (err) {
      console.warn('[Núcleo UI] Error updating extensions popover:', err);
    }
  };

  if (btnExtensions) {
    btnExtensions.addEventListener('click', async (e) => {
      e.stopPropagation();
      const isOpen = extensionsPopover.classList.contains('show');
      menuDropdown.classList.remove('show');
      if (shieldPopover) shieldPopover.classList.remove('show');
      closeTabContextMenu();

      if (isOpen) {
        extensionsPopover.classList.remove('show');
      } else {
        extensionsPopover.classList.add('show');
        await updateExtensionsPopover();
      }
    });
  }

  if (btnPopoverManageExt) {
    btnPopoverManageExt.addEventListener('click', () => {
      extensionsPopover.classList.remove('show');
      api.createTab('nucleo://extensions');
    });
  }

  if (btnPopoverOpenManagement) {
    btnPopoverOpenManagement.addEventListener('click', () => {
      extensionsPopover.classList.remove('show');
      api.createTab('nucleo://extensions');
    });
  }

  if (btnPopoverInstallExt) {
    btnPopoverInstallExt.addEventListener('click', async () => {
      extensionsPopover.classList.remove('show');
      if (api.extensions) {
        await api.extensions.selectAndInstall();
      }
    });
  }

  if (menuExtensions) {
    menuExtensions.addEventListener('click', () => {
      menuDropdown.classList.remove('show');
      api.createTab('nucleo://extensions');
    });
  }

  // --- Tab Rendering ---
  const renderTabs = (tabs) => {
    if (!Array.isArray(tabs)) return;
    currentTabs = tabs;
    tabsContainer.innerHTML = '';

    tabs.forEach((tab) => {
      if (tab.isActive) {
        currentActiveTabId = tab.id;
        currentActiveTabUrl = tab.url || '';
        currentActiveTabTitle = tab.title || '';
        currentActiveTabFavicon = tab.favicon || null;
        syncStarStateForUrl(tab.url);
        syncShieldForActiveTab(tab.url, tab.id);
      }

      const chip = document.createElement('div');
      chip.className = `tab-chip${tab.isActive ? ' active' : ''}`;
      chip.setAttribute('data-tab-id', tab.id);
      chip.title = tab.title || 'Nova Aba';

      // Icon container
      const iconEl = document.createElement('div');
      iconEl.className = 'tab-chip-icon';

      if (tab.isLoading) {
        iconEl.innerHTML = '<div class="tab-spinner"></div>';
      } else if (tab.favicon) {
        const img = document.createElement('img');
        img.src = tab.favicon;
        img.alt = '';
        img.onerror = () => {
          iconEl.innerHTML = defaultGlobeSvg;
        };
        iconEl.appendChild(img);
      } else {
        iconEl.innerHTML = defaultGlobeSvg;
      }

      // Title
      const titleEl = document.createElement('span');
      titleEl.className = 'tab-chip-title';
      titleEl.textContent = tab.title || 'Nova Aba';

      // Close button
      const closeBtn = document.createElement('button');
      closeBtn.className = 'tab-chip-close';
      closeBtn.setAttribute('aria-label', 'Fechar aba');
      closeBtn.title = 'Fechar aba (Ctrl+W)';
      closeBtn.innerHTML = `
        <svg viewBox="0 0 10 10">
          <path d="M 1.5 1.5 L 8.5 8.5 M 8.5 1.5 L 1.5 8.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      `;

      // Event listeners
      chip.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-chip-close')) {
          api.switchTab(tab.id);
        }
      });

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        api.closeTab(tab.id);
      });

      // Context menu
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        openTabContextMenu(e.clientX, e.clientY, tab.id);
      });

      chip.appendChild(iconEl);
      chip.appendChild(titleEl);
      chip.appendChild(closeBtn);
      tabsContainer.appendChild(chip);

      if (tab.isActive) {
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    });
  };

  // --- Tab Context Menu Handlers ---
  const openTabContextMenu = (x, y, tabId) => {
    contextMenuTabId = tabId;
    populateWorkspaceSubmenu(tabId);
    tabContextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
    tabContextMenu.style.top = `${y}px`;
    tabContextMenu.classList.add('show');
  };

  const closeTabContextMenu = () => {
    tabContextMenu.classList.remove('show');
    contextMenuTabId = null;
  };

  const populateWorkspaceSubmenu = (tabId) => {
    if (!ctxWorkspaceSubmenu) return;
    ctxWorkspaceSubmenu.innerHTML = '';

    const otherWorkspaces = currentWorkspaces.filter((ws) => !ws.isActive);

    if (otherWorkspaces.length === 0) {
      const emptyItem = document.createElement('div');
      emptyItem.className = 'context-menu-item disabled';
      emptyItem.textContent = 'Sem outros workspaces';
      ctxWorkspaceSubmenu.appendChild(emptyItem);
    } else {
      for (const ws of otherWorkspaces) {
        const item = document.createElement('div');
        item.className = 'context-menu-item';
        item.innerHTML = `<span class="ws-item-icon">${getIconSymbol(ws.icon)}</span> <span>${escapeHtml(ws.name)}</span>`;
        item.addEventListener('click', async (e) => {
          e.stopPropagation();
          closeTabContextMenu();
          if (api.workspaces) {
            await api.workspaces.moveTab(tabId, ws.id, false);
          }
        });
        ctxWorkspaceSubmenu.appendChild(item);
      }
    }

    const divider = document.createElement('div');
    divider.className = 'menu-divider';
    ctxWorkspaceSubmenu.appendChild(divider);

    const newItem = document.createElement('div');
    newItem.className = 'context-menu-item';
    newItem.innerHTML = `<span>+ Mover para novo Workspace...</span>`;
    newItem.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTabContextMenu();
      openCreateWorkspaceModal({ moveTabId: tabId });
    });
    ctxWorkspaceSubmenu.appendChild(newItem);
  };

  const closeAllPopups = () => {
    menuDropdown?.classList.remove('show');
    shieldPopover?.classList.remove('show');
    extensionsPopover?.classList.remove('show');
    closeTabContextMenu();
    closeWorkspaceContextMenu();
    if (workspacePopover) {
      workspacePopover.style.display = 'none';
      btnWorkspaceSelect?.classList.remove('open');
    }
  };

  // --- Workspaces UI Controller Methods ---
  const updateWorkspacePill = (ws = currentActiveWorkspace) => {
    if (ws) currentActiveWorkspace = ws;
    if (!currentActiveWorkspace) return;
    if (workspaceActiveName) workspaceActiveName.textContent = currentActiveWorkspace.name;
    if (workspaceActiveIcon) workspaceActiveIcon.textContent = getIconSymbol(currentActiveWorkspace.icon);
    if (workspaceActiveDot) {
      const hex = getColorHex(currentActiveWorkspace.color);
      workspaceActiveDot.style.backgroundColor = hex;
      workspaceActiveDot.style.boxShadow = `0 0 6px ${hex}`;
    }
  };

  const renderWorkspacePopover = () => {
    if (!workspaceItemsList) return;
    workspaceItemsList.innerHTML = '';

    currentWorkspaces.forEach((ws) => {
      const row = document.createElement('div');
      row.className = `ws-row ${ws.isActive ? 'active' : ''}`;
      row.dataset.id = ws.id;

      const left = document.createElement('div');
      left.className = 'ws-row-left';
      left.innerHTML = `
        <span class="ws-color-dot" style="background-color: ${getColorHex(ws.color)}; box-shadow: 0 0 6px ${getColorHex(ws.color)};"></span>
        <span class="ws-icon-symbol">${getIconSymbol(ws.icon)}</span>
        <div class="ws-meta">
          <span class="ws-name">${escapeHtml(ws.name)}</span>
          <span class="ws-tabs-count">${ws.tabCount} ${ws.tabCount === 1 ? 'aba' : 'abas'}</span>
        </div>
      `;

      left.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeAllPopups();
        if (!ws.isActive && api.workspaces) {
          await api.workspaces.switch(ws.id);
        }
      });

      const actions = document.createElement('div');
      actions.className = 'ws-row-actions';
      actions.innerHTML = `
        <button class="ws-action-btn" title="Opções do workspace">
          <svg viewBox="0 0 16 16"><circle cx="8" cy="3.5" r="1.3" fill="currentColor"/><circle cx="8" cy="8" r="1.3" fill="currentColor"/><circle cx="8" cy="12.5" r="1.3" fill="currentColor"/></svg>
        </button>
      `;

      actions.querySelector('.ws-action-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openWorkspaceContextMenu(e.clientX, e.clientY, ws.id);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openWorkspaceContextMenu(e.clientX, e.clientY, ws.id);
      });

      row.appendChild(left);
      row.appendChild(actions);
      workspaceItemsList.appendChild(row);
    });
  };

  const openWorkspaceContextMenu = (x, y, wsId) => {
    closeAllPopups();
    contextMenuWsId = wsId;
    if (!workspaceContextMenu) return;
    if (ctxWsDelete) {
      if (currentWorkspaces.length <= 1) {
        ctxWsDelete.classList.add('disabled');
        ctxWsDelete.style.opacity = '0.5';
        ctxWsDelete.style.pointerEvents = 'none';
      } else {
        ctxWsDelete.classList.remove('disabled');
        ctxWsDelete.style.opacity = '1';
        ctxWsDelete.style.pointerEvents = 'auto';
      }
    }
    workspaceContextMenu.style.left = `${Math.min(x, window.innerWidth - 180)}px`;
    workspaceContextMenu.style.top = `${y}px`;
    workspaceContextMenu.style.display = 'block';
    workspaceContextMenu.classList.add('show');
  };

  const closeWorkspaceContextMenu = () => {
    if (workspaceContextMenu) {
      workspaceContextMenu.style.display = 'none';
      workspaceContextMenu.classList.remove('show');
    }
    contextMenuWsId = null;
  };

  const renderColorPicker = () => {
    if (!wsColorPicker) return;
    wsColorPicker.innerHTML = '';
    WORKSPACE_COLORS.forEach((col) => {
      const swatch = document.createElement('div');
      swatch.className = `ws-color-swatch ${col.id === selectedModalColor ? 'selected' : ''}`;
      swatch.style.backgroundColor = col.hex;
      swatch.title = col.id;
      swatch.addEventListener('click', () => {
        selectedModalColor = col.id;
        renderColorPicker();
      });
      wsColorPicker.appendChild(swatch);
    });
  };

  const renderIconPicker = () => {
    if (!wsIconPicker) return;
    wsIconPicker.innerHTML = '';
    WORKSPACE_ICONS.forEach((ico) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ws-icon-btn ${ico.id === selectedModalIcon ? 'selected' : ''}`;
      btn.textContent = ico.symbol;
      btn.title = ico.label;
      btn.addEventListener('click', () => {
        selectedModalIcon = ico.id;
        renderIconPicker();
      });
      wsIconPicker.appendChild(btn);
    });
  };

  const openCreateWorkspaceModal = (options = {}) => {
    closeAllPopups();
    editingWorkspaceId = null;
    moveTabOnCreate = options.moveTabId || null;
    selectedModalColor = 'cyan';
    selectedModalIcon = 'briefcase';
    if (workspaceModalTitle) {
      workspaceModalTitle.textContent = moveTabOnCreate ? 'Mover para Novo Workspace' : 'Novo Workspace';
    }
    if (wsInputName) {
      wsInputName.value = '';
    }
    renderColorPicker();
    renderIconPicker();
    if (workspaceEditModal) {
      workspaceEditModal.style.display = 'flex';
      setTimeout(() => wsInputName?.focus(), 50);
    }
  };

  const openEditWorkspaceModal = (wsId) => {
    closeAllPopups();
    const ws = currentWorkspaces.find((w) => w.id === wsId);
    if (!ws) return;
    editingWorkspaceId = wsId;
    moveTabOnCreate = null;
    selectedModalColor = ws.color || 'cyan';
    selectedModalIcon = ws.icon || 'briefcase';
    if (workspaceModalTitle) {
      workspaceModalTitle.textContent = 'Editar Workspace';
    }
    if (wsInputName) {
      wsInputName.value = ws.name;
    }
    renderColorPicker();
    renderIconPicker();
    if (workspaceEditModal) {
      workspaceEditModal.style.display = 'flex';
      setTimeout(() => wsInputName?.focus(), 50);
    }
  };

  const closeEditModal = () => {
    if (workspaceEditModal) {
      workspaceEditModal.style.display = 'none';
    }
    editingWorkspaceId = null;
    moveTabOnCreate = null;
  };

  const openDeleteWorkspaceModal = (wsId) => {
    closeAllPopups();
    if (currentWorkspaces.length <= 1) {
      alert('Não é possível excluir o único workspace.');
      return;
    }
    const ws = currentWorkspaces.find((w) => w.id === wsId);
    if (!ws) return;
    deletingWorkspaceId = wsId;
    if (wsDeleteMessage) {
      wsDeleteMessage.textContent = `O workspace "${ws.name}" possui ${ws.tabCount} ${ws.tabCount === 1 ? 'aba' : 'abas'}. O que você deseja fazer?`;
    }
    if (workspaceDeleteModal) {
      workspaceDeleteModal.style.display = 'flex';
    }
  };

  const closeDeleteModal = () => {
    if (workspaceDeleteModal) {
      workspaceDeleteModal.style.display = 'none';
    }
    deletingWorkspaceId = null;
  };

  btnWsModalSave?.addEventListener('click', async () => {
    const rawName = wsInputName ? wsInputName.value.trim() : '';
    const name = rawName || 'Workspace';

    if (editingWorkspaceId) {
      if (api.workspaces) {
        await api.workspaces.rename(editingWorkspaceId, name);
        await api.workspaces.setColor(editingWorkspaceId, selectedModalColor);
        await api.workspaces.setIcon(editingWorkspaceId, selectedModalIcon);
      }
    } else {
      if (api.workspaces) {
        const created = await api.workspaces.create({
          name,
          color: selectedModalColor,
          icon: selectedModalIcon
        });
        if (moveTabOnCreate && created) {
          await api.workspaces.moveTab(moveTabOnCreate, created.id, true);
        }
      }
    }
    closeEditModal();
  });

  btnWsModalCancel?.addEventListener('click', closeEditModal);
  btnWsModalClose?.addEventListener('click', closeEditModal);

  btnWsDeleteMoveTabs?.addEventListener('click', async () => {
    if (deletingWorkspaceId && api.workspaces) {
      const fallback = currentWorkspaces.find((w) => w.id !== deletingWorkspaceId);
      if (fallback) {
        await api.workspaces.delete(deletingWorkspaceId, { targetWorkspaceId: fallback.id });
      }
    }
    closeDeleteModal();
  });

  btnWsDeleteCloseTabs?.addEventListener('click', async () => {
    if (deletingWorkspaceId && api.workspaces) {
      await api.workspaces.delete(deletingWorkspaceId, {});
    }
    closeDeleteModal();
  });

  btnWsDeleteCancel?.addEventListener('click', closeDeleteModal);
  btnWsDeleteClose?.addEventListener('click', closeDeleteModal);

  ctxWsRename?.addEventListener('click', () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id) openEditWorkspaceModal(id);
  });

  ctxWsChangeColor?.addEventListener('click', () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id) openEditWorkspaceModal(id);
  });

  ctxWsChangeIcon?.addEventListener('click', () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id) openEditWorkspaceModal(id);
  });

  ctxWsDuplicate?.addEventListener('click', async () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id && api.workspaces) {
      await api.workspaces.duplicate(id);
    }
  });

  ctxWsMoveUp?.addEventListener('click', async () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id && api.workspaces) {
      await api.workspaces.moveUp(id);
    }
  });

  ctxWsMoveDown?.addEventListener('click', async () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id && api.workspaces) {
      await api.workspaces.moveDown(id);
    }
  });

  ctxWsDelete?.addEventListener('click', () => {
    const id = contextMenuWsId;
    closeWorkspaceContextMenu();
    if (id) openDeleteWorkspaceModal(id);
  });

  const toggleWorkspacePopover = () => {
    const isShowing = workspacePopover && workspacePopover.style.display === 'block';
    closeAllPopups();
    if (!isShowing && workspacePopover) {
      renderWorkspacePopover();
      workspacePopover.style.display = 'block';
      btnWorkspaceSelect?.classList.add('open');
    }
  };

  btnWorkspaceSelect?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleWorkspacePopover();
  });

  btnCreateWorkspace?.addEventListener('click', (e) => {
    e.stopPropagation();
    openCreateWorkspaceModal();
  });

  ctxNewTab.addEventListener('click', () => {
    api.createTab();
    closeTabContextMenu();
  });

  ctxReloadTab.addEventListener('click', () => {
    api.reload();
    closeTabContextMenu();
  });

  ctxDuplicateTab.addEventListener('click', () => {
    if (contextMenuTabId) {
      api.duplicateTab(contextMenuTabId);
    }
    closeTabContextMenu();
  });

  ctxCloseTab.addEventListener('click', () => {
    if (contextMenuTabId) {
      api.closeTab(contextMenuTabId);
    }
    closeTabContextMenu();
  });

  ctxCloseOtherTabs.addEventListener('click', () => {
    if (contextMenuTabId) {
      api.closeOtherTabs(contextMenuTabId);
    }
    closeTabContextMenu();
  });

  ctxCloseTabsRight.addEventListener('click', () => {
    if (contextMenuTabId) {
      api.closeTabsToTheRight(contextMenuTabId);
    }
    closeTabContextMenu();
  });

  // --- Navigation Controls ---
  const triggerNavigation = () => {
    const value = addressBar.getValue();
    if (value) {
      api.navigate(value);
      addressInput.blur();
    }
  };

  addressInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      triggerNavigation();
    }
  });

  btnOmniboxAction.addEventListener('click', triggerNavigation);

  btnBack.addEventListener('click', () => api.goBack());
  btnForward.addEventListener('click', () => api.goForward());

  btnReload.addEventListener('click', () => {
    if (currentLoading) {
      api.stop();
    } else {
      api.reload();
    }
  });

  btnNewTab.addEventListener('click', () => api.createTab());

  // --- Window Controls ---
  btnMinimize.addEventListener('click', () => api.minimizeWindow());
  btnMaximize.addEventListener('click', () => api.maximizeWindow());
  btnClose.addEventListener('click', () => api.closeWindow());

  // --- DevTools & Menu ---
  btnDevTools.addEventListener('click', () => api.toggleWebDevTools());

  btnMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    menuDropdown.classList.toggle('show');
  });

  menuNewTab.addEventListener('click', () => {
    api.createTab();
    menuDropdown.classList.remove('show');
  });

  if (menuNewWindow) {
    menuNewWindow.addEventListener('click', () => {
      api.createTab();
      menuDropdown.classList.remove('show');
    });
  }

  menuCloseTab.addEventListener('click', () => {
    if (currentActiveTabId) {
      api.closeTab(currentActiveTabId);
    }
    menuDropdown.classList.remove('show');
  });

  menuReload.addEventListener('click', () => {
    api.reload();
    menuDropdown.classList.remove('show');
  });

  if (menuBookmarks) {
    menuBookmarks.addEventListener('click', () => {
      api.createTab('nucleo://bookmarks');
      menuDropdown.classList.remove('show');
    });
  }

  if (menuToggleBookmarksBar) {
    menuToggleBookmarksBar.addEventListener('click', () => {
      api.bookmarks.toggleBar();
      menuDropdown.classList.remove('show');
    });
  }

  if (menuHistory) {
    menuHistory.addEventListener('click', () => {
      api.createTab('nucleo://history');
      menuDropdown.classList.remove('show');
    });
  }

  menuDevToolsWeb.addEventListener('click', () => {
    api.toggleWebDevTools();
    menuDropdown.classList.remove('show');
  });

  menuDevToolsUI.addEventListener('click', () => {
    api.toggleUIDevTools();
    menuDropdown.classList.remove('show');
  });

  if (menuSettings) {
    menuSettings.addEventListener('click', () => {
      api.createTab('nucleo://settings');
      menuDropdown.classList.remove('show');
    });
  }

  menuAbout.addEventListener('click', () => {
    api.createTab('nucleo://settings');
    menuDropdown.classList.remove('show');
  });

  // Close menus on click outside
  document.addEventListener('click', (e) => {
    if (!menuDropdown.contains(e.target) && e.target !== btnMenu) {
      menuDropdown.classList.remove('show');
    }
    if (shieldPopover && !shieldPopover.contains(e.target) && e.target !== btnShield && !btnShield?.contains(e.target)) {
      shieldPopover.classList.remove('show');
    }
    if (extensionsPopover && !extensionsPopover.contains(e.target) && e.target !== btnExtensions && !btnExtensions?.contains(e.target)) {
      extensionsPopover.classList.remove('show');
    }
    if (workspacePopover && !workspacePopover.contains(e.target) && !btnWorkspaceSelect?.contains(e.target)) {
      workspacePopover.style.display = 'none';
      btnWorkspaceSelect?.classList.remove('open');
    }
    if (workspaceContextMenu && !workspaceContextMenu.contains(e.target)) {
      closeWorkspaceContextMenu();
    }
    if (!tabContextMenu.contains(e.target)) {
      closeTabContextMenu();
    }
  });

  // --- Global Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const key = e.key.toLowerCase();

    if (isCtrl && e.altKey && (e.key === 'ArrowRight' || e.key === 'Right')) {
      e.preventDefault();
      if (currentWorkspaces.length > 1 && currentActiveWorkspace && api.workspaces) {
        const curIdx = currentWorkspaces.findIndex(w => w.id === currentActiveWorkspace.id);
        const nextIdx = (curIdx + 1) % currentWorkspaces.length;
        api.workspaces.switch(currentWorkspaces[nextIdx].id);
      }
    } else if (isCtrl && e.altKey && (e.key === 'ArrowLeft' || e.key === 'Left')) {
      e.preventDefault();
      if (currentWorkspaces.length > 1 && currentActiveWorkspace && api.workspaces) {
        const curIdx = currentWorkspaces.findIndex(w => w.id === currentActiveWorkspace.id);
        const prevIdx = (curIdx - 1 + currentWorkspaces.length) % currentWorkspaces.length;
        api.workspaces.switch(currentWorkspaces[prevIdx].id);
      }
    } else if (isCtrl && e.altKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      const targetIdx = parseInt(e.key, 10) - 1;
      if (targetIdx >= 0 && targetIdx < currentWorkspaces.length && api.workspaces) {
        api.workspaces.switch(currentWorkspaces[targetIdx].id);
      }
    } else if (isCtrl && e.altKey && key === 'n') {
      e.preventDefault();
      openCreateWorkspaceModal();
    } else if (isCtrl && isShift && key === 'b') {
      e.preventDefault();
      api.bookmarks.toggleBar();
    } else if (isCtrl && isShift && key === 'e') {
      e.preventDefault();
      api.createTab('nucleo://extensions');
    } else if (isCtrl && key === 'd') {
      e.preventDefault();
      toggleBookmarkCurrentTab();
    } else if (isCtrl && (key === 'h')) {
      e.preventDefault();
      api.createTab('nucleo://history');
    } else if (isCtrl && isShift && (key === 'o')) {
      e.preventDefault();
      api.createTab('nucleo://bookmarks');
    } else if (isCtrl && key === 't') {
      e.preventDefault();
      api.createTab();
    } else if (isCtrl && key === 'w') {
      e.preventDefault();
      if (currentActiveTabId) {
        api.closeTab(currentActiveTabId);
      }
    } else if (isCtrl && isShift && key === 'tab') {
      e.preventDefault();
      api.switchPreviousTab();
    } else if (isCtrl && key === 'tab') {
      e.preventDefault();
      api.switchNextTab();
    } else if (isCtrl && e.key >= '1' && e.key <= '8') {
      e.preventDefault();
      api.switchTabIndex(parseInt(e.key, 10) - 1);
    } else if (isCtrl && e.key === '9') {
      e.preventDefault();
      api.switchTabIndex(currentTabs.length - 1);
    } else if (isCtrl && key === 'l') {
      e.preventDefault();
      addressBar.focus();
    } else if (e.key === 'F5' || (isCtrl && key === 'r')) {
      e.preventDefault();
      api.reload();
    } else if (e.key === 'F12') {
      e.preventDefault();
      api.toggleWebDevTools();
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      api.goBack();
    } else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      api.goForward();
    } else if (e.key === 'Escape') {
      closeAllPopups();
      closeEditModal();
      closeDeleteModal();
    }
  });

  // --- State Synchronization from Main Process ---
  api.onAllTabsUpdated((tabs) => {
    renderTabs(tabs);
  });

  api.onNavStateChanged((state) => {
    if (!state) return;

    // Back / Forward availability
    btnBack.disabled = !state.canGoBack;
    btnForward.disabled = !state.canGoForward;

    // Loading State
    currentLoading = Boolean(state.isLoading);
    if (currentLoading) {
      progressBar.classList.add('loading');
      reloadIcon.classList.add('rotating');
      btnReload.title = 'Parar carregamento';
    } else {
      progressBar.classList.remove('loading');
      reloadIcon.classList.remove('rotating');
      btnReload.title = 'Recarregar (Ctrl+R / F5)';
    }

    // URL Display
    if (state.url) {
      currentActiveTabUrl = state.url;
      addressBar.setDisplayUrl(state.url);
      syncStarStateForUrl(state.url);
      syncShieldForActiveTab(state.url, currentActiveTabId);
    }

    if (state.title) {
      currentActiveTabTitle = state.title;
      document.title = `${state.title} — Núcleo Browser`;
    }

    if (state.favicon) {
      currentActiveTabFavicon = state.favicon;
    }

    // Security indicator
    if (state.isSecure) {
      securityBadge.classList.remove('insecure');
      securityBadge.title = 'Conexão segura (HTTPS)';
    } else {
      securityBadge.classList.add('insecure');
      securityBadge.title = 'Conexão não criptografada ou local';
    }
  });

  // Window State Synchronization
  api.onWindowStateChanged((state) => {
    if (!state) return;
    if (state.isMaximized) {
      maximizeIcon.innerHTML = `
        <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1.2"/>
        <polyline points="0.5,3 0.5,9.5 7,9.5" fill="none" stroke="currentColor" stroke-width="1.2"/>
      `;
      btnMaximize.title = 'Restaurar';
    } else {
      maximizeIcon.innerHTML = `
        <rect x="0.6" y="0.6" width="8.8" height="8.8" fill="none" stroke="currentColor" stroke-width="1.2"/>
      `;
      btnMaximize.title = 'Maximizar';
    }
  });

  // Bookmarks Bar toggle listener from Main Process
  if (api.onBookmarksBarToggled) {
    api.onBookmarksBarToggled((data) => {
      updateBookmarksBarDisplay(data.visible);
    });
  }

  // Bookmarks updated listener from Main Process
  if (api.bookmarks?.onUpdated) {
    api.bookmarks.onUpdated(async () => {
      if (isBarVisible) {
        await renderBookmarksBar();
      }
      if (currentActiveTabUrl) {
        await syncStarStateForUrl(currentActiveTabUrl);
      }
    });
  }

  // Shield real-time listeners from Main Process
  if (api.shield?.onTabStatsUpdated) {
    api.shield.onTabStatsUpdated((data) => {
      if (data && (!data.tabId || data.tabId === currentActiveTabId)) {
        syncShieldForActiveTab();
      }
    });
  }

  if (api.shield?.onStateChanged) {
    api.shield.onStateChanged(() => {
      syncShieldForActiveTab();
    });
  }

  if (api.shield?.onWhitelistChanged) {
    api.shield.onWhitelistChanged(() => {
      syncShieldForActiveTab();
    });
  }

  // Extensions updated listener from Main Process
  if (api.extensions?.onUpdated) {
    api.extensions.onUpdated(() => {
      if (extensionsPopover && extensionsPopover.classList.contains('show')) {
        updateExtensionsPopover();
      }
    });
  }

  // Theme application helper
  const applyTheme = (theme, accentColor) => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
      root.setAttribute('data-theme', prefersLight ? 'light' : 'dark');
    }
    if (accentColor) {
      root.setAttribute('data-accent', accentColor);
    }
  };

  if (api.settings?.onThemeChanged) {
    api.settings.onThemeChanged(({ theme, accentColor }) => {
      applyTheme(theme, accentColor);
    });
  }

  // Workspaces updated listener from Main Process
  if (api.workspaces?.onUpdated) {
    api.workspaces.onUpdated(async (workspaces) => {
      currentWorkspaces = workspaces || [];
      if (api.workspaces.getActive) {
        currentActiveWorkspace = await api.workspaces.getActive();
      }
      updateWorkspacePill(currentActiveWorkspace);
      if (workspacePopover && workspacePopover.style.display === 'block') {
        renderWorkspacePopover();
      }
    });
  }

  // Workspaces activated listener from Main Process
  if (api.workspaces?.onActivated) {
    api.workspaces.onActivated(async (ws) => {
      currentActiveWorkspace = ws;
      updateWorkspacePill(ws);
      if (api.workspaces.list) {
        currentWorkspaces = await api.workspaces.list();
      }
      if (workspacePopover && workspacePopover.style.display === 'block') {
        renderWorkspacePopover();
      }
    });
  }

  // Initial tab loading & bookmarks bar state
  try {
    if (api.workspaces) {
      currentWorkspaces = (await api.workspaces.list()) || [];
      currentActiveWorkspace = await api.workspaces.getActive();
      updateWorkspacePill(currentActiveWorkspace);
    }

    const initialTabs = await api.getAllTabs();
    renderTabs(initialTabs);

    if (api.bookmarks?.isBarVisible) {
      const barVisible = await api.bookmarks.isBarVisible();
      updateBookmarksBarDisplay(barVisible);
    }

    if (api.settings) {
      const theme = await api.settings.get('appearance.theme');
      const accent = await api.settings.get('appearance.accentColor');
      applyTheme(theme, accent);
    }

    await syncShieldForActiveTab();
  } catch (err) {
    console.warn('[Núcleo UI] Initialization error:', err);
  }
});
