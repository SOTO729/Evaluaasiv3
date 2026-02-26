import { useQuery } from '@tanstack/react-query'
import { listSupportCampuses, SupportCampusesFilters } from '../../services/supportService'

export const useSupportCampuses = (filters?: SupportCampusesFilters) => {
  return useQuery({
    queryKey: ['support', 'campuses', filters?.state || 'all', filters?.activeOnly ?? true],
    queryFn: () => listSupportCampuses(filters),
    staleTime: 5 * 60 * 1000,
  })
}
