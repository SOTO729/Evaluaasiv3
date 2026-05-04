/**
 * Confetti — Animación de confeti CSS pura para celebrar pagos exitosos.
 *
 * Renderiza N piezas de confeti que caen y rotan. No requiere dependencias.
 */
import { useMemo } from 'react';

interface ConfettiProps {
  /** Número de piezas. Default: 80 */
  count?: number;
  /** Duración base en segundos. Default: 3.5 */
  duration?: number;
  /** Z-index del contenedor. Default: 60 */
  zIndex?: number;
}

const COLORS = [
  '#10b981', // emerald
  '#34d399', // emerald-400
  '#fbbf24', // amber
  '#f59e0b', // amber-500
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#ef4444', // red
  '#14b8a6', // teal
];

export default function Confetti({ count = 80, duration = 3.5, zIndex = 60 }: ConfettiProps) {
  const pieces = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = duration + Math.random() * 1.5;
      const color = COLORS[i % COLORS.length];
      const size = 6 + Math.random() * 8;
      const rotate = Math.random() * 360;
      const drift = (Math.random() - 0.5) * 200;
      const shape = Math.random() > 0.5 ? '50%' : '2px';
      return { left, delay, dur, color, size, rotate, drift, shape, id: i };
    });
  }, [count, duration]);

  return (
    <>
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translate3d(0, -20px, 0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--drift, 0px), 110vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden"
        style={{ zIndex }}
      >
        {pieces.map((p) => (
          <span
            key={p.id}
            style={{
              position: 'absolute',
              top: '-20px',
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size * 1.4}px`,
              backgroundColor: p.color,
              borderRadius: p.shape,
              transform: `rotate(${p.rotate}deg)`,
              animation: `confetti-fall ${p.dur}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${p.delay}s forwards`,
              // @ts-expect-error custom CSS var
              '--drift': `${p.drift}px`,
            }}
          />
        ))}
      </div>
    </>
  );
}
