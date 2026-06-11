import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Aviso de cambios sin guardar para editores.
 *
 * - `useUnsavedChanges(isDirty)`: muestra el diálogo nativo del navegador al recargar o
 *   cerrar la pestaña si hay cambios sin guardar.
 * - `<UnsavedChangesModal>`: modal del sitio para la navegación in-app (al pulsar
 *   "volver/cancelar"); se controla con el patrón `tryNavigate` del editor.
 *
 * Uso típico en un editor:
 *   useUnsavedChanges(isDirty);
 *   const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
 *   const tryNavigate = (go: () => void) => { isDirty ? setPendingNav(() => go) : go(); };
 *   // ...botón Volver: onClick={() => tryNavigate(() => navigate('/...'))}
 *   <UnsavedChangesModal
 *     open={!!pendingNav}
 *     onStay={() => setPendingNav(null)}
 *     onLeave={() => { const go = pendingNav; setPendingNav(null); go?.(); }}
 *   />
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);
}

interface UnsavedChangesModalProps {
  open: boolean;
  onStay: () => void;
  onLeave: () => void;
  title?: string;
  message?: string;
}

export function UnsavedChangesModal({
  open,
  onStay,
  onLeave,
  title = 'Tienes cambios sin guardar',
  message = 'Si sales ahora, los cambios que no hayas guardado se perderán. ¿Deseas salir de todas formas?',
}: UnsavedChangesModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onStay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onStay]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onStay}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-sm w-full mx-3 sm:mx-4 flex flex-col animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 sm:gap-4 p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-100">
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 bg-amber-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-4 sm:p-6 pt-3 sm:pt-4">
          <p className="text-sm text-gray-600">{message}</p>
        </div>
        <div className="p-4 sm:p-6 pt-0 flex flex-col sm:flex-row sm:justify-end gap-2">
          <button
            autoFocus
            onClick={onStay}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 border border-gray-200 rounded-md transition-colors"
          >
            Seguir editando
          </button>
          <button
            onClick={onLeave}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors"
          >
            Salir sin guardar
          </button>
        </div>
      </div>
    </div>
  );
}
