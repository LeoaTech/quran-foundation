import { useQuery } from '@tanstack/react-query';
import { getOrgOverview, getCenterOverview, getStudentSummary, getHomeworkPerformance } from '../api/reports';

const STALE = 5 * 60_000;

export function useOrgReport() {
  return useQuery({
    queryKey:  ['report-org'],
    queryFn:   getOrgOverview,
    staleTime: STALE,
  });
}

export function useCenterReport(centerId, month) {
  return useQuery({
    queryKey:  ['report-center', centerId, month],
    queryFn:   () => getCenterOverview(centerId, month),
    staleTime: STALE,
    enabled:   !!centerId,
  });
}

export function useStudentReport(userId) {
  return useQuery({
    queryKey:  ['report-student', userId],
    queryFn:   () => getStudentSummary(userId),
    staleTime: STALE,
    enabled:   !!userId,
  });
}

export function useHomeworkReport(classId, dateRange = {}) {
  return useQuery({
    queryKey:  ['report-homework', classId, dateRange.from, dateRange.to],
    queryFn:   () => getHomeworkPerformance(classId, dateRange),
    staleTime: STALE,
    enabled:   !!classId,
  });
}
