/**
 * Componente global de notificaciones Toast
 * Se renderiza en App.tsx para mostrar notificaciones desde cualquier parte
 */
import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { useNotificationStore, Notification, NotificationType } from '../../store/notificationStore';

const iconMap: Record<NotificationType, React.ElementType> = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const colorMap: Record<NotificationType, { bg: string; border: string; icon: string; title: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    icon: 'text-green-600',
    title: 'text-green-800',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    icon: 'text-red-600',
    title: 'text-red-800',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: 'text-amber-600',
    title: 'text-amber-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: 'text-blue-600',
    title: 'text-blue-800',
  },
  loading: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: 'text-gray-600',
    title: 'text-gray-800',
  },
};

function NotificationItem({ notification }: { notification: Notification }) {
  const { removeNotification } = useNotificationStore();
  const [isVisible, setIsVisible] = useState(false);
  
  const Icon = iconMap[notification.type];
  const colors = colorMap[notification.type];
  
  useEffect(() => {
    // Trigger animation
    const timeout = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timeout);
  }, []);
  
  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => removeNotification(notification.id), 300);
  };
  
  return (
    <div
      className={`
        transform transition-all duration-300 ease-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div
        className={`
          ${colors.bg} ${colors.border}
          border rounded-xl shadow-lg p-4 max-w-sm w-full
          flex items-start gap-3
        `}
      >
        <div className={`flex-shrink-0 ${colors.icon}`}>
          <Icon className={`h-5 w-5 ${notification.type === 'loading' ? 'animate-spin' : ''}`} />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${colors.title}`}>
            {notification.title}
          </p>
          {notification.message && (
            <p className="text-sm text-gray-600 mt-0.5">
              {notification.message}
            </p>
          )}
          {notification.progress !== undefined && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${notification.progress}%` }}
              />
            </div>
          )}
          {notification.action && (
            <button
              onClick={notification.action.onClick}
              className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {notification.action.label}
            </button>
          )}
        </div>
        
        {notification.dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 hover:bg-black/5 rounded-lg transition-colors"
          >
            <X className="h-4 w-4 text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function GlobalNotifications() {
  const { notifications } = useNotificationStore();
  
  if (notifications.length === 0) return null;
  
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  );
}
