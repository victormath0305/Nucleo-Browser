# Arquitetura Técnica — Núcleo Browser (v0.8.0 — Download Manager Nativo)

Este documento descreve a fundamentação de engenharia, a seleção de tecnologias, a arquitetura de processos, o sistema completo de abas, os subsistemas de Workspaces, o subsistema de Download Manager nativo, favoritos, histórico, Núcleo Shield, Sistema de Extensões Chromium (MV3 & MV2), a Central de Configurações persistente, Provedores de Busca, detecção de Navegador Padrão Windows, a estratégia de persistência local atômica serializada, os padrões de segurança e a modularidade do **Núcleo Browser**.

---

## 1. Seleção de Tecnologia e Avaliação Comparativa

Para construir um navegador desktop real para Windows com planos de suportar extensões, bloqueio avançado de anúncios e rastreadores, privacidade, IA e DevTools, avaliamos as quatro principais abordagens do ecossistema:

| Critério | Chromium Puro (Fork C++) | CEF (Chromium Embedded Framework) | WebView2 (Edge Runtime) | **Electron (WebContentsView + Node.js)** |
| :--- | :--- | :--- | :--- | :--- |
| **Engine Web** | Chromium Nativo (Blink / V8) | Chromium Nativo | Chromium (Edge) | **Chromium Nativo (v152+)** |
| **Compatibilidade de Sites** | 100% | 99% | 100% | **100% (HTML5, WebGL, WebRTC, WASM)** |
| **Suporte a Extensões** | Nativo completo via C++ | Parcial / Experimental | Não suportado oficialmente | **Nativo via `session.loadExtension` (MV2/MV3)** |
| **Controle de UI** | Views Framework (C++) | Win32/WPF/OSR (complexo) | XAML/WinUI/HTML | **Total (HTML5/CSS3 moderno com isolamento)** |
| **Intercepção de Rede (AdBlock)** | C++ Network Stack | CefResourceRequestHandler | Filter web requests básico | **Nativo via `session.webRequest` (EasyList / Shield)** |
| **Integração com IA** | C++ bindings manuais | C++ bindings | Depende do host | **Nativo (ONNX, WebGPU, Node APIs, Local LLM)** |
| **DevTools** | Nativo | Nativo | Nativo | **Nativo (`openDevTools` com docking)** |
| **Viabilidade & Manutenção** | Inviável p/ equipes enxutas (40GB código, horas de build) | Média/Alta complexidade de compilação | Média (dependência do Edge) | **Excelente (manutenível, modular, atualizações ágeis)** |
| **Distribuição Windows** | Compilação C++ de instalador | Empacotamento manual de DLLs (150MB+) | Runtime preinstalado | **`electron-builder` (Instalador NSIS, Portátil, Auto-update)** |

### Decisão: Electron com a moderna API `WebContentsView`

A tecnologia escolhida para a fundação do Núcleo Browser é o **Electron** configurado em arquitetura de navegador isolado com `WebContentsView`.

---

## 2. Arquitetura de Processos e Isolamento

O Núcleo Browser adota rigorosamente a arquitetura multi-processos do Chromium:

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                MAIN PROCESS (Node.js)                                  │
│                                                                                        │
│  ┌───────────────────┐  ┌──────────────────┐  ┌─────────────────────┐  ┌─────────────┐ │
│  │   BrowserEngine   │  │ BrowserWindowCtrl│  │     TabManager      │  │DownloadsMgr │ │
│  │ (Session/Protocol)│  │ (Window Layout)  │  │ (Tabs Collection)   │  │(will-downld)│ │
│  └────────┬──────────┘  └────────┬─────────┘  └──────────┬──────────┘  └──────┬──────┘ │
│           │                      │                       │                    │        │
│  ┌────────┴──────────┐  ┌────────┴─────────┐  ┌──────────┴──────────┐  ┌──────┴──────┐ │
│  │   ShieldManager   │  │  BookmarkManager │  │  WorkspaceManager   │  │DownloadsSt. │ │
│  │(Blocking/Session) │  │  (Store/Folders) │  │ (Contexts / Switch) │  │(downloads)  │ │
│  └────────┬──────────┘  └────────┬─────────┘  └──────────┬──────────┘  └─────────────┘ │
│           │                      │                       │                             │
│  ┌────────┴──────────┐  ┌────────┴─────────┐  ┌──────────┴──────────┐                  │
│  │   ShieldEngine    │  │  BookmarkStore   │  │   WorkspaceStore    │                  │
│  │ (Rules/LRU Cache) │  │ (bookmarks.json) │  │  (workspaces.json)  │                  │
│  └────────┬──────────┘  └──────────────────┘  └─────────────────────┘                  │
│           │                                                                            │
│  ┌────────┴──────────┐  ┌──────────────────┐  ┌─────────────────────┐                  │
│  │FilterStore & Stats│  │ NavigationCtrl   │  │   HistoryManager    │                  │
│  │   (shield.json)   │  │ (URL Resolution) │  │   (history.json)    │                  │
│  └───────────────────┘  └──────────────────┘  └─────────────────────┘                  │
│                                  │                                                     │
│                         IPC Handlers Registry                                          │
└──────────────┬───────────────────────────────┬─────────────────────────────────────────┘
               │ (IPC Seguro via Preload)       │ (View Hierarchy)
               ▼                               ▼
