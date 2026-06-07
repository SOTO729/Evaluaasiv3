/**
 * Helpers para convertir URLs de video (YouTube/Vimeo) en URLs embebibles que
 * muestran SOLO el reproductor, sin el "chrome" de la página de origen.
 *
 * Para Vimeo se añaden `title=0&byline=0&portrait=0`, que ocultan el título, el
 * autor (byline), el avatar (portrait) y los botones de acción (compartir, me
 * gusta, ver más tarde) que enlazan a vimeo.com. Así el material de estudio
 * muestra únicamente el video.
 *
 * NOTA: el logotipo de Vimeo y el enlace "Watch on Vimeo" solo pueden quitarse
 * por completo desde la configuración de la cuenta de Vimeo (planes de pago);
 * los parámetros de la URL no pueden suprimirlos.
 */

// Parámetros del reproductor de Vimeo para un embed "limpio" (solo el video).
// Ref.: https://developer.vimeo.com/player/sdk/embed
const VIMEO_CLEAN_PARAMS: Record<string, string> = {
  title: '0',
  byline: '0',
  portrait: '0',
};

/**
 * Asegura que una URL del reproductor de Vimeo (`player.vimeo.com/video/...`)
 * lleve los parámetros de embed limpio, conservando los que ya tenga (por
 * ejemplo el hash de privacidad `?h=`).
 */
const withVimeoCleanParams = (playerUrl: string): string => {
  try {
    const url = new URL(playerUrl);
    for (const [key, value] of Object.entries(VIMEO_CLEAN_PARAMS)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    // Si no es una URL absoluta parseable, añadimos los parámetros de forma
    // manual sin romper el query string existente.
    const extra = Object.entries(VIMEO_CLEAN_PARAMS)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    const separator = playerUrl.includes('?') ? '&' : '?';
    return `${playerUrl}${separator}${extra}`;
  }
};

/**
 * Convierte una URL de YouTube/Vimeo en su URL embebible.
 *
 * Devuelve `null` si la URL no corresponde a un servicio embebible conocido; el
 * llamador decide cómo tratarla (archivo directo, blob de Azure, etc.).
 */
export const getEmbeddableVideoUrl = (url: string): string | null => {
  if (!url) return null;
  const trimmed = url.trim();

  const youtubeMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^&?\s/]+)/
  );
  if (youtubeMatch) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}?feature=oembed`;
  }

  // Si ya es una URL del reproductor de Vimeo, conservarla (incluido el hash
  // ?h=) y asegurar los parámetros de embed limpio.
  if (trimmed.includes('player.vimeo.com/video/')) {
    return withVimeoCleanParams(trimmed);
  }

  // Vimeo: capturar el id y, si existe, el hash de privacidad de videos no listados.
  // Formatos soportados:
  //   vimeo.com/123456789
  //   vimeo.com/123456789/abcdef1234   (hash en la ruta)
  //   vimeo.com/123456789?h=abcdef1234 (hash en query)
  //   vimeo.com/channels/xxx/123456789 · vimeo.com/groups/xxx/videos/123456789
  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/
  );
  if (vimeoMatch) {
    const id = vimeoMatch[1];
    let hash = vimeoMatch[2];
    if (!hash) {
      const hMatch = trimmed.match(/[?&]h=([0-9a-zA-Z]+)/);
      if (hMatch) hash = hMatch[1];
    }
    const base = hash
      ? `https://player.vimeo.com/video/${id}?h=${hash}`
      : `https://player.vimeo.com/video/${id}`;
    return withVimeoCleanParams(base);
  }

  return null;
};

export type VideoSourceType = 'youtube' | 'vimeo' | 'direct';

export interface VideoSource {
  type: VideoSourceType;
  /** URL original (trim). */
  url: string;
  youtubeId?: string;
  vimeoId?: string;
  /** Hash de privacidad para videos no listados de Vimeo. */
  vimeoHash?: string;
}

/**
 * Analiza una URL de video y devuelve su tipo e identificadores. Se usa para el
 * reproductor unificado (CustomVideoPlayer): YouTube y Vimeo se controlan con sus
 * SDKs/APIs, no con un iframe plano. Lo que no es YouTube/Vimeo se trata como
 * `direct` (archivo HTML5).
 */
export const parseVideoSource = (url: string): VideoSource => {
  const trimmed = (url || '').trim();

  const youtubeMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([^&?\s/]+)/
  );
  if (youtubeMatch) {
    return { type: 'youtube', url: trimmed, youtubeId: youtubeMatch[1] };
  }

  // URL del reproductor ya armada: player.vimeo.com/video/<id>?h=<hash>
  const playerMatch = trimmed.match(/player\.vimeo\.com\/video\/(\d+)/);
  if (playerMatch) {
    const hMatch = trimmed.match(/[?&]h=([0-9a-zA-Z]+)/);
    return {
      type: 'vimeo',
      url: trimmed,
      vimeoId: playerMatch[1],
      vimeoHash: hMatch ? hMatch[1] : undefined,
    };
  }

  const vimeoMatch = trimmed.match(
    /vimeo\.com\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?(\d+)(?:\/([0-9a-zA-Z]+))?/
  );
  if (vimeoMatch) {
    let hash = vimeoMatch[2];
    if (!hash) {
      const hMatch = trimmed.match(/[?&]h=([0-9a-zA-Z]+)/);
      if (hMatch) hash = hMatch[1];
    }
    return { type: 'vimeo', url: trimmed, vimeoId: vimeoMatch[1], vimeoHash: hash };
  }

  return { type: 'direct', url: trimmed };
};
