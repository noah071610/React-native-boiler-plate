import { useQuery } from '@tanstack/react-query';

import { api } from '@/services/api/client';

/**
 * Reference query hook — one file per resource under hooks/queries/.
 * Lightweight backend reachability check.
 */
export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.healthz.$get();
      return res.json();
    },
  });
}