┌───────────────────────────────┐  ┌─────────────────────────────────────┐
│    UI CHROME RENDERER         │  │     WEB CONTENTS VIEW (Ativa)       │
│    (Interface do Navegador)   │  │     (Página Web Real)               │
│                               │  │                                     │
│  • Top Bar (Abas + Ações)     │  │  • Renderizador 100% Sandboxed      │
│  • Omnibox / Estrela Favorito │  │  • Zero acesso a Node.js / Electron │
│  • Botão Shield + Contador    │  │  • Intercepção antes do carregamento│
│  • Popover do Núcleo Shield   │  │  • contextIsolation: TRUE          │
│  • Barra de Favoritos (Opt)   │  │  • nodeIntegration: FALSE          │
│  • contextIsolation: TRUE     │  │  • sandbox: TRUE                   │
│  • nodeIntegration: FALSE     │  │                                     │
│  • sandbox: TRUE              │  │                                     │
└───────────────────────────────┘  └─────────────────────────────────────┘
```

---

## 3. Subsistema de Favoritos (`BookmarkManager` e `BookmarkStore`)

Localizado em `src/main/modules/bookmarks/`:

### 3.1. `BookmarkStore`
* Responsável pela persistência em disco no diretório do usuário (`app.getPath('userData')/bookmarks.json`).
* **Estrutura de dados versionada**:
  ```json
  {
    "version": 1,
    "folders": [
      { "id": "root", "title": "Todos os Favoritos", "parentId": null, "createdAt": 1727700000000 },
      { "id": "toolbar", "title": "Barra de Favoritos", "parentId": "root", "createdAt": 1727700000000 },
      { "id": "other", "title": "Outros Favoritos", "parentId": "root", "createdAt": 1727700000000 }
    ],
    "bookmarks": []
  }
  ```
* **Gravação Atômica**: Grava em arquivo temporário (`.tmp.<timestamp>`) e executa renomeação atômica (`fs.promises.rename`), prevenindo corrupção em desligamentos abruptos.

### 3.2. `BookmarkManager`
* **Lógica de Negócios**:
  * Adicionar favorito com normalização de URLs (remove barras finais e comparações consistentes) e atualização automática caso a URL já exista, evitando duplicatas acidentais.
  * Remoção por ID ou URL.
  * Edição de título, URL e pasta destino.
  * Criação, renomeação e exclusão de pastas (com reparenting automático de subitens para a pasta pai).
  * Movimentação de favoritos entre pastas.
  * Busca em tempo real e geração de árvore hierárquica completa (`getTree()`).
  * Consulta de favoritos da barra (`getToolbarBookmarks()`) e de acesso rápido (`getQuickAccessBookmarks(limit)`).

---

## 4. Subsistema de Histórico (`HistoryManager` e `HistoryStore`)

Localizado em `src/main/modules/history/`:

### 4.1. `HistoryStore`
* Arquivo versionado em `app.getPath('userData')/history.json`.
* **Política de Retenção**: Limite de 10.000 entradas mais recentes. Ao ultrapassar o limite, descarta automaticamente as entradas mais antigas.
* Gravação atômica idêntica à do `BookmarkStore`.

### 4.2. `HistoryManager`
* **Gravação Automática de Visitas**:
  * Ao carregar uma página, registra URL, título, favicon, horário da primeira e última visita, e contador cumulativo (`visitCount`).
  * Atualizações de título dinâmico recebidas do evento `page-title-updated` do WebContents.
* **Privacidade Estrita**:
  * **Exclusão de Páginas Internas**: URLs `nucleo://`, `about:blank`, `file://`, `data:` e `javascript:` nunca são gravadas.
  * **Exclusão de Abas Privadas**: Abas com flag `isPrivate: true` são totalmente ignoradas pelo histórico.
  * Não há captura de senhas, campos de formulário ou cookies.
* **Limpeza por Período**:
  * Métodos dedicados para limpar: `last15Minutes`, `today`, `last7Days` e `all`.
  * Exclusão seletiva de itens individuais por ID.
  * Busca de histórico com suporte a paginação (`limit` e `offset`).

---

## 5. Subsistema Núcleo Shield (`src/main/modules/shield/`)

O **Núcleo Shield** é o subsistema nativo de privacidade e proteção contra publicidade indesejada, telemetria e rastreadores de terceiros. Diferente de extensões que ocultam elementos via CSS injetado após o carregamento, o Shield atua diretamente no ciclo de vida de rede do Chromium via `session.webRequest.onBeforeRequest`, abortando requisições com `{ cancel: true }` antes de qualquer conexão HTTP(S) ser disparada.

