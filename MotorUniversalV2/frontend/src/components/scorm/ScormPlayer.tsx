import { useEffect, useRef, useState } from 'react';
import { Scorm12API } from 'scorm-again';
import { commitScorm, getScormAttempt, ScormAttempt, ScormPackage } from '../../services/scormService';

interface Props {
  pkg: Pick<ScormPackage, 'id' | 'title' | 'launch_url'>;
  onProgress?: (attempt: ScormAttempt) => void;
  onCompleted?: (attempt: ScormAttempt) => void;
  className?: string;
}

/**
 * Reproductor SCORM 1.2.
 *
 * - Crea un `Scorm12API` global en `window` antes de cargar el iframe.
 * - Pre-carga el `cmi` desde el último attempt (suspend_data + status).
 * - En cada `Commit`/`Terminate` del SCO, persiste al backend.
 */
export default function ScormPlayer({ pkg, onProgress, onCompleted, className = '' }: Props) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const apiRef = useRef<Scorm12API | null>(null);
  const lastCommitRef = useRef<string>('');
  const [attempt, setAttempt] = useState<ScormAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      try {
        // Cargar attempt previo
        let prev: ScormAttempt | null = null;
        try {
          prev = await getScormAttempt(pkg.id);
        } catch {
          prev = null;
        }
        if (cancelled) return;
        setAttempt(prev);

        // Inicializar API SCORM 1.2
        const api = new Scorm12API({
          autocommit: true,
          autocommitSeconds: 30,
          logLevel: 4,
        });

        // Pre-cargar CMI con el estado guardado
        if (prev) {
          api.cmi.core.lesson_status = (prev.lesson_status as Scorm12API['cmi']['core']['lesson_status']) || 'not attempted';
          if (prev.location) api.cmi.core.lesson_location = prev.location;
          if (prev.suspend_data) api.cmi.suspend_data = prev.suspend_data;
          if (prev.score_raw != null) api.cmi.core.score.raw = String(prev.score_raw);
          if (prev.score_min != null) api.cmi.core.score.min = String(prev.score_min);
          if (prev.score_max != null) api.cmi.core.score.max = String(prev.score_max);
          if (prev.total_time) api.cmi.core.total_time = prev.total_time;
        }

        // Listener: cada Commit del SCO → POST al backend
        const persist = async (finished: boolean) => {
          try {
            const cmi = api.cmi;
            const payload = {
              lesson_status: cmi.core.lesson_status,
              completion_status: cmi.core.lesson_status, // SCORM 1.2 usa lesson_status como ambos
              success_status:
                cmi.core.lesson_status === 'passed' ? 'passed' :
                cmi.core.lesson_status === 'failed' ? 'failed' : undefined,
              score: {
                raw: cmi.core.score.raw ? Number(cmi.core.score.raw) : undefined,
                min: cmi.core.score.min ? Number(cmi.core.score.min) : undefined,
                max: cmi.core.score.max ? Number(cmi.core.score.max) : undefined,
              },
              session_time: cmi.core.session_time,
              total_time: cmi.core.total_time,
              location: cmi.core.lesson_location || undefined,
              suspend_data: cmi.suspend_data || undefined,
              exit: cmi.core.exit || undefined,
              cmi: api.renderCMIToJSONObject?.() ?? undefined,
              finished,
            };
            // Evitar commits duplicados consecutivos idénticos
            const sig = JSON.stringify({ ...payload, cmi: undefined });
            if (!finished && sig === lastCommitRef.current) return;
            lastCommitRef.current = sig;

            const updated = await commitScorm(pkg.id, payload);
            setAttempt(updated);
            onProgress?.(updated);
            if (updated.is_completed) onCompleted?.(updated);
          } catch (e) {
            console.error('[SCORM] Error en commit:', e);
          }
        };

        api.on('Commit', () => { void persist(false); });
        api.on('Terminate', () => { void persist(true); });
        api.on('LMSCommit', () => { void persist(false); });
        api.on('LMSFinish', () => { void persist(true); });

        // El SCO espera encontrar la API en window.API (SCORM 1.2)
        (window as unknown as { API: Scorm12API }).API = api;
        apiRef.current = api;

        setLoading(false);
      } catch (e) {
        const msg = (e as { message?: string })?.message || 'Error inicializando reproductor SCORM';
        setError(String(msg));
        setLoading(false);
      }
    };
    void setup();

    return () => {
      cancelled = true;
      try {
        apiRef.current?.terminate?.('LMSFinish', false);
      } catch {
        /* noop */
      }
      try {
        delete (window as unknown as { API?: unknown }).API;
      } catch {
        /* noop */
      }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg.id, pkg.launch_url]);

  if (error) {
    return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span className="font-medium">{pkg.title}</span>
        {attempt && (
          <span className={`px-2 py-0.5 rounded text-xs ${attempt.is_completed ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {attempt.is_completed ? 'Completado' : (attempt.lesson_status || 'En progreso')}
            {attempt.score_raw != null && ` · Score ${attempt.score_raw}`}
          </span>
        )}
      </div>
      <div className="relative w-full" style={{ paddingTop: '60%' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded">
            <span className="text-gray-500">Inicializando SCORM…</span>
          </div>
        )}
        {!loading && (
          <iframe
            ref={iframeRef}
            src={pkg.launch_url}
            title={pkg.title}
            className="absolute inset-0 w-full h-full rounded border"
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        )}
      </div>
    </div>
  );
}
