import type { CSSProperties } from 'react';

/**
 * Paleta fija del examen y de la pantalla de resultados (Tailwind blue, validada WCAG AA).
 *
 * El examen y los resultados NO usan la personalización de color del plantel para evitar
 * problemas de contraste/legibilidad: se redefinen las variables `--color-primary-*` en el
 * contenedor raíz, de modo que todos los `primary-*` usan esta paleta fija sin importar la
 * personalización del campus.
 *
 * NOTA: el "reporte de evaluación" (EvaluationReportDetailPage) SÍ conserva la paleta del
 * plantel (branding institucional), por lo que NO debe usar esta constante.
 */
export const EXAM_FIXED_PALETTE = {
  ['--color-primary-50' as any]: '#eff6ff',
  ['--color-primary-100' as any]: '#dbeafe',
  ['--color-primary-200' as any]: '#bfdbfe',
  ['--color-primary-300' as any]: '#93c5fd',
  ['--color-primary-400' as any]: '#60a5fa',
  ['--color-primary-500' as any]: '#3b82f6',
  ['--color-primary-600' as any]: '#2563eb',
  ['--color-primary-700' as any]: '#1d4ed8',
  ['--color-primary-800' as any]: '#1e40af',
  ['--color-primary-900' as any]: '#1e3a8a',
} as CSSProperties;
