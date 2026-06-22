import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHomeworkCriteria, getClassEnrollments } from '../../../api/classes';
import Modal from '../../../components/Modal';
import Button from '../../../components/Button';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function MarkHomeworkModal({ open, onClose, classId, topic }) {
  const { data: criteriaRaw = [], isLoading: loadingCriteria } = useQuery({
    queryKey: ['homework-criteria', classId],
    queryFn: () => getHomeworkCriteria(classId),
    staleTime: 60_000,
    enabled: open && !!classId,
  });
  
  const { data: enrollmentsRaw = [], isLoading: loadingStudents } = useQuery({
    queryKey: ['class-enrollments', classId, 'active'],
    queryFn: () => getClassEnrollments(classId, { status: 'active' }),
    staleTime: 60_000,
    enabled: open && !!classId,
  });

  const criteria = criteriaRaw?.data ?? criteriaRaw ?? [];
  const students = (enrollmentsRaw?.data ?? enrollmentsRaw ?? []).map(e => e.student);

  const [marks, setMarks] = useState({});

  useEffect(() => {
    if (!open) setMarks({});
  }, [open]);

  const handleMarkChange = (studentId, criteriaId, value) => {
    setMarks(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [criteriaId]: value === '' ? '' : Number(value)
      }
    }));
  };

  const handleSave = () => {
    console.log('Submitting homework marks:', marks);
    alert('Homework marks saved successfully! (Backend integration pending)');
    onClose();
  };

  const isLoading = loadingCriteria || loadingStudents;

  return (
    <Modal open={open} onClose={onClose} size="lg" title="Mark Cumulative Homework">
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <LoadingSpinner size={32} />
        </div>
      ) : criteria.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
          No homework criteria defined for this class.
        </div>
      ) : students.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
          No active students enrolled in this class.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ background: 'var(--amber-light, #fef3c7)', padding: 16, borderRadius: 'var(--radius-md)', color: 'var(--amber-d)', fontSize: 13, border: '1px solid #fcd34d' }}>
            <strong>{topic?.topic_title || 'Current Topic'}</strong><br />
            Enter marks for each student. Ensure scores do not exceed the max marks for each criteria.
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', minWidth: 150 }}>Student</th>
                  {criteria.map(c => (
                    <th key={c.id} style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center' }}>
                      {c.label} <span style={{ display: 'block', color: 'var(--primary-h)', marginTop: 2 }}>/ {c.max_marks}</span>
                    </th>
                  ))}
                  <th style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center' }}>Total</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center' }}>%</th>
                  <th style={{ padding: '12px 14px', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => {
                  const studentMarks = marks[s.id] || {};
                  let total = 0;
                  let maxTotal = 0;
                  criteria.forEach(c => {
                    maxTotal += c.max_marks;
                    if (studentMarks[c.id]) total += studentMarks[c.id];
                  });
                  return (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500 }}>
                        {s.full_name}
                      </td>
                      {criteria.map(c => {
                        const val = studentMarks[c.id] ?? '';
                        const isOver = val > c.max_marks;
                        return (
                          <td key={c.id} style={{ padding: '12px 14px', textAlign: 'center' }}>
                            <input 
                              type="number"
                              min="0"
                              max={c.max_marks}
                              value={val}
                              onChange={(e) => handleMarkChange(s.id, c.id, e.target.value)}
                              style={{ 
                                width: 50, 
                                padding: '6px', 
                                textAlign: 'center', 
                                border: isOver ? '1.5px solid var(--red)' : '1px solid var(--border)', 
                                borderRadius: 'var(--radius-sm)',
                                background: isOver ? 'var(--red-light)' : '#fff'
                              }}
                            />
                          </td>
                        );
                      })}
                      <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center', fontWeight: 600, color: 'var(--primary-h)' }}>
                        {maxTotal > 0 ? `${total} / ${maxTotal}` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center', fontWeight: 600, color: 'var(--amber-d)' }}>
                        {maxTotal > 0 ? `${Math.round((total / maxTotal) * 100)}%` : '—'}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, textAlign: 'center' }}>
                        {total > 0 ? (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, background: 'var(--primary-l)', color: 'var(--primary-h)' }}>✓ Marked</span>
                        ) : (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 9999, fontWeight: 500, background: 'var(--bg-light)', color: 'var(--ink-pale)' }}>Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                Summary: <span style={{ color: 'var(--ink-pale)' }}>Fully marked:</span> <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{students.filter(s => {
                  const studentMarks = marks[s.id] || {};
                  let total = 0;
                  criteria.forEach(c => { if (studentMarks[c.id]) total += studentMarks[c.id]; });
                  return total > 0;
                }).length} / {students.length}</span> <span style={{ color: 'var(--sand)', margin: '0 8px' }}>|</span> 
                <span style={{ color: 'var(--ink-pale)' }}>Average score:</span> <span style={{ fontWeight: 600, color: 'var(--emerald)' }}>{(() => {
                  let overallTotal = 0;
                  let validCount = 0;
                  const maxTotal = criteria.reduce((sum, c) => sum + c.max_marks, 0);
                  students.forEach(s => {
                    const sm = marks[s.id] || {};
                    let t = 0;
                    criteria.forEach(c => { if (sm[c.id]) t += sm[c.id]; });
                    if (t > 0) { overallTotal += t; validCount++; }
                  });
                  return validCount > 0 && maxTotal > 0 ? `${Math.round((overallTotal / (validCount * maxTotal)) * 100)}%` : '0%';
                })()}</span> <span style={{ color: 'var(--sand)', margin: '0 8px' }}>|</span> 
                <span style={{ color: 'var(--ink-pale)' }}>Unmarked:</span> <span style={{ fontWeight: 600, color: 'var(--amber-d)' }}>{students.length - students.filter(s => {
                  const sm = marks[s.id] || {};
                  let t = 0;
                  criteria.forEach(c => { if (sm[c.id]) t += sm[c.id]; });
                  return t > 0;
                }).length}</span>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button variant="primary" onClick={handleSave}>Submit Marks</Button>
              </div>
            </div>
        </div>
      )}
    </Modal>
  );
}