```text
                                  Requisição HTTP(S)
                                          │
                                          ▼
                      ┌───────────────────────────────────────┐
                      │    session.webRequest.onBeforeRequest  │
                      └───────────────────┬───────────────────┘
                                          │
                        URL interna (nucleo:, file:, chrome:) ?
                                ├── Sim ──► [ PERMITIR ]
                                │
                                Não
                                │
                                ▼
                       Shield Ativado Globalmente ?
                                ├── Não ──► [ PERMITIR ]
                                │
                                Sim
                                │
                                ▼
                      Domínio na Whitelist / Exceções ?
                                ├── Sim ──► [ PERMITIR ]
                                │
                                Não
                                │
                                ▼
                      ┌───────────────────────────────────────┐
                      │             ShieldEngine              │
                      │  1. Consulta no LRU Cache             │
                      │  2. O(1) Exact Domain Map             │
                      │  3. Wildcard & Domain Suffix Tree     │
                      │  4. Regex URL Patterns                │
                      └───────────────────┬───────────────────┘
                                          │
                         Corresponde a Regra de Bloqueio ?
                                ├── Não ──► [ PERMITIR ]
                                │
                                Sim
                                │
                                ▼
                      ┌───────────────────────────────────────┐
                      │  • Abortar com { cancel: true }       │
                      │  • Incrementar Stats (Aba e Global)   │
                      │  • Emitir EVENT_SHIELD_TAB_STATS      │
                      │  • Atualizar Badge no Chrome UI       │
                      └───────────────────────────────────────┘
```

### 5.1. Componentes do Núcleo Shield

1. **`FilterParser` (`filter-parser.js`)**:
   * Parser sintático de regras de filtragem no padrão Adblock Plus e listas de hosts.
   * Suporta domínios exatos (`doubleclick.net`), prefixos com âncora de domínio (`||google-analytics.com^`), curingas (`*.adsystem.com`), caminhos de URL (`*/ads/*`, `*/track/*`) e regras de exceção (`@@||example.com`).
   * Categorização heurística automática das regras em `ads`, `trackers`, `analytics` e `other`.

2. **`FilterStore` (`filter-store.js`)**:
   * Persistência versionada (`shield.json`) no diretório do usuário contendo:
     * Conjunto de 34 regras nativas offline embutidas (incluindo fixtures determinísticas `shield-test-ad.local` e `shield-test-tracker.local`).
     * Regras customizadas do usuário.
     * Lista de exceções/whitelist por domínio.
     * Estatísticas cumulativas persistentes (`totalBlocked`, `adsBlocked`, `trackersBlocked`, `otherBlocked`).
   * **Fila de Gravação Serializada para Windows**:
     * Para prevenir colisões de I/O (`ENOENT` / lock de arquivo no `fs.promises.rename` do Windows em cenários de requisições de alta frequência), o `FilterStore` implementa uma fila com promise em cadeia (`_saving` e `_saveQueued`) e arquivos temporários com sufixo randômico único (`.tmp.<timestamp>-<random>`).

3. **`ShieldEngine` (`shield-engine.js`)**:
   * Motor de decisão de alta performance:
     * Mapeamento O(1) de domínios exatos via `Map`.
     * Conjunto de expressões regulares para curingas e padrões de URL compilados na inicialização.
     * **Cache LRU (Least Recently Used)** com limite configurável (`MAX_CACHE_SIZE = 2000`) para garantir avaliação com latência inferior a 0.05ms em requisições recorrentes.
     * Rastreamento de métricas operacionais (`totalEvaluations`, `cacheHits`, `cacheMisses`).

4. **`ShieldStats` (`shield-stats.js`)**:
   * Gerenciador de contadores por aba em memória (`perTabStats`).
   * **Reset Inteligente por Navegação**:
     * Ao navegar para um novo domínio (`onTabNavigated`), os contadores daquela aba são reinicializados, garantindo que o usuário veja estritamente o número de bloqueios do site atualmente aberto.
     * Mudanças de âncora/hash na mesma página mantêm as métricas intactas.
   * Contadores cumulativos sincronizados com o `FilterStore`.

5. **`ShieldManager` (`shield-manager.js`)**:
   * Orquestrador principal do subsistema.
   * Registra o listener no `session.webRequest.onBeforeRequest`.
   * Resolve o contexto da aba requisitante via `tabManager.getTabByWebContentsId(webContentsId)`.
   * Valida whitelist do site atual antes da avaliação do motor.
   * Despacha eventos IPC (`EVENT_SHIELD_STATS_UPDATED`, `EVENT_SHIELD_TAB_STATS`, `EVENT_SHIELD_STATE_CHANGED`) para a interface gráfica.

### 5.2. Páginas Internas e Diagnósticos

* **`nucleo://shield`**: Painel completo do usuário com alternador mestre de proteção, cartões de métricas globais em tempo real, total de regras ativas, gerenciamento de exceções e ações para resetar métricas ou restaurar filtros padrão.
* **`nucleo://shield-test`**: Suíte de teste determinística offline integrada. Executa requisições de teste controladas contra domínios simulados (`shield-test-ad.local`, `shield-test-tracker.local`, `*/ads/banner.js` e recurso limpo), verificando bloqueio ativo (`net::ERR_BLOCKED_BY_CLIENT`) e exibindo status visual de aprovação.

