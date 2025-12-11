/*! coi-serviceworker v0.1.11 - Guido Zuidhof and contributors - MIT License */
(function() {
  'use strict';
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const coepCredentialless = document.currentScript?.dataset?.coepCredentialless === 'true';
  const coepValue = coepCredentialless ? 'credentialless' : 'require-corp';
  const coepCredentiallessValue = coepCredentialless ? '?coepCredentialless' : '';
  const sw = 'coi-serviceworker' + coepCredentiallessValue + '.js';
  const url = new URL(sw, import.meta.url);
  if (url.protocol === 'http:' && location.protocol === 'https:') {
    console.warn('COI ServiceWorker: HTTPS required for ServiceWorker registration');
    return;
  }
  navigator.serviceWorker.register(sw).then((registration) => {
    console.log('COI ServiceWorker registered', registration.scope);
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'activated' && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      });
    });
  }).catch((error) => {
    console.error('COI ServiceWorker registration failed:', error);
  });
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'coi' });
  }
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'coi') {
      window.location.reload();
    }
  });
})();
