/* global window, document, navigator, localStorage, sessionStorage, URLSearchParams, URL, DOMException, TextEncoder, queueMicrotask */
(() => {
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get('previewScenario');
  const language = params.get('previewLanguage');
  if (scenario) {
    sessionStorage.setItem('rote-auth-preview', scenario);
    document.cookie = `rote-auth-preview=${encodeURIComponent(scenario)}; path=/; SameSite=Lax`;
    localStorage.removeItem('rote_access_token');
    localStorage.removeItem('rote_refresh_token');
    localStorage.removeItem('profile');
    sessionStorage.removeItem('rote-passkey-adoption');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('rote-passkey-adoption-offered:')) localStorage.removeItem(key);
    }
    localStorage.setItem('vite-ui-theme', params.get('previewTheme') || 'light');
  }
  if (scenario || language) {
    localStorage.setItem('userLanguage', ['zh', 'en', 'ja'].includes(language) ? language : 'zh');
  }
  window.__ROTE_CONFIG__ = { VITE_API_BASE: window.location.origin };
  const selected = sessionStorage.getItem('rote-auth-preview') || 'all';
  if (selected === 'unsupported') {
    Object.defineProperty(window, 'PublicKeyCredential', { value: undefined, configurable: true });
  } else {
    const credential = (method) => {
      if (selected === 'cancel' || (selected === 'no-passkey' && method === 'get'))
        throw new DOMException('', 'NotAllowedError');
      const bytes = new TextEncoder().encode('local-preview').buffer;
      return {
        id: 'cHJldmlldy1jcmVkZW50aWFs',
        rawId: bytes,
        type: 'public-key',
        authenticatorAttachment: 'platform',
        getClientExtensionResults: () => ({}),
        response: {
          attestationObject: bytes,
          clientDataJSON: bytes,
          authenticatorData: bytes,
          signature: bytes,
          userHandle: bytes,
          getTransports: () => ['internal'],
        },
      };
    };
    for (const method of ['create', 'get']) {
      const original = navigator.credentials[method].bind(navigator.credentials);
      Object.defineProperty(navigator.credentials, method, {
        configurable: true,
        value: async (options) => (options?.publicKey ? credential(method) : original(options)),
      });
    }
  }
  for (const method of ['pushState', 'replaceState']) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (state, unused, url) => {
      const result = original(state, unused, url);
      if (url && new URL(url, window.location.origin).pathname === '/__auth-preview/success') {
        queueMicrotask(() => window.location.replace(url));
      }
      return result;
    };
  }
})();
