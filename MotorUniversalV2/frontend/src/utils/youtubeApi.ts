/**
 * Carga única (singleton) del IFrame Player API de YouTube.
 *
 * El API se descarga desde https://www.youtube.com/iframe_api e invoca el
 * callback global `window.onYouTubeIframeAPIReady` cuando `window.YT` está listo.
 * Devolvemos una promesa que resuelve con `window.YT` para poder crear players
 * (`new YT.Player(...)`) con controles nativos apagados y dibujar los nuestros.
 *
 * Requiere que el CSP permita https://www.youtube.com en script-src.
 */

// `YT` no está tipado (no usamos @types/youtube); se trata como any.
type YouTubeNamespace = any;

let apiPromise: Promise<YouTubeNamespace> | null = null;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeNamespace>((resolve) => {
    const w = window as any;

    // Ya cargado.
    if (w.YT && w.YT.Player) {
      resolve(w.YT);
      return;
    }

    // Encadenar el callback global por si alguien más lo definió.
    const previous = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') {
        try {
          previous();
        } catch {
          /* noop */
        }
      }
      resolve(w.YT);
    };

    // Inyectar el script una sola vez.
    if (!document.getElementById('youtube-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
  });

  return apiPromise;
}
