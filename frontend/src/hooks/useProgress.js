import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createSession, getStudentProgress } from '../api/progress';
import { getHomeworkCriteria, getClassEnrollments } from '../api/classes';
import { getClassAttendance } from '../api/attendance';

export function useStudentProgress(userId, params = {}) {
  return useQuery({
    queryKey:  ['student-progress', userId, params.class_id, params.from, params.to, params.include],
    queryFn:   () => getStudentProgress(userId, params),
    staleTime: 60_000,
    enabled:   !!userId,
  });
}

export function useHomeworkCriteria(classId) {
  return useQuery({
    queryKey:  ['homework-criteria', classId],
    queryFn:   () => getHomeworkCriteria(classId),
    staleTime: 5 * 60_000,
    enabled:   !!classId,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createSession,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['student-progress', variables.student_user_id] });
      qc.invalidateQueries({ queryKey: ['class-enrollments', variables.class_id] });
    },
  });
}

export function useClassProgress(classId, dateRange = {}) {
  return useQuery({
    queryKey:  ['class-progress', classId, dateRange.from, dateRange.to],
    queryFn:   () => getClassAttendance(classId, dateRange), // reuse attendance endpoint for overview
    staleTime: 60_000,
    enabled:   !!classId,
  });
}

export function useClassEnrollments(classId) {
  return useQuery({
    queryKey:  ['class-enrollments', classId, 'active'],
    queryFn:   () => getClassEnrollments(classId, { status: 'active' }),
    staleTime: 2 * 60_000,
    enabled:   !!classId,
  });
}
