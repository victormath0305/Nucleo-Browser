# Núcleo Browser (v0.7.0)

> Navegador desktop moderno, rápido e seguro baseado em **Chromium** e **Electron** para Windows, desenvolvido com arquitetura modular desacoplada, Workspaces e contextos de abas sem recarregamento, bloqueador nativo de anúncios, suporte a extensões Chromium (MV2/MV3) e central de configurações avançada.

---

## 1. Visão Geral do Projeto

O **Núcleo Browser** é um navegador desktop real desenvolvido para o sistema operacional Windows. Seu objetivo principal é fornecer uma experiência de navegação veloz, privada e altamente customizável, combinando o poder do motor **Chromium** com subsistemas nativos desenvolvidos do zero de forma modular.

### Destaques Técnicos da Versão Atual (v0.7.0)
* **Workspaces & Gestão de Contextos de Abas**: Contextos independentes de abas (ex: Pessoal, Trabalho, Estudos) dentro de uma única janela principal com alternância instantânea sem recarregamento de páginas (`WebContentsView.setVisible`).
* **Motor Chromium 152 & Electron 44**: Compatibilidade total com as mais modernas APIs web (HTML5, CSS3, WebAssembly, WebGL, WebRTC e ES2024).
* **Central de Configurações (`nucleo://settings`)**: Painel de controle completo com suporte a temas dinâmicos (Sistema, Escuro e Claro), 5 cores de acento, gerenciamento de Workspaces, seleção de buscador padrão, preferências de inicialização, downloads e privacidade.
* **Mecanismos de Busca Dinâmicos**: 6 provedores verificados pré-configurados (DuckDuckGo, Google, Bing, Brave, Ecosia, Startpage) e suporte completo a buscadores personalizados com `%s`.
* **Detecção Confiável de Navegador Padrão Windows**: Verificação real no Registro do Windows (`UserChoice`) e fluxo oficial via `ms-settings:defaultapps`.
* **Suporte Real a Extensões Chromium**: Carregamento nativo via API de Sessão do Chromium/Electron com suporte a Manifest V3 (Service Workers) e Manifest V2, isolamento local de pastas e popups nativos.
* **Núcleo Shield (Ad & Tracker Blocker)**: Bloqueio nativo antes do envio à rede via `session.webRequest.onBeforeRequest`, com regras estilo Adblock Plus, decisão $O(1)$ com LRU Cache e whitelist de exceções.
* **Sistema Multi-Abas com `WebContentsView`**: Cada aba é um processo renderizador independente e isolado, garantindo alta performance, estabilidade e ausência de vazamento de memória.
* **Favoritos, Histórico & Workspaces Persistentes**: Estruturas hierárquicas e relacionais, gravação atômica serializada em disco com recuperação automática contra corrupção.
* **Segurança de Nível Bancário**: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, isolamento de esquemas privilegiados e sanitização defensiva contra injeções.

---

## 2. Como Foi Construído (Arquitetura e Engenharia)

