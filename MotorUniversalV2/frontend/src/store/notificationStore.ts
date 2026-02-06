/**
 * Store global para notificaciones de la aplicación
 * Permite mostrar mensajes desde cualquier parte de la app
 */
import { create } from 'zustand';

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // en ms, 0 = no auto-dismiss
  dismissible?: boolean;
  progress?: number; // 0-100 para barras de progreso
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

let notificationId = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  
  addNotification: (notification) => {
    const id = `notification-${++notificationId}`;
    const newNotification: Notification = {
      id,
      dismissible: true,
      duration: notification.type === 'loading' ? 0 : 5000,
      ...notification,
    };
    
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));
    
    // Auto-dismiss después de duration (si no es 0)
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        get().removeNotification(id);
      }, newNotification.duration);
    }
    
    return id;
  },
  
  updateNotification: (id, updates) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, ...updates } : n
      ),
    }));
    
    // Si se actualiza a un tipo que no es loading y tiene duration, auto-dismiss
    const notification = get().notifications.find((n) => n.id === id);
    if (notification && updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? notification.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          get().removeNotification(id);
        }, duration);
      }
    }
  },
  
  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },
  
  clearAll: () => {
    set({ notifications: [] });
  },
}));

// Helper hooks para casos comunes
export const useNotify = () => {
  const store = useNotificationStore();
  
  return {
    success: (title: string, message?: string) =>
      store.addNotification({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      store.addNotification({ type: 'error', title, message, duration: 8000 }),
    warning: (title: string, message?: string) =>
      store.addNotification({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      store.addNotification({ type: 'info', title, message }),
    loading: (title: string, message?: string) =>
      store.addNotification({ type: 'loading', title, message, duration: 0, dismissible: false }),
    update: store.updateNotification,
    remove: store.removeNotification,
  };
};
