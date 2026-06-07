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

// Tiempo máximo de espera por la carga del API antes de rendirse. Cubre el caso
// en que un bloqueador (uBlock/AdGuard/Brave/Pi-hole/DNS corporativo) impide la
// descarga de iframe_api sin disparar `onerror` (p. ej. la petición se queda
// colgada o se resuelve a un sinkhole).
const LOAD_TIMEOUT_MS = 8000;

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const w = window as any;

    // Ya cargado.
    if (w.YT && w.YT.Player) {
      resolve(w.YT);
      return;
    }

    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      // Limpiar el singleton para permitir un reintento posterior y quitar el
      // <script> fallido para que un nuevo intento lo vuelva a inyectar.
      apiPromise = null;
      document.getElementById('youtube-iframe-api')?.remove();
      reject(err);
    };

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
      if (settled) return;
      settled = true;
      cleanup();
      resolve(w.YT);
    };

    // Inyectar el script una sola vez.
    let tag = document.getElementById('youtube-iframe-api') as HTMLScriptElement | null;
    if (!tag) {
      tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    tag.addEventListener('error', () =>
      fail(new Error('No se pudo cargar el IFrame API de YouTube (bloqueado o sin red).'))
    );

    timeoutId = setTimeout(
      () => fail(new Error('Timeout cargando el IFrame API de YouTube.')),
      LOAD_TIMEOUT_MS
    );
  });

  return apiPromise;
}