O Núcleo Browser adota rigorosamente a arquitetura multi-processos do Chromium, garantindo que o código de terceiros (páginas da web) nunca tenha acesso direto aos recursos do sistema operacional ou às APIs do Node.js.

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                MAIN PROCESS (Node.js)                                  │
│                                                                                        │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌─────────────────────────────┐  │
│  │    BrowserEngine     │  │ BrowserWindowController│  │         TabManager          │  │
│  │ (Session/Protocols)  │  │   (Window/Layout)     │  │    (Tabs Lifecycle & Views) │  │
│  └──────────┬───────────┘  └───────────┬───────────┘  └──────────────┬──────────────┘  │
│             │                          │                             │                 │
│  ┌──────────┴───────────┐  ┌───────────┴───────────┐  ┌──────────────┴──────────────┐  │
│  │    ShieldManager     │  │    ExtensionManager   │  │       SettingsManager       │  │
│  │ (Network Interceptor)│  │ (Session Loader / Pop)│  │  (Schema / Validator / Store│  │
│  └──────────┬───────────┘  └───────────┬───────────┘  └──────────────┬──────────────┘  │
│             │                          │                             │                 │
│  ┌──────────┴───────────┐  ┌───────────┴───────────┐  ┌──────────────┴──────────────┐  │
│  │    SearchProvider    │  │  DefaultBrowserManager│  │   Bookmark & History Store  │  │
│  │(Engines & Resolution)│  │ (Windows Registry Check│  │ (Atomic JSON Persistence)   │  │
│  └──────────────────────┘  └───────────────────────┘  └─────────────────────────────┘  │
│                                        │                                               │
│                            IPC Handler Registry (Safe)                                 │
└───────────────────┬────────────────────────────────────────────┬───────────────────────┘
                    │ (ContextBridge Preload Seguro)             │ (Nativo WebContentsView)
                    ▼                                            ▼
┌────────────────────────────────────────┐  ┌────────────────────────────────────────────┐
│      CHROME UI RENDERER (App UI)       │  │        WEB CONTENTS VIEW (Abas Web)        │
│                                        │  │                                            │
│  • Top Bar (Abas, Omnibox, Shield, Ext)│  │  • Renderizador 100% Sandboxed             │
│  • Barra de Favoritos (Ctrl+Shift+B)   │  │  • Zero acesso a Node.js ou Electron       │
│  • Páginas Internas nucleo://          │  │  • Bloqueio na camada de rede (Shield)     │
│  • contextIsolation: TRUE              │  │  • contextIsolation: TRUE                  │
│  • nodeIntegration: FALSE              │  │  • nodeIntegration: FALSE                  │
│  • sandbox: TRUE                       │  │  • sandbox: TRUE                           │
└────────────────────────────────────────┘  └────────────────────────────────────────────┘
```

### 1. Por Que `WebContentsView` e Não `<webview>` ou Iframes?
Navegadores legados ou baseados em Electron antigo costumavam utilizar a tag `<webview>`, que traz sobrecarga excessiva de renderização e graves problemas de segurança. No Núcleo Browser, cada aba é criada como uma instância de `WebContentsView` gerenciada pelo processo principal. Isso garante:
* **Renderização Direta pela GPU**: Sem intermediários ou camadas de DOM adicionais.
* **Isolamento de Quebras**: Se uma página web travar ou falhar, a interface do navegador e as outras abas continuam operando normalmente.
* **Dimensionamento Reativo Perfeito**: O controlador de janela calcula as coordenadas exatas da área visível (`updateActiveTabBounds`), permitindo que a barra de favoritos se abra ou feche suavemente sem sobrepor o conteúdo da página.

### 2. Persistência Local Atômica Serializada
Para garantir que nenhum dado seja corrompido em caso de desligamento abrupto do sistema ou falta de energia, os módulos de dados (`bookmarks.json`, `history.json`, `shield.json`, `extensions.json` e `settings.json`) empregam uma estratégia robusta:
1. **Fila Assíncrona de Escrita**: Gravações simultâneas são enfileiradas sequencialmente, evitando o erro clássico de concorrência e colisão de arquivos do Windows (`EBUSY` / `EPERM`).
2. **Escrita em Arquivo Temporário**: Os dados são serializados em um arquivo `.tmp.<timestamp>.<rand>`.
3. **Renomeação Atômica**: O arquivo temporário substitui o arquivo de destino usando `fs.promises.rename`, operação garantida como atômica pelo sistema de arquivos NTFS.

### 3. Protocolo Privilegiado `nucleo://`
Para oferecer uma experiência de navegador de primeira classe, registramos o protocolo `nucleo://` como esquema seguro e com suporte a Fetch API. O processo principal intercepta as rotas e carrega os dashboards internos:
* `nucleo://settings` (e alias `nucleo://configuracoes`): Central de Configurações.
* `nucleo://newtab`: Painel de Nova Aba com atalhos de Acesso Rápido.
* `nucleo://bookmarks` (e alias `nucleo://favoritos`): Gerenciador de Favoritos.
* `nucleo://history` (e alias `nucleo://historico`): Histórico de Navegação.
* `nucleo://shield`: Painel de Controle e Estatísticas do Núcleo Shield.
* `nucleo://shield-test`: Ambiente de testes offline de bloqueio de requisições.
* `nucleo://extensions`: Gerenciador de Extensões Chromium.
* `nucleo://extension-test`: Fixture de validação determinística de content scripts e isolamento.

---

## 3. Funcionalidades Detalhadas

### 1. Central de Configurações (`nucleo://settings`)
* **Identidade Visual Própria**: Desenvolvida com a estética Obsidian Dark (`#0a0d14`, `#101522`) e detalhes em cores de destaque, oferecendo um layout limpo, moderno e responsivo com navegação lateral por categorias.
* **Controle de Temas**:
  * Modo **Sistema**: Acompanha automaticamente a preferência de tema Claro/Escuro do Windows.
  * Modo **Escuro**: Tema Obsidian com alto contraste e redução de cansaço visual.
  * Modo **Claro**: Tema limpo e elegante com tipografia nítida.
* **Paleta de Destaques (5 Cores)**: Ciano (`#00e5ff`), Índigo (`#6366f1`), Roxo (`#a855f7`), Verde Esmeralda (`#10b981`) e Âmbar (`#f59e0b`).
* **Sincronização em Tempo Real**: Alterações de tema ou cor de acento são propagadas instantaneamente para todas as partes da interface via eventos IPC sem necessidade de recarregar a janela.
* **Restauração de Fábrica**: Permite reiniciar todas as preferências aos padrões originais ou restaurar seletivamente apenas uma seção.

### 2. Gestão de Mecanismos de Busca & Omnibox
* **6 Provedores Pré-configurados**: Suporte nativo para **DuckDuckGo** (padrão de privacidade), **Google**, **Bing**, **Brave Search**, **Ecosia** e **Startpage**.
* **Buscadores Personalizados**: Modal intuitivo para cadastrar qualquer motor de busca web. A URL deve conter `%s`, que é substituído automaticamente pela consulta do usuário devidamente sanitizada.
* **Resolução Inteligente na Omnibox**: A barra de endereços detecta inteligentemente quando uma entrada é uma URL válida, domínio com TLD, endereço local (`localhost`, IP) ou uma pesquisa em linguagem natural, acionando o provedor padrão configurado.

### 3. Integração com Navegador Padrão do Windows
* **Detecção Fidedigna**: Consulta as APIs do Electron (`app.isDefaultProtocolClient`) combinadas com a leitura em tempo real da chave de registro do Windows `HKCU\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice\ProgId`.
* **Fluxo Recomendado pela Microsoft**: Respeita o protocolo de segurança do Windows 10 e Windows 11, registrando o protocolo no sistema e abrindo diretamente as configurações oficiais via `ms-settings:defaultapps` para confirmação segura do usuário.

### 4. Sistema de Extensões Chromium (MV3 & MV2)
* **Carregamento Nativo via Sessão**: Utiliza `session.loadExtension` da engine Chromium. Não utiliza injeção de scripts arbitrários via `eval` ou emuladores fictícios.
* **Compatibilidade Dupla**:
  * **Manifest V3**: Service workers em background, `action`, `declarativeNetRequest`, `permissions`, `content_scripts`.
  * **Manifest V2**: Background scripts, `browser_action`, permissões declarativas.
* **Isolamento de Segurança**: Ao instalar uma extensão por pasta local, o Núcleo Browser copia os arquivos recursivamente para `userData/extensions/<id>/`, garantindo que os arquivos originais do usuário nunca sejam modificados.
* **Gestão Dinâmica**: Ativação, desativação, inspeção técnica de permissões e desinstalação sem precisar fechar o navegador.
* **Popups de Extensão**: Renderização em janela popup flutuante frameless nativa, posicionada exatamente abaixo do ícone da barra de ferramentas.

### 5. Núcleo Shield (Proteção de Privacidade e Rede)
* **Intercepção Antecipada**: Atua em `session.webRequest.onBeforeRequest`, bloqueando requisições antes que qualquer byte saia do computador do usuário.
* **Motor O(1) + Cache LRU**: Verificação em tempo constante por conjuntos de hash e cache LRU com capacidade de 5.000 entradas para decisões ultrarrápidas.
* **34 Regras Nativas Offline**: Proteção imediata contra as maiores redes de rastreamento, anúncios invasivos e coletores de telemetria sem depender de conexão com servidores remotos.
* **Estatísticas por Aba e Whitelist**: Exibição em tempo real de itens bloqueados por categoria e permissão de listas de exceção por domínio com um único clique.

### 6. Sistema Completo de Abas
* **Navegação Independente**: Múltiplas abas ativas simultaneamente, cada uma mantendo seu próprio histórico de navegação, estado de carregamento e contexto isolado.
* **Atalhos e Gestão**: Criar nova aba (`Ctrl + T`), fechar aba ativa (`Ctrl + W`), navegar ciclicamente (`Ctrl + Tab` / `Ctrl + Shift + Tab`), pular diretamente para abas (`Ctrl + 1` a `Ctrl + 9`).
* **Menu de Contexto de Abas**: Recarregar, Duplicar aba, Fechar abas à direita e Fechar outras abas.

### 7. Favoritos e Histórico
* **Barra de Favoritos Expansível (`Ctrl + Shift + B`)**: Barra limpa e elegante que ajusta dinamicamente a área útil de visualização.
* **Botão Estrela Inteligente**: Sincroniza em tempo real com a URL da aba ativa para adicionar ou remover com um clique ou `Ctrl + D`.
* **Histórico com Retenção Inteligente**: Registra visitas reais (com título, data, favicon e contador de acessos), expurga automaticamente registros antigos acima de 10.000 itens e exclui rigorosamente páginas internas (`nucleo://`) e sessões privadas.
* **Limpeza Granular de Dados**: Modal para expurgar histórico, cache e cookies por períodos (Última hora, 24 horas, 7 dias ou todo o período).

### 8. Workspaces & Gestão de Contextos de Abas (Novo na v0.7.0)
* **Contextos Independentes sem Janelas Múltiplas**: Agrupamento lógico de abas em fluxos de trabalho (ex: Pessoal, Trabalho, Estudos) dentro da janela principal única do navegador.
* **Preservação de Estado com `WebContentsView`**: Ao trocar de workspace, as abas anteriores NÃO são destruídas e NÃO recarregam. As views inativas apenas têm sua visibilidade desativada (`view.setVisible(false)`), preservando formulários, scroll, histórico e memória intactos.
* **Aba Ativa Memorizada**: Cada workspace lembra individualmente qual era sua aba em foco (`activeTabId`), restaurando-a instantaneamente ao retornar.
* **Identidade Visual Customizável**: 7 cores de acento (`cyan`, `indigo`, `purple`, `green`, `amber`, `red`, `pink`) e 8 ícones (`home`, `briefcase`, `book`, `code`, `gamepad`, `school`, `folder`, `star`).
* **Menu de Contexto de Aba**: Opção "Mover para Workspace" permite transferir abas existentes ou criar um novo workspace diretamente a partir da aba ativa.
* **Duplicação Segura**: Clona a lista de abas e URLs sem duplicar cookies, credenciais ou tokens privados de autenticação.
* **Exclusão Segura com Confirmação**: Permite escolher entre migrar as abas para outro workspace ou encerrá-las, impedindo a exclusão do último workspace restante.

---

## 4. Atalhos de Teclado

| Atalho | Ação |
| :--- | :--- |
| `Ctrl + Alt + ArrowRight` | Próximo Workspace |
| `Ctrl + Alt + ArrowLeft` | Workspace Anterior |
| `Ctrl + Alt + 1` .. `9` | Ir diretamente para o Workspace N |
| `Ctrl + Alt + N` | Criar Novo Workspace |
| `Ctrl + T` | Abrir nova aba no workspace ativo |
| `Ctrl + W` | Fechar aba ativa do workspace |
| `Ctrl + Tab` | Alternar para a próxima aba (cíclica) |
| `Ctrl + Shift + Tab` | Alternar para a aba anterior (cíclica) |
| `Ctrl + 1` .. `Ctrl + 8` | Ir diretamente para a aba 1 .. 8 do workspace |
| `Ctrl + 9` | Ir para a última aba aberta do workspace |
| `Ctrl + L` / `Alt + D` | Focar na barra de endereços (Omnibox) |
| `Ctrl + R` / `F5` | Recarregar aba atual |
| `Alt + Seta Esquerda` | Voltar página no histórico da aba |
| `Alt + Seta Direita` | Avançar página no histórico da aba |
| `Ctrl + D` | Adicionar ou remover página dos favoritos |
| `Ctrl + Shift + B` | Exibir / Ocultar barra de favoritos |
| `Ctrl + Shift + E` | Abrir popover rápido de Extensões |
| `Ctrl + Shift + O` | Abrir Gerenciador de Favoritos (`nucleo://bookmarks`) |
| `Ctrl + H` | Abrir Histórico de Navegação (`nucleo://history`) |
| `F12` | Abrir DevTools da página web ativa |
| `Ctrl + Shift + I` | Abrir DevTools da interface do navegador |
| `Escape` | Fechar menus, popovers e caixas de diálogo |

---

## 5. Estrutura do Código-Fonte

```text
src/
├── main/
│   ├── config/
│   │   └── app-config.js                # Versão (0.6.0), dimensões, layouts e URLs padrão
│   ├── core/
│   │   ├── browser-engine.js            # Inicialização do Chromium, sessões e protocolo nucleo://
│   │   └── browser-window.js            # Janela principal frameless e cálculo de bounds das abas
│   ├── ipc/
│   │   ├── ipc-channels.js              # Definições centralizadas de todos os canais e eventos IPC
│   │   └── ipc-handlers.js              # Registro dos manipuladores IPC seguros do Main Process
│   ├── modules/
│   │   ├── settings/                    # Subsistema Central de Configurações
│   │   │   ├── settings-schema.js       # Definição canônica do schema, tipos e enums
│   │   │   ├── settings-defaults.js     # Valores padrão das 8 seções
│   │   │   ├── settings-validator.js    # Validação estrita e sanitização de URLs
│   │   │   ├── settings-store.js        # Persistência atômica serializada (settings.json)
│   │   │   ├── settings-manager.js      # API com notação de ponto, eventos e resets
│   │   ├── workspaces/                  # Subsistema de Workspaces & Contextos de Abas
│   │   │   ├── workspace-model.js       # Modelo validado, sanitização, cores e ícones
│   │   │   ├── workspace-store.js       # Persistência atômica serializada (workspaces.json)
│   │   │   ├── workspace-manager.js     # Gestão de ciclo de vida, transições e regras
│   │   │   └── index.js                 # Fachada pública do módulo
│   │   ├── search/                      # Subsistema de Mecanismos de Busca
│   │   │   ├── search-engines.js        # 6 buscadores pré-configurados com %s
│   │   │   ├── search-provider.js       # Resolução de queries e buscadores personalizados
│   │   │   └── index.js                 # Fachada pública do módulo
│   │   ├── default-browser/             # Subsistema de Navegador Padrão Windows
│   │   │   ├── windows-default-browser.js# Detecção por Registro e ms-settings:defaultapps
│   │   │   ├── default-browser-manager.js# Abstração de plataforma e cache
│   │   │   └── index.js                 # Fachada pública do módulo
│   │   ├── bookmarks/                   # Gerenciador e store hierárquico de favoritos
│   │   │   ├── bookmark-manager.js
│   │   │   ├── bookmark-store.js
│   │   │   └── index.js
│   │   ├── history/                     # Gerenciador e store com retenção de histórico
│   │   │   ├── history-manager.js
│   │   │   ├── history-store.js
│   │   │   └── index.js
│   │   ├── shield/                      # Subsistema Núcleo Shield (Ad & Tracker Blocker)
│   │   │   ├── filter-parser.js         # Parser sintático de regras Adblock Plus
│   │   │   ├── filter-store.js          # Persistência de regras e whitelist (shield.json)
│   │   │   ├── shield-engine.js         # Motor de decisão O(1) + regex + LRU Cache
│   │   │   ├── shield-stats.js          # Rastreamento per-tab e contadores globais
│   │   │   ├── shield-manager.js        # Intercepção de requisições de rede
│   │   │   └── index.js                 # Fachada pública do módulo
│   │   ├── extensions/                  # Subsistema de Extensões Chromium
│   │   │   ├── extension-validator.js   # Validador de Manifest V2 e V3
│   │   │   ├── extension-store.js       # Persistência atômica de extensões instaladas
│   │   │   ├── extension-loader.js      # Integração com session.loadExtension
│   │   │   ├── extension-events.js      # Constantes de ciclo de vida de extensões
│   │   │   ├── extension-manager.js     # Isolamento de diretórios e popups nativos
│   │   │   └── index.js                 # Fachada pública do módulo
│   │   ├── navigation/                  # Resolução inteligente de URLs e Omnibox
│   │   ├── security/                    # Bloqueio de permissões sensíveis e CSP
│   │   ├── devtools/                    # Inspeção DevTools da página e do chrome
│   │   └── tabs/                        # Abstração Tab e TabManager (WebContentsView)
│   │       ├── tab.js
│   │       └── tab-manager.js
│   └── app.js                           # Orquestração do ciclo de vida da aplicação
├── preload/
│   └── index.js                         # ContextBridge seguro (nucleoAPI restrita a nucleo://)
└── renderer/
    ├── bookmarks.html                   # Interface do Gerenciador de Favoritos
    ├── history.html                     # Interface do Histórico de Navegação
    ├── index.html                       # Top chrome (abas, omnibox, shield, extensões)
    ├── newtab.html                      # Página de Nova Aba com atalhos de Acesso Rápido
    ├── shield.html                      # Dashboard de controle e estatísticas do Shield
    ├── shield-test.html                 # Fixture de validação determinística de rede do Shield
    ├── extensions.html                  # Dashboard do Gerenciador de Extensões Chromium
    ├── extension-test.html              # Fixture de validação de content scripts e isolamento
    ├── settings.html                    # Central de Configurações Obsidian do Núcleo Browser
    ├── scripts/
    │   ├── address-bar.js               # Formatação e digitação de URLs
    │   └── ui-controller.js             # Controle da UI, abas, popovers e troca de temas
    └── styles/
        ├── main.css                     # Estilos principais, botões, modais e layouts
        └── theme.css                    # Variáveis CSS, temas (Dark/Light) e 5 cores de acento
```

---

## 6. Como Executar e Testar

### Requisitos do Sistema
* **Sistema Operacional**: Windows 10 ou Windows 11 (64-bit).
* **Node.js**: v18.0.0 ou superior (testado no Node.js v24).
* **npm**: v9.0.0 ou superior.

### 1. Instalação das Dependências
```bash
npm install
```

### 2. Executar em Modo de Desenvolvimento
```bash
npm start
```
Ou diretamente via Electron:
```bash
npx electron .
```

### 3. Executar a Suíte Completa de Testes Automatizados
O Núcleo Browser inclui **7 suítes de testes unitários** e **14 testes de integração automatizados** executados diretamente com uma instância real do Electron:
```bash
npm test
```
*Valida resolução de URLs, favoritos, histórico, persistência atômica, regras do Núcleo Shield, ciclo de vida de extensões Chromium (MV2/MV3), central de configurações, buscador dinâmico e exclusão de histórico de páginas internas com 100% de aprovação.*

### 4. Gerar o Executável Windows (Build)
Para gerar a versão compilada e descompactada para Windows:
```bash
npm run pack
```
O executável final estará disponível em:
```text
dist/win-unpacked/Núcleo Browser.exe
```

Para gerar o instalador portátil / instalador NSIS completo:
```bash
npm run dist
```

Para gerar rapidamente apenas o instalador NSIS do Windows:
```bash
npm run dist:installer
```

Para compilar o instalador e abrir a pasta de saída (`dist/`):
```bash
npm run dist:open
```

Para compilar e iniciar o instalador automaticamente para teste imediato:
```bash
npm run dist:run
```

O instalador gerado estará localizado em:
```text
dist/Núcleo Browser Setup 0.7.0.exe
```

---

## 7. Roadmap Evolutivo do Projeto

- [x] **v0.1.0**: Fundação Chromium + Electron + Janela Principal + Navegação HTTPS real.
- [x] **v0.2.0**: Sistema Completo de Abas independentes com `WebContentsView`.
- [x] **v0.3.0**: Favoritos hierárquicos, Histórico com retenção e Persistência atômica.
- [x] **v0.4.0**: Núcleo Shield — Bloqueador nativo de anúncios e rastreadores na camada de rede.
- [x] **v0.5.0**: Sistema de Extensões Chromium reais (Manifest V2 e V3) e isolamento local.
- [x] **v0.6.0**: Central de Configurações (`nucleo://settings`), Provedores de Busca, Navegador Padrão e Temas.
- [x] **v0.7.0**: Workspaces para organização de tarefas e contextos de abas sem recarregamento.
- [ ] **v0.8.0**: Downloads Manager com painel visual flutuante e controle de velocidade.
- [ ] **v0.9.0**: Inteligência Artificial contextual integrada ao navegador.

---

## 8. Licença

Este projeto é distribuído sob a licença **MIT**. Consulte o arquivo de licença para mais detalhes.