---

## 6. Subsistema de Extensões Chromium

Localizado em `src/main/modules/extensions/`:

### 6.1. `ExtensionValidator`
* **Validação Estrutural Completa**:
  * Verifica a existência e sintaxe JSON de `manifest.json`.
  * Valida campos obrigatórios (`name`, `version`, `manifest_version`).
  * Suporta e detecta automaticamente **Manifest V3** e **Manifest V2**.
  * Extrai metadados completos: `permissions`, `host_permissions`, `action` / `browser_action`, `background` (service workers ou scripts legados), `content_scripts`, `icons`, `author`, `homepage_url`.
  * Valida a existência física no disco de todos os arquivos referenciados (scripts de conteúdo, ícones, páginas de popup e service workers) antes de qualquer operação de cópia ou carregamento.

### 6.2. `ExtensionStore`
* **Persistência Atômica e Isolada**:
  * Arquivo JSON versionado em `userData/extensions.json`.
  * Fila de gravação assíncrona serializada com controle de lock (`_saving`, `_saveQueued`), garantindo consistência contra chamadas concorrentes.
  * Escrita atômica em arquivo temporário com sufixo randômico (`.tmp.<timestamp>.<random>`) e renomeação segura para prevenir colisões do Windows.
  * Armazena registros normalizados com status de ativação (`enabled`), caminhos de isolamento (`path`), metadados de manifesto e eventuais mensagens de erro de carga.

### 6.3. `ExtensionLoader`
* **Integração Nativista com a Sessão Chromium/Electron**:
  * Utiliza as APIs oficiais modernas `session.extensions.loadExtension` / `session.loadExtension` e `session.extensions.removeExtension` / `session.removeExtension`.
  * **Zero Injeção Simulada**: Sem uso de `eval`, `webFrame.executeJavaScript` ou wrappers artificiais. As extensões executam nos mundos isolados nativos fornecidos pelo motor Blink/V8 do Chromium.
  * Suporte a descarregamento dinâmico sem necessidade de reiniciar o processo principal do navegador.

### 6.4. `ExtensionManager`
* **Isolamento de Arquivos em `userData/extensions/<id>/`**:
  * Ao instalar uma extensão descompactada a partir de qualquer pasta selecionada pelo usuário, o `ExtensionManager` realiza uma cópia recursiva e isolada dos arquivos para o diretório de dados do aplicativo.
  * A pasta de origem do usuário nunca é modificada, sobrescrita ou corrompida.
* **Ciclo de Vida Completo**:
  * `installFromDirectory`: Valida, copia recursivamente, carrega nativamente no Chromium, registra no store e notifica ouvintes IPC.
  * `toggle` / `enable` / `disable`: Liga e desliga a extensão dinamicamente na sessão ativa, persistindo o estado.
  * `uninstall`: Descarrega da sessão ativa, apaga com segurança a pasta isolada do disco e remove o registro do store.
  * `openPopup`: Cria uma janela `BrowserWindow` frameless posicionada como popover sob a barra de ferramentas, carregando a URL `chrome-extension://${id}/${popup}` com contexto seguro e fechamento automático ao perder o foco.
* **Coexistência com o Núcleo Shield**:
  * O esquema `chrome-extension:` foi explicitamente registrado na lista de protocolos internos autorizados nos filtros do Núcleo Shield, impedindo qualquer falso positivo ou bloqueio indevido de scripts/recursos de extensões instaladas.

---

## 7. Esquema Interno Próprio (`nucleo://`)

Para servir as páginas internas sem depender de arquivos soltos `file://` na sandbox, o Núcleo Browser registra o esquema `nucleo` como privilegiado e seguro:

* **Registro Privilegiado**: `protocol.registerSchemesAsPrivileged` com `standard: true, secure: true, supportFetchAPI: true`.
* **Manipulador Nativo**: `protocol.handle('nucleo', ...)` roteia com segurança:
  * `nucleo://newtab` -> `src/renderer/newtab.html`
  * `nucleo://bookmarks` -> `src/renderer/bookmarks.html`
  * `nucleo://history` -> `src/renderer/history.html`
  * `nucleo://shield` -> `src/renderer/shield.html`
  * `nucleo://shield-test` -> `src/renderer/shield-test.html`
  * `nucleo://extensions` -> `src/renderer/extensions.html`
  * `nucleo://extension-test` -> `src/renderer/extension-test.html`
  * `nucleo://settings` (e alias `nucleo://configuracoes`) -> `src/renderer/settings.html`
  * Folhas de estilo, scripts e ícones relativos do renderer.
* **Segurança do Preload Bridge**: O script `src/preload/index.js` valida estritamente a origem: apenas páginas com protocolo `nucleo:` ou `file:` recebem a API `window.nucleoAPI`. Sites externos (`https://`) não têm acesso ao bridge, mantendo a sandbox intransponível.

---

## 8. Layout Dinâmico e Componentes do Top Chrome

