/**
 * Reproductor de video unificado con controles propios (estilo del proyecto).
 *
 * Soporta tres "motores" con la MISMA barra de controles (play/pausa, barra de
 * avance, volumen, tiempo y pantalla completa):
 *   - 'direct' : archivo HTML5 (<video>), p. ej. blobs/CDN de Azure.
 *   - 'youtube': YouTube IFrame Player API (controles nativos apagados).
 *   - 'vimeo'  : Vimeo Player SDK (@vimeo/player, controles nativos apagados).
 *
 * Un iframe plano cross-origin no se puede controlar desde el padre, así que para
 * YouTube/Vimeo usamos sus APIs JS con controls=0 y dibujamos nuestros controles
 * encima. Así el material de estudio muestra el mismo reproductor para los 3
 * orígenes, sin el "chrome" de YouTube/Vimeo.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2 } from 'lucide-react';
import VimeoPlayer from '@vimeo/player';
import { loadYouTubeIframeApi } from '../utils/youtubeApi';
import { parseVideoSource, VideoSourceType } from '../utils/videoEmbed';

interface CustomVideoPlayerProps {
  src: string;
  /** Motor a usar. Si se omite, se detecta desde `src`. */
  type?: VideoSourceType;
  className?: string;
  onEnded?: () => void;
  /** Solo aplica a 'direct'. */
  objectFit?: 'contain' | 'cover' | 'fill';
  /** Solo aplica a 'direct'. */
  onDimensionsLoaded?: (width: number, height: number) => void;
}

const fillIframe = (iframe: HTMLIFrameElement | null | undefined) => {
  if (iframe) {
    iframe.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;border:0;';
  }
};

