import { useLocation } from 'react-router-dom';

export function useGroupBasePath(groupId: string | undefined) {
  const { pathname } = useLocation();
  const isResponsable = pathname.startsWith('/mi-plantel');
  return {
    isResponsable,
    basePath: isResponsable ? `/mi-plantel/grupos/${groupId}` : `/partners/groups/${groupId}`,
  };
}
