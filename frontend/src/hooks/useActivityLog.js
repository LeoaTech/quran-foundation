import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCenterActivity } from '../api/activityLog';

const PAGE_SIZE = 20;

/**
 * React Query hook for the center activity log.
 * Supports load-more pagination and action filter.
 * Auto-refreshes every 30 seconds while the component is mounted.
 *
 * @param {string} centerId
 * @param {{ action?: string }} opts
 */
export function useActivityLog(centerId, { action } = {}) {
  const [offset, setOffset]   = useState(0);
  const [allData, setAllData] = useState([]);

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey:        ['center-activity', centerId, action, offset],
    queryFn:         () => getCenterActivity(centerId, { limit: PAGE_SIZE, offset, action: action || undefined }),
    staleTime:       0,
    refetchInterval: 30_000, // auto-refresh every 30 s while tab is open
    enabled:         !!centerId,
    placeholderData: (prev) => prev, // keep previous data visible while fetching
  });

  // React Query v5 removed onSuccess from useQuery — use useEffect instead
  useEffect(() => {
    if (!data) return;
    if (offset === 0) {
      setAllData(data.data ?? []);
    } else {
      setAllData((prev) => {
        // De-dupe by id in case of overlap
        const ids = new Set(prev.map((r) => r.id));
        const fresh = (data.data ?? []).filter((r) => !ids.has(r.id));
        return [...prev, ...fresh];
      });
    }
  }, [data, offset]);

  const total   = data?.meta?.total ?? 0;
  const hasMore = allData.length < total;

  const loadMore = useCallback(() => {
    setOffset((prev) => prev + PAGE_SIZE);
  }, []);

  // Reset pagination + data when filter changes
  const resetFilter = useCallback(() => {
    setOffset(0);
    setAllData([]);
  }, []);

  return {
    logs: allData,
    total,
    hasMore,
    isLoading,
    isFetching,
    error,
    loadMore,
    resetFilter,
  };
}
