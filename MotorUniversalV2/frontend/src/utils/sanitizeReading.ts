import DOMPurify from 'dompurify';

// Configuración de saneado compartida para el contenido de las lecturas.
// Garantiza que las imágenes referenciadas en el HTML (URLs externas http/https,
// imágenes embebidas en base64 `data:` o `blob:`) y sus atributos de tamaño/alineación
// sobrevivan al saneado, de modo que se vean igual en el editor, la previsualización
// y la página pública del módulo de materiales de estudio.
const READING_SANITIZE_CONFIG: DOMPurify.Config = {
  ADD_TAGS: ['img'],
  ADD_ATTR: [
    'target',
    'colspan',
    'rowspan',
    'style',
    'align',
    'width',
    'height',
    'data-align',
    'src',
    'srcset',
    'alt',
    'title',
    'loading',
  ],
  // Permite explícitamente imágenes referenciadas por http(s), data:base64 y blob:
  ALLOWED_URI_REGEXP:
    /^(?:(?:https?|mailto|tel|callto|sms|cid|xmpp|data|blob):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
};

/**
 * Sanitiza el HTML de una lectura preservando imágenes referenciadas y sus atributos.
 * Usar en todos los puntos de render (editor, previsualización y página pública)
 * para que el contenido se vea de forma idéntica.
 */
export function sanitizeReadingHtml(html: string): string {
  return DOMPurify.sanitize(html || '', READING_SANITIZE_CONFIG) as string;
}

export { READING_SANITIZE_CONFIG };
