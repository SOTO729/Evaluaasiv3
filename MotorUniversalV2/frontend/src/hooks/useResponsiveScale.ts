import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para manejar el escalado responsivo de la aplicación
 * Escala la UI proporcionalmente basándose en el viewport
 */
export function useResponsiveScale() {
  // Dimensiones de referencia (diseño base)
  const BASE_WIDTH = 1920;
  const BASE_HEIGHT = 1080;
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.5;

  const calculateScale = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Calcular el scale basado en ambas dimensiones
    const scaleX = width / BASE_WIDTH;
    const scaleY = height / BASE_HEIGHT;
    
    // Usar el menor para mantener proporciones (fit)
    // O usar el promedio para balance
    let scale = Math.min(scaleX, scaleY);
    
    // Limitar el rango de escalado
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
    
    return {
      scale,
      width,
      height,
      isTV: width >= 1920 && height >= 1080,
      isUltrawide: width / height > 2,
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024 && width < 1920,
      isLargeScreen: width >= 1920,
    };
  }, []);

  const [dimensions, setDimensions] = useState(calculateScale);

  useEffect(() => {
    const handleResize = () => {
      setDimensions(calculateScale());
    };

    // Escuchar cambios de tamaño
    window.addEventListener('resize', handleResize);
    
    // También escuchar orientación en dispositivos móviles
    window.addEventListener('orientationchange', handleResize);
    
    // Calcular al montar
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [calculateScale]);

  return dimensions;
}

/**
 * Hook para obtener clases CSS dinámicas basadas en el tamaño de pantalla
 */
export function useResponsiveClasses() {
  const { isTV, isLargeScreen, isMobile, isTablet } = useResponsiveScale();
  
  return {
    // Tamaños de texto escalados
    textBase: isTV ? 'text-lg' : isLargeScreen ? 'text-base' : 'text-sm',
    textLg: isTV ? 'text-xl' : isLargeScreen ? 'text-lg' : 'text-base',
    textXl: isTV ? 'text-2xl' : isLargeScreen ? 'text-xl' : 'text-lg',
    text2xl: isTV ? 'text-3xl' : isLargeScreen ? 'text-2xl' : 'text-xl',
    
    // Espaciado escalado
    padding: isTV ? 'p-8' : isLargeScreen ? 'p-6' : isMobile ? 'p-3' : 'p-4',
    gap: isTV ? 'gap-6' : isLargeScreen ? 'gap-4' : 'gap-3',
    
    // Indicador de tipo de dispositivo
    deviceType: isTV ? 'tv' : isLargeScreen ? 'large' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
  };
}