const CustomVideoPlayer: React.FC<CustomVideoPlayerProps> = ({
  src,
  type,
  className = '',
  onEnded,
  objectFit = 'contain',
  onDimensionsLoaded,
}) => {
  const engine: VideoSourceType = type ?? parseVideoSource(src).type;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hostRef = useRef<HTMLDivElement>(null); // contenedor de YT/Vimeo
  const ytRef = useRef<any>(null); // YT.Player
  const vimeoRef = useRef<VimeoPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // onEnded sin recrear los efectos de inicialización.
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

  const [isReady, setIsReady] = useState(engine === 'direct');
  // Si la IFrame API de YouTube no carga (p. ej. la bloquea un adblocker/DNS),
  // caemos a un <iframe> plano con controles nativos para que el video al menos
  // se reproduzca. En ese modo no podemos dibujar nuestros propios controles.
  const [ytApiFailed, setYtApiFailed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isHovering, setIsHovering] = useState(false);

  // ───────────────────────── Motor: HTML5 <video> (direct) ────────────────────
  useEffect(() => {
    if (engine !== 'direct') return;
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      if (video.videoWidth && video.videoHeight && onDimensionsLoaded) {
        onDimensionsLoaded(video.videoWidth, video.videoHeight);
      }
    };
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      onEndedRef.current?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [engine, src, onDimensionsLoaded]);

  // ───────────────────────────── Motor: YouTube ───────────────────────────────
  useEffect(() => {
    if (engine !== 'youtube' || !hostRef.current) return;
    const { youtubeId } = parseVideoSource(src);
    if (!youtubeId) return;

    let destroyed = false;
    const host = hostRef.current;
    const inner = document.createElement('div');
    host.appendChild(inner);

    loadYouTubeIframeApi().then((YT) => {
      if (destroyed) return;
      setYtApiFailed(false);
      // eslint-disable-next-line new-cap
      const player = new YT.Player(inner, {
        width: '100%',
        height: '100%',
        videoId: youtubeId,
        playerVars: {
          controls: 0,
          modestbranding: 1,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          fs: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            if (destroyed) return;
            ytRef.current = e.target;
            fillIframe(e.target.getIframe?.());
            setDuration(e.target.getDuration?.() || 0);
            setIsReady(true);
            // Poll del tiempo (el IFrame API no emite timeupdate).
            pollRef.current = setInterval(() => {
              const p = ytRef.current;
              if (p?.getCurrentTime) {
                setCurrentTime(p.getCurrentTime() || 0);
                const d = p.getDuration?.();
                if (d) setDuration(d);
              }
            }, 250);
          },
          onStateChange: (e: any) => {
            // YT.PlayerState: ENDED=0, PLAYING=1, PAUSED=2
            if (e.data === 1) setIsPlaying(true);
            else if (e.data === 2) setIsPlaying(false);
            else if (e.data === 0) {
              setIsPlaying(false);
              onEndedRef.current?.();
            }
          },
        },
      });
      ytRef.current = player;
    }).catch(() => {
      // API bloqueada o sin red: usar el iframe plano como respaldo.
      if (!destroyed) {
        setYtApiFailed(true);
        setIsReady(true);
      }
    });

    return () => {
      destroyed = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      try {
        ytRef.current?.destroy?.();
      } catch {
        /* noop */
      }
      ytRef.current = null;
      host.innerHTML = '';
    };
  }, [engine, src]);

  // ────────────────────────────── Motor: Vimeo ────────────────────────────────
  useEffect(() => {
    if (engine !== 'vimeo' || !hostRef.current) return;
    const { vimeoId, vimeoHash } = parseVideoSource(src);
    if (!vimeoId) return;

    let destroyed = false;
    const host = hostRef.current;
    const playerUrl = (vimeoHash
      ? `https://player.vimeo.com/video/${vimeoId}?h=${vimeoHash}`
      : `https://player.vimeo.com/video/${vimeoId}`) as `https://player.vimeo.com/video/${string}`;

    const player = new VimeoPlayer(host, {
      url: playerUrl,
      controls: false,
      title: false,
      byline: false,
      portrait: false,
      responsive: false,
    });
    vimeoRef.current = player;

    player
      .ready()
      .then(() => {
        if (destroyed) return;
        fillIframe(host.querySelector('iframe'));
        setIsReady(true);
        player
          .getDuration()
          .then((d) => !destroyed && setDuration(d || 0))
          .catch(() => {});
      })
      .catch(() => {});

    player.on('timeupdate', (data: { seconds: number; duration: number }) => {
      setCurrentTime(data.seconds);
      if (data.duration) setDuration(data.duration);
    });
    player.on('play', () => setIsPlaying(true));
    player.on('pause', () => setIsPlaying(false));
    player.on('ended', () => {
      setIsPlaying(false);
      onEndedRef.current?.();
    });

    return () => {
      destroyed = true;
      try {
        player.destroy();
      } catch {
        /* noop */
      }
      vimeoRef.current = null;
    };
  }, [engine, src]);

  // ───────────────────────── Pantalla completa (común) ────────────────────────
  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ───────────────────────────── Comandos (común) ─────────────────────────────
  const play = useCallback(() => {
    if (engine === 'direct') videoRef.current?.play();
    else if (engine === 'youtube') ytRef.current?.playVideo?.();
    else if (engine === 'vimeo') vimeoRef.current?.play().catch(() => {});
  }, [engine]);

  const pause = useCallback(() => {
    if (engine === 'direct') videoRef.current?.pause();
    else if (engine === 'youtube') ytRef.current?.pauseVideo?.();
    else if (engine === 'vimeo') vimeoRef.current?.pause().catch(() => {});
  }, [engine]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, play, pause]);

  const seekTo = useCallback(
    (time: number) => {
      setCurrentTime(time);
      if (engine === 'direct') {
        if (videoRef.current) videoRef.current.currentTime = time;
      } else if (engine === 'youtube') {
        ytRef.current?.seekTo?.(time, true);
      } else if (engine === 'vimeo') {
        vimeoRef.current?.setCurrentTime(time).catch(() => {});
      }
    },
    [engine]
  );

  const applyVolume = useCallback(
    (vol: number, muted: boolean) => {
      const effective = muted ? 0 : vol;
      if (engine === 'direct') {
        if (videoRef.current) {
          videoRef.current.volume = effective;
          videoRef.current.muted = muted;
        }
      } else if (engine === 'youtube') {
        ytRef.current?.setVolume?.(effective * 100);
        if (muted) ytRef.current?.mute?.();
        else ytRef.current?.unMute?.();
      } else if (engine === 'vimeo') {
        vimeoRef.current?.setVolume(effective).catch(() => {});
      }
    },
    [engine]
  );

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(1, pos)) * duration);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    const muted = newVolume === 0;
    setVolume(newVolume);
    setIsMuted(muted);
    applyVolume(newVolume, muted);
  };

  const toggleMute = () => {
    const muted = !isMuted;
    setIsMuted(muted);
    applyVolume(volume || 0.5, muted);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) await container.requestFullscreen().catch(() => {});
    else await document.exitFullscreen().catch(() => {});
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || time < 0) time = 0;
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying && !isHovering) {
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const handleMouseEnter = () => {
    setIsHovering(true);
    setShowControls(true);
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 2000);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Respaldo cuando la IFrame API de YouTube no carga: iframe plano con controles
  // nativos desde youtube-nocookie.com (ya permitido en frame-src del CSP).
  const ytFallbackUrl =
    engine === 'youtube'
      ? `https://www.youtube-nocookie.com/embed/${parseVideoSource(src).youtubeId ?? ''}?rel=0`
      : '';

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden group ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Media */}
      {engine === 'direct' ? (
        <video
          ref={videoRef}
          src={src}
          className="w-full h-full cursor-pointer"
          style={{ objectFit }}
          onClick={togglePlay}
          preload="metadata"
        />
      ) : engine === 'youtube' && ytApiFailed ? (
        <iframe
          src={ytFallbackUrl}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          // YouTube valida el dominio que embebe con el header Referer; sin él
          // devuelve "Error 153". Forzar el envío del origen evita ese error
          // cuando la política de referer por defecto es restrictiva.
          referrerPolicy="strict-origin-when-cross-origin"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          title="YouTube video"
        />
      ) : (
        <div ref={hostRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* Capa para click-to-toggle sobre el iframe de YouTube/Vimeo (no en modo
          fallback: ahí mandan los controles nativos del iframe). */}
      {engine !== 'direct' && isReady && !ytApiFailed && (
        <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay} />
      )}

      {/* Loading (YouTube/Vimeo mientras carga el SDK) */}
      {!isReady && engine !== 'direct' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black">
          <Loader2 className="w-8 h-8 text-primary-400 animate-spin" />
        </div>
      )}

      {/* Overlay play grande (al pausar) */}
      {isReady && !isPlaying && !ytApiFailed && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 cursor-pointer"
          onClick={togglePlay}
        >
          <div className="w-20 h-20 bg-primary-600 rounded-full flex items-center justify-center shadow-lg hover:bg-primary-700 transition-colors">
            <Play className="w-10 h-10 text-white ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Controles propios (ocultos en modo fallback: manda el iframe nativo) */}
      {!ytApiFailed && (
      <div
        className={`absolute bottom-0 left-0 right-0 z-30 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-3 px-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Barra de progreso */}
        <div
          className="h-1 bg-white/30 rounded-full cursor-pointer mb-3 group/progress"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-primary-500 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary-500 rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controles inferiores */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="text-white hover:text-primary-400 transition-colors p-1"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6" fill="currentColor" />
              )}
            </button>

            <div className="flex items-center gap-2 group/volume">
              <button
                onClick={toggleMute}
                className="text-white hover:text-primary-400 transition-colors p-1"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-white/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
            </div>

            <span className="text-white text-sm font-medium">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="text-white hover:text-primary-400 transition-colors p-1"
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5" />
              ) : (
                <Maximize className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

export default CustomVideoPlayer;
