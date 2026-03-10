import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function useGroupBasePath(groupId: string | undefined) {
  const { pathname } = useLocation();
  const { user } = useAuthStore();
  const isResponsable = pathname.startsWith('/mi-plantel');
  const canManage = !isResponsable || !!user?.can_manage_groups;
  const canViewReports = !isResponsable || !!user?.can_view_reports;
  return {
    isResponsable,
    canManage,
    canViewReports,
    basePath: isResponsable ? `/mi-plantel/grupos/${groupId}` : `/partners/groups/${groupId}`,
  };
}