* **Altura Dinâmica da Barra de Ferramentas**:
  * Altura base (abas + omnibox + shield + extensões): **78px**
  * Altura com barra de favoritos visível: **110px** (78px + 32px)
* **Redimensionamento Reativo**: Ao alternar a barra de favoritos via `Ctrl + Shift + B` ou menu, o `BrowserWindowController` emite o evento `EVENT_BOOKMARKS_BAR_TOGGLED` para a interface e imediatamente invoca `tabManager.updateActiveTabBounds()`, ajustando as dimensões do `WebContentsView` ativo para não cobrir a barra.
* **Controles do Núcleo Shield no Top Chrome**:
  * Botão de escudo com badge numérico em tempo real (`#shieldBadgeCount`) indicando itens bloqueados na aba ativa.
  * Popover interativo (`#shieldPopover`) permitindo alternar a proteção para o domínio atual, visualizar a contagem discriminada (anúncios, rastreadores) e acessar as configurações completas.
* **Controles de Extensões no Top Chrome**:
  * Botão de extensões com ícone de quebra-cabeça (`#btnExtensions`) e atalho `Ctrl + Shift + E`.
  * Popover interativo (`#extensionsPopover`) exibindo extensões ativas, botão para abrir popup de ação da extensão, atalho para carregar via pasta e link direto para `nucleo://extensions`.

---

---

## 9. Subsistema de Configurações (`SettingsManager` e `SettingsStore`)

Localizado em `src/main/modules/settings/`:

### 9.1. Esquema e Definições (`settings-schema.js` e `settings-defaults.js`)
* **8 Seções Estruturadas**:
  * `search`: Provedor padrão (`search.engine`) e mecanismos customizados (`search.customEngines`).
  * `appearance`: Modo de tema (`appearance.theme`: `system`, `dark`, `light`) e cor de acento (`appearance.accentColor`: `cyan`, `indigo`, `purple`, `green`, `amber`).
  * `startup`: Modo de inicialização (`startup.mode`: `newtab`, `restore`, `specific`) e lista de URLs (`startup.urls`).
  * `newTab`: Modo de exibição da nova aba (`newTab.mode`: `nucleo`, `custom`) e URL customizada (`newTab.customUrl`).
  * `downloads`: Diretório padrão (`downloads.defaultPath`) e confirmação de local (`downloads.askLocation`).
  * `privacy`: Do Not Track (`privacy.doNotTrack`), limpeza ao sair (`privacy.clearOnExit`) e itens de limpeza (`privacy.clearOnExitItems`).
  * `browser`: Indicador de navegador padrão em cache (`browser.default`).
  * `tabs`: Comportamento de abertura em background (`tabs.openNewTabsInBackground`) e confirmação de fechamento (`tabs.confirmCloseMultipleTabs`).

### 9.2. Validador Estrito (`settings-validator.js`)
* Validação rigorosa por tipo e restrições `enum`.
* Sanitização completa de URLs (`sanitizeUrl`): bloqueio preventivo de protocolos maliciosos como `javascript:`, `data:`, `file:` e `vbscript:`.
* Validação de buscadores customizados exigindo o marcador `%s` e protocolo HTTP/HTTPS.

### 9.3. Persistência Atômica Serializada (`settings-store.js`)
* Localizado em `app.getPath('userData')/settings.json`.
* Fila de escrita assíncrona (`_saving`, `_saveQueued`) com arquivo temporário (`.tmp.<timestamp>.<rand>`) e renomeação atômica (`fs.promises.rename`), prevenindo colisões no Windows e eliminando risco de corrupção.

### 9.4. Orquestrador (`settings-manager.js`)
* Suporte nativo à notação de pontos (`get('appearance.theme')`, `set('appearance.accentColor', 'purple')`).
* Emissão de eventos reativos granulares (`theme-changed`, `search-engine-changed`, `download-settings-changed`, `privacy-settings-changed`).
* Suporte a reset completo (`reset()`) ou restauração seletiva por seção (`resetSection(section)`).

---

## 10. Subsistema de Mecanismos de Busca (`SearchProvider`)

Localizado em `src/main/modules/search/`:

* **6 Provedores Nativos**: DuckDuckGo (foco em privacidade), Google, Bing, Brave Search, Ecosia e Startpage.
* **Interpolação Segura de Consultas**: Template `%s` substituído por `encodeURIComponent(query.trim())`.
* **Buscadores Personalizados**: Criação, persistência e remoção de buscadores do usuário com palavras-chave dedicadas (ex: `gh` para GitHub).
* **Integração com a Omnibox**: O `NavigationController` consulta o `SearchProvider` em tempo de execução para gerar URLs de busca com base no motor padrão ativo selecionado pelo usuário.

---

## 11. Subsistema de Navegador Padrão (`DefaultBrowserManager`)

Localizado em `src/main/modules/default-browser/`:

* **Detecção Confiável no Windows (`windows-default-browser.js`)**:
  * Consulta primária via `app.isDefaultProtocolClient('http')` e `app.isDefaultProtocolClient('https')`.
  * Consulta secundária ao Registro do Windows via `reg query "HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice" /v ProgId`.
