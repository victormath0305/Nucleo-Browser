/**
 * Núcleo Browser - Permissions Utilities & Constants
 * Normalization, origin extraction, permission mapping, and UI metadata.
 * @module modules/permissions/permissions-utils
 */

const { URL } = require('url');

/**
 * Standard supported permissions in Núcleo Browser (Electron / Chromium).
 */
const SUPPORTED_PERMISSIONS = [
  'camera',
  'microphone',
  'geolocation',
  'notifications',
  'clipboard',
  'fullscreen',
  'midi',
  'sensors',
  'pointerLock',
  'usb',
  'serial',
  'bluetooth'
];

/**
 * Valid permission states.
 */
const PERMISSION_STATES = ['allow', 'deny', 'ask'];
PERMISSION_STATES.ALLOW = 'allow';
PERMISSION_STATES.DENY = 'deny';
PERMISSION_STATES.ASK = 'ask';

/**
 * Detailed metadata on permissions that cannot be individually controlled per-origin
 * via standard Chromium permission handlers, documented for architectural transparency.
 */
const UNSUPPORTED_PERMISSIONS = {
  autoplay: {
    supported: false,
    reason: 'Controlado globalmente por Chromium Autoplay Policy flags e gestos de interação do usuário (User Gesture Activation), não por PermissionRequestHandler.'
  },
  drm: {
    supported: false,
    reason: 'Controlado por componentes Widevine CDM do Chromium em nível de compilação da engine, sem prompt granular per-request.'
  },
  webRtcIdentity: {
    supported: false,
    reason: 'API depreciada no padrão Chromium moderno.'
  }
};

/**
 * UI Metadata and descriptions for supported permissions.
 */
const PERMISSION_META = {
  camera: {
    id: 'camera',
    label: 'Câmera',
    description: 'Acesso à webcam e dispositivos de captura de vídeo',
    icon: 'camera'
  },
  microphone: {
    id: 'microphone',
    label: 'Microfone',
    description: 'Acesso ao microfone e dispositivos de gravação de áudio',
    icon: 'microphone'
  },
  geolocation: {
    id: 'geolocation',
    label: 'Localização',
    description: 'Acesso à posição geográfica precisa do dispositivo',
    icon: 'location'
  },
  notifications: {
    id: 'notifications',
    label: 'Notificações',
    description: 'Envio de notificações de desktop do sistema operacional',
    icon: 'bell'
  },
  clipboard: {
    id: 'clipboard',
    label: 'Área de Transferência',
    description: 'Leitura e escrita de dados da área de transferência',
    icon: 'clipboard'
  },
  fullscreen: {
    id: 'fullscreen',
    label: 'Tela Cheia',
    description: 'Exibição de conteúdo em modo tela inteira sem moldura',
    icon: 'maximize'
  },
  midi: {
    id: 'midi',
    label: 'Dispositivos MIDI',
    description: 'Comunicação com instrumentos musicais e controladores MIDI',
    icon: 'music'
  },
  sensors: {
    id: 'sensors',
    label: 'Sensores de Movimento',
    description: 'Leitura de acelerômetro, giroscópio e magnetômetro',
    icon: 'compass'
  },
  pointerLock: {
    id: 'pointerLock',
    label: 'Bloqueio do Cursor',
    description: 'Captura contínua do ponteiro do mouse para jogos ou 3D',
    icon: 'cursor'
  },
  usb: {
    id: 'usb',
    label: 'Dispositivos USB',
    description: 'Acesso direto a dispositivos de hardware conectados por USB',
    icon: 'usb'
  },
  serial: {
    id: 'serial',
    label: 'Portas Seriais',
    description: 'Comunicação direta com portas seriais e adaptadores COM',
    icon: 'cpu'
  },
  bluetooth: {
    id: 'bluetooth',
    label: 'Bluetooth',
    description: 'Conexão e pareamento com periféricos sem fio Bluetooth',
    icon: 'bluetooth'
  }
};

