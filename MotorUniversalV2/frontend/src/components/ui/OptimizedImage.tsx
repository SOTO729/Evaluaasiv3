/**
 * Componente de imagen optimizada con lazy loading, placeholder y manejo de errores
 * Mejora la experiencia de carga de imágenes en la aplicación
 */
import { useState, useRef, useEffect } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
  fallbackIcon?: React.ReactNode;
  onLoad?: () => void;
  onError?: () => void;
}

export const OptimizedImage = ({
  src,
  alt,
  className = '',
  placeholderClassName = '',
  fallbackIcon,
  onLoad,
  onError,
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer para lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '100px', // Cargar 100px antes de que sea visible
        threshold: 0.1,
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  // Si hay error, mostrar fallback
  if (hasError) {
    return (
      <div 
        ref={containerRef}
        className={`flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 ${placeholderClassName || className}`}
      >
        {fallbackIcon || (
          <svg 
            className="fluid-icon-xl text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            />
          </svg>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${placeholderClassName || className}`}>
      {/* Placeholder con shimmer mientras carga */}
      {!isLoaded && (
        <div className={`absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-shimmer ${placeholderClassName || className}`}>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="fluid-icon-lg border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        </div>
      )}
      
      {/* Imagen real - solo se carga cuando está en viewport */}
      {isInView && (
        <img
          ref={imgRef}
          src={src}
          alt={alt}
          className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
          onLoad={handleLoad}
          onError={handleError}
          decoding="async"
        />
      )}
    </div>
  );
};

/**
 * Hook para precargar imágenes
 */
export const useImagePreloader = (urls: string[]) => {
  const [loadedCount, setLoadedCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (urls.length === 0) {
      setIsComplete(true);
      return;
    }

    let count = 0;
    urls.forEach((url) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        count++;
        setLoadedCount(count);
        if (count === urls.length) {
          setIsComplete(true);
        }
      };
      img.src = url;
    });
  }, [urls]);

  return {
    loadedCount,
    totalCount: urls.length,
    isComplete,
    progress: urls.length > 0 ? (loadedCount / urls.length) * 100 : 100,
  };
};

export default OptimizedImage;