* **Fluxo de Definição Conforme Boas Práticas do Windows**:
  * No Windows 10 e 11, o hash UserChoice impede alterações silenciosas do Registro por aplicativos de terceiros.
  * O Núcleo Browser registra o protocolo via `app.setAsDefaultProtocolClient` e direciona o usuário diretamente à página oficial de configurações de aplicativos padrão via `shell.openExternal('ms-settings:defaultapps')`.

---

## 12. Políticas de Sessão, Downloads e Privacidade

Configuradas centralizadamente no ciclo de vida em `src/main/app.js`:

* **Controle de Downloads (`will-download`)**:
  * Respeita o diretório definido em `downloads.defaultPath`.
  * Quando `downloads.askLocation` estiver ativado, invoca a caixa de diálogo nativa de salvamento do Windows.
* **Cabeçalho Do Not Track (`onBeforeSendHeaders`)**:
  * Injeta `DNT: 1` em todas as requisições web se `privacy.doNotTrack` estiver ativado.
* **Limpeza de Dados de Sessão (`clearData`)**:
  * Limpeza atômica de cache HTTP em disco via `session.clearCache()`.
  * Remoção seletiva de cookies e dados de armazenamento via `session.clearStorageData()`.
  * Limpeza seletiva do histórico de navegação via `historyManager.clearByPeriod()`.

---

## 13. Subsistema de Workspaces & Gestão de Contextos de Abas (`WorkspaceManager`, `WorkspaceStore` e `WorkspaceModel`)

Localizado em `src/main/modules/workspaces/`:

### 13.1. Arquitetura de Janela Única e Ciclo de Vida de `WebContentsView`
* **Sem Proliferação de Janelas**: Os Workspaces operam estritamente dentro da mesma janela principal (`BrowserWindow`). O conceito de Workspace é um particionamento lógico e independente de abas.
* **Preservação de Estado via Visibilidade (`tab.setVisible`)**:
  * Ao alternar entre workspaces, as instâncias de `WebContentsView` do workspace inativo **NÃO são destruídas e NÃO sofrem recarregamento**.
  * O `TabManager` executa `tab.setVisible(false)` para as abas do workspace anterior e `tab.setVisible(true)` para a aba ativa do novo workspace.
  * Conexões WebSockets, formulários em digitação, árvores DOM, memória JavaScript e histórico de navegação (Back/Forward) permanecem 100% íntegros em segundo plano.
* **Aba Ativa por Workspace**:
  * Cada workspace mantém a propriedade `activeTabId`.
  * Ao retornar para um workspace, o foco e a visibilidade são restaurados instantaneamente para a aba ativa daquele contexto sem interferir nos demais.

### 13.2. Modelo de Dados (`WorkspaceModel`)
* **Propriedades Estruturais**:
  ```json
  {
    "id": "ws-1727700000000-a1b2",
    "name": "Trabalho",
    "color": "indigo",
    "icon": "briefcase",
    "createdAt": 1727700000000,
    "updatedAt": 1727700000000,
    "activeTabId": "tab-123",
    "tabIds": ["tab-123", "tab-456"]
  }
  ```
* **Validação e Sanitização Defensiva**:
  * Nome limitado entre 1 e 40 caracteres, com remoção de espaços em excesso e quebras de linha (`\r\n\t`). Fallback seguro para `"Workspace"`.
  * IDs únicos e imutáveis gerados com timestamp e entropia aleatória; IDs nunca são reciclados.
  * 7 cores de acento suportadas: `cyan`, `indigo`, `purple`, `green`, `amber`, `red`, `pink`.
  * 8 ícones temáticos suportados: `home`, `briefcase`, `book`, `code`, `gamepad`, `school`, `folder`, `star`.

### 13.3. Persistência Atômica Serializada (`WorkspaceStore`)
* Localizado em `app.getPath('userData')/workspaces.json`.
* **Escrita Atômica via NTFS**: Grava em arquivo temporário `.tmp.<timestamp>.<rand>` e renomeia via `fs.promises.rename`.
* **Fila Serializada com Promise**: Chamadas concorrentes de salvamento aguardam o término da escrita em andamento e processam imediatamente qualquer modificação subsequente sem criar conflitos `EBUSY` no Windows.
* **Recuperação Automática contra Corrupção**: Se o arquivo `workspaces.json` for corrompido, o store renomeia o arquivo corrompido para `.corrupted.<timestamp>`, gera um novo arquivo com o workspace padrão `"Pessoal"` e restabelece a integridade sem travar a inicialização do navegador.

### 13.4. Regras de Negócio e Segurança
* **Proteção contra Exclusão do Último Workspace**: O navegador nunca fica sem workspace ativo. Se houver apenas 1 workspace, a exclusão é estritamente bloqueada no Manager e na interface.
* **Confirmação e Migração de Abas**: A exclusão de um workspace com abas exige confirmação explícita, oferecendo a opção de migrar as abas para outro workspace (`targetWorkspaceId`) antes da exclusão.
* **Duplicação Segura**: Clona a estrutura e URLs das abas sem copiar cookies privados, senhas ou tokens de sessão.
* **Segurança de IPC**: Canais `WORKSPACES_*` são protegidos por `isInternalPage` no Preload e `_validateInternalSender` no processo principal, impedindo qualquer acesso por scripts de terceiros da web.

