import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getClassAttendance,
  getStudentAttendance,
  createAttendanceSession,
  updateRecord,
} from '../api/attendance';

export function useClassAttendance(classId, dateRange = {}) {
  return useQuery({
    queryKey:  ['class-attendance', classId, dateRange.from, dateRange.to],
    queryFn:   () => getClassAttendance(classId, dateRange),
    staleTime: 60_000,
    enabled:   !!classId,
  });
}

export function useStudentAttendance(userId, params = {}) {
  return useQuery({
    queryKey:  ['student-attendance', userId, params.class_id, params.from, params.to],
    queryFn:   () => getStudentAttendance(userId, params),
    staleTime: 60_000,
    enabled:   !!userId,
  });
}

export function useMarkAttendance(classId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => createAttendanceSession(classId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['class-attendance', classId] });
    },
  });
}

export function useCorrectRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, recordId, payload }) => updateRecord(sessionId, recordId, payload),
    onSuccess: (_data, { classId }) => {
      if (classId) {
        qc.invalidateQueries({ queryKey: ['class-attendance', classId] });
      }
    },
  });
}