/**
 * Extracts and strictly normalizes the real origin from any URL string.
 * Considers scheme, hostname, and port. Strips paths, search queries, and fragments.
 * Never trusts document.title or visual names.
 *
 * @param {string} rawUrl
 * @returns {string|null} Normalized origin (e.g. "https://example.com:8443", "http://localhost:3000") or null if invalid
 */
function normalizeOrigin(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);

    // Reject non-origin pseudo schemes
    if (['javascript:', 'data:', 'about:', 'blob:'].includes(parsed.protocol)) {
      return null;
    }

    // Standard HTTP / HTTPS origins (scheme + host + optional port)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.origin.toLowerCase();
    }

    // Local file protocol
    if (parsed.protocol === 'file:') {
      return 'file://';
    }

    // Internal Nucleo Browser pages
    if (parsed.protocol === 'nucleo:') {
      const host = parsed.hostname ? parsed.hostname.toLowerCase() : 'browser';
      return `nucleo://${host}`;
    }

    // Extension contexts
    if (parsed.protocol === 'chrome-extension:') {
      return `chrome-extension://${parsed.hostname.toLowerCase()}`;
    }

    // Other valid schemes
    if (parsed.origin && parsed.origin !== 'null') {
      return parsed.origin.toLowerCase();
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Checks whether an origin operates within a cryptographically secure context.
 *
 * @param {string} origin
 * @returns {boolean}
 */
function isSecureContext(origin) {
  if (!origin || typeof origin !== 'string') return false;
  if (origin.startsWith('https://')) return true;
  if (origin.startsWith('nucleo://')) return true;
  if (origin.startsWith('chrome-extension://')) return true;
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  return false;
}

/**
 * Maps raw Electron/Chromium permission strings and details into our canonical permission names.
 *
 * @param {string} rawPermission
 * @param {object} [details]
 * @returns {string[]} Array of canonical permission names (e.g. ['camera'], ['microphone'], etc.)
 */
function mapPermissionType(rawPermission, details = {}) {
  if (!rawPermission || typeof rawPermission !== 'string') return [];

  const lower = rawPermission.toLowerCase();

  switch (lower) {
    case 'media': {
      const mediaTypes = Array.isArray(details.mediaTypes) ? details.mediaTypes : [];
      const result = [];
      if (mediaTypes.includes('video')) result.push('camera');
      if (mediaTypes.includes('audio')) result.push('microphone');
      return result.length > 0 ? result : ['camera', 'microphone'];
    }

    case 'camera':
    case 'video':
      return ['camera'];

    case 'microphone':
    case 'audio':
      return ['microphone'];

    case 'geolocation':
      return ['geolocation'];

    case 'notifications':
      return ['notifications'];

    case 'clipboard-read':
    case 'clipboard-sanitized-write':
    case 'clipboard':
      return ['clipboard'];

    case 'fullscreen':
      return ['fullscreen'];

    case 'midi':
    case 'midisysex':
      return ['midi'];

    case 'sensors':
      return ['sensors'];

    case 'pointerlock':
      return ['pointerLock'];

    case 'usb':
      return ['usb'];

    case 'serial':
      return ['serial'];

    case 'bluetooth':
      return ['bluetooth'];

    case 'openexternal':
      return ['openExternal'];

    default:
      if (SUPPORTED_PERMISSIONS.includes(lower)) {
        return [lower];
      }
      return [];
  }
}

/**
 * Retrieves the display metadata for a permission.
 *
 * @param {string} permission
 * @returns {object}
 */
function getPermissionMeta(permission) {
  if (PERMISSION_META[permission]) {
    return { ...PERMISSION_META[permission] };
  }
  return {
    id: permission,
    label: permission.charAt(0).toUpperCase() + permission.slice(1),
    description: `Acesso ao recurso ${permission}`,
    icon: 'lock'
  };
}

module.exports = {
  SUPPORTED_PERMISSIONS,
  PERMISSION_STATES,
  UNSUPPORTED_PERMISSIONS,
  PERMISSION_META,
  normalizeOrigin,
  isSecureContext,
  mapPermissionType,
  getPermissionMeta
};