---

## 14. Subsistema de Download Manager Nativo (`DownloadsManager`, `DownloadsStore`, `DownloadModel` e `DownloadsUtils`)

Localizado em `src/main/modules/downloads/`:

### 14.1. Intercepção Nativa Chromium & Ciclo de Vida (`DownloadsManager`)
* **Intercepção de Sessão (`session.on('will-download')`)**:
  * O `DownloadsManager` anexa-se à `session.defaultSession` e intercepta cada evento `will-download` emitido por qualquer `WebContentsView` ou janela.
  * Resolução de contexto de abas e Workspaces: associa o download ao `tabId` e `workspaceId` da aba originária inspecionando o WebContents emissor.
* **Resolução Segura de Destino e Diálogo de Salvamento**:
  * Consulta as configurações persistentes `downloads.defaultPath` e `downloads.askLocation` via `SettingsManager`.
  * Sanitização de nome de arquivo contra Directory Traversal (`..`, `/`, `\`) e caracteres inválidos do Windows (`<>:"/\|?*`).
  * Desduplicação inteligente com sufixos numéricos sequenciais (`arquivo (1).ext`) para evitar sobrescritas involuntárias.
  * Invocação assíncrona do diálogo nativo de salvamento do Windows (`dialog.showSaveDialog`) quando `askLocation: true`.
* **Métricas em Tempo Real & Controle de Ciclo de Vida**:
  * Cálculo de velocidade por Média Móvel Exponencial (EMA com $\alpha = 0.25$) para suavizar oscilações de rede.
  * Cálculo de tempo estimado restante (ETA) e progresso percentual (0-100%).
  * Throttle de 150ms no envio de eventos IPC para evitar sobrecarga no canal de mensagens durante transferências de alta taxa de dados.
  * Ações de ciclo de vida completas: pausar (`item.pause()`), retomar (`item.resume()`), cancelar (`item.cancel()`), abrir arquivo (`shell.openPath`) e revelar na pasta (`shell.showItemInFolder`).

### 14.2. Persistência Atômica Serializada (`DownloadsStore`)
* Localizado em `app.getPath('userData')/downloads.json`.
* **Gravação Atômica via NTFS**: Grava em arquivo temporário `.tmp.<timestamp>.<rand>` e renomeia via `fs.promises.rename` para impedir corrupção de dados em desligamentos repentinos.
* **Auto-Recuperação de Corrupção**: Em caso de JSON inválido ou corrupção no disco, o arquivo corrompido é preservado como `.corrupted.<timestamp>` e uma nova base vazia é inicializada sem falhar o boot do navegador.
* **Retenção Máxima Automática**: Limite de 500 registros no histórico, expurgando automaticamente itens antigos concluídos/cancelados mantendo sempre os downloads ativos.

### 14.3. Interface Interna `nucleo://downloads`
* Página web dedicada com design Obsidian Dark (`src/renderer/downloads.html`), compatível com o tema visual do navegador.
* Barra de busca rápida por nome e URL com destaque em tempo real.
* Filtros rápidos por estado: **Todos**, **Baixando**, **Concluídos** e **Cancelados / Falhos**.
* Botões contextuais de ação por item (Pausar, Retomar, Cancelar, Abrir Arquivo, Mostrar na Pasta, Excluir do Histórico).
* Botão global "Limpar Histórico Concluído".
* Atualizações de progresso reativas via IPC com badge numérico em tempo real no Top Chrome (`#downloadsBadgeCount` e `#btnDownloads`) e atalho global `Ctrl+J`.

---

## 15. Estrutura Modular de Diretórios

```text
src/
├── main/
│   ├── config/
│   │   └── app-config.js                # Configurações globais, versão (0.8.0) e caminhos
│   ├── core/
│   │   ├── browser-engine.js            # Inicialização do Chromium, sessões e protocolo nucleo://
│   │   └── browser-window.js            # Janela frameless e cálculo de bounds dinâmicos
│   ├── ipc/
│   │   ├── ipc-channels.js              # Canais e eventos IPC (Settings, Search, Workspaces, Downloads, Shield, Extensões)
│   │   └── ipc-handlers.js              # Registro e delegação de comandos IPC seguros
│   ├── modules/
│   │   ├── downloads/                   # Subsistema Nativo de Gerenciamento de Downloads
│   │   │   ├── downloads-utils.js       # Sanitização de caminhos, cálculo de EMA, ETA e formatos
│   │   │   ├── downloads-model.js       # Modelo formal de ciclo de vida e estados de download
│   │   │   ├── downloads-store.js       # Persistência atômica serializada (downloads.json)
│   │   │   ├── downloads-manager.js     # Interceptador Chromium, orquestrador e controle de DownloadItem
│   │   │   └── index.js                 # Fachada do módulo Downloads
│   │   ├── workspaces/                  # Subsistema de Workspaces & Contextos de Abas
│   │   │   ├── workspace-model.js       # Modelo, validação de nomes, cores e ícones
│   │   │   ├── workspace-store.js       # Persistência atômica serializada (workspaces.json)
│   │   │   ├── workspace-manager.js     # Gestor de ciclo de vida, switches e regras
│   │   │   └── index.js                 # Exportações do módulo Workspaces
│   │   ├── settings/                    # Subsistema Central de Configurações
│   │   │   ├── settings-schema.js       # Definição formal do schema e restrições
│   │   │   ├── settings-defaults.js     # Valores padrão das seções
│   │   │   ├── settings-validator.js    # Validador de tipos, enums e sanitização de URLs
│   │   │   ├── settings-store.js        # Persistência atômica serializada (settings.json)
│   │   │   ├── settings-manager.js      # API com notação de ponto, eventos e resets
│   │   │   └── index.js                 # Fachada do módulo Settings
│   │   ├── search/                      # Subsistema de Mecanismos de Busca
│   │   │   ├── search-engines.js        # 6 provedores pré-configurados com %s
│   │   │   ├── search-provider.js       # Gerenciador de buscadores e montagem de URLs
│   │   │   └── index.js                 # Fachada do módulo Search
│   │   ├── default-browser/             # Detecção e solicitação de Navegador Padrão
│   │   │   ├── windows-default-browser.js# Detecção por Registro e ms-settings:defaultapps
│   │   │   ├── default-browser-manager.js# Abstração de plataforma e cache de status
│   │   │   └── index.js                 # Fachada do módulo Default Browser
│   │   ├── bookmarks/                   # Gerenciador e store de favoritos
│   │   │   ├── bookmark-manager.js
│   │   │   ├── bookmark-store.js
│   │   │   └── index.js
│   │   ├── history/                     # Gerenciador e store de histórico
│   │   │   ├── history-manager.js
│   │   │   ├── history-store.js
│   │   │   └── index.js
│   │   ├── shield/                      # Subsistema Núcleo Shield (Ad & Tracker Blocker)
│   │   │   ├── filter-parser.js         # Parser sintático de regras e categorias
│   │   │   ├── filter-store.js          # Persistência atômica serializada (shield.json)
│   │   │   ├── shield-engine.js         # Motor de decisão O(1) + regex + LRU Cache
│   │   │   ├── shield-stats.js          # Rastreamento per-tab e contadores globais
│   │   │   ├── shield-manager.js        # Intercepção de requisições e integração
│   │   │   └── index.js                 # Exportações do módulo Shield
│   │   ├── extensions/                  # Subsistema de Extensões Chromium
│   │   │   ├── extension-validator.js   # Validador estrutural de Manifest V2 e V3
│   │   │   ├── extension-store.js       # Persistência atômica versionada (extensions.json)
│   │   │   ├── extension-loader.js      # Integração nativa com Electron Session Extensions
│   │   │   ├── extension-events.js      # Constantes de eventos do ciclo de vida
│   │   │   ├── extension-manager.js     # Orquestrador, isolamento de pastas e popups
│   │   │   └── index.js                 # Exportações do módulo Extensions
│   │   ├── navigation/                  # Resolução de URLs e navegação
│   │   ├── security/                    # Bloqueio de permissões e segurança
│   │   ├── devtools/                    # Inspeção DevTools
│   │   └── tabs/                        # Abstração Tab e TabManager
│   │       ├── tab.js
│   │       └── tab-manager.js
│   └── app.js                           # Orquestração do ciclo de vida e instanciação
├── preload/
│   └── index.js                         # ContextBridge seguro (nucleoAPI.downloads, settings, search, etc.)
└── renderer/
    ├── bookmarks.html                   # Interface do Gerenciador de Favoritos
    ├── history.html                     # Interface do Histórico de Navegação
    ├── downloads.html                   # Interface Nativa do Gerenciador de Downloads
    ├── index.html                       # Top chrome do navegador (abas, omnibox, downloads, shield, extensões)
    ├── newtab.html                      # Página de Nova Aba com Acesso Rápido
    ├── shield.html                      # Dashboard de controle e estatísticas do Núcleo Shield
    ├── shield-test.html                 # Fixture de validação e testes determinísticos offline do Shield
    ├── extensions.html                  # Dashboard Obsidian do Gerenciador de Extensões
    ├── extension-test.html              # Fixture de validação determinística de extensões e isolamento
    ├── settings.html                    # Central de Configurações Obsidian do Núcleo Browser
    ├── scripts/
    │   ├── address-bar.js               # Lógica de digitação e formatação de URLs
    │   └── ui-controller.js             # Controle da UI, popovers, downloads badge, temas e abas
    └── styles/
        ├── main.css                     # Estilos principais, badges e popovers
        └── theme.css                    # Variáveis e design tokens (Dark/Light + 5 cores de acento)
```
