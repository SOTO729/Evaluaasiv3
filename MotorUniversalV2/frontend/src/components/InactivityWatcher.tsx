import { ReactNode } from 'react';
import { useInactivityLogout } from '../hooks/useInactivityLogout';

interface InactivityWatcherProps {
  children: ReactNode;
  timeoutMinutes?: number;
}

/**
 * Componente que monitorea la inactividad del usuario
 * y cierra sesión automáticamente para usuarios candidatos
 */
export const InactivityWatcher = ({ 
  children, 
  timeoutMinutes = 15 
}: InactivityWatcherProps) => {
  // Hook que maneja toda la lógica de inactividad
  useInactivityLogout({ 
    timeoutMinutes,
    enabled: true 
  });
  
  return <>{children}</>;
};

export default InactivityWatcher;
