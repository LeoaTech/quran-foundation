import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../../components/Card';
import Button from '../../../../components/Button';
import Can from '../../../../components/Can';
import Badge from '../../../../components/Badge';
import RTLInput from '../../../../components/RTLInput';
import LoadingSpinner from '../../../../components/LoadingSpinner';
import EmptyState from '../../../../components/EmptyState';
import { useToast } from '../../../../hooks/useToast';
import { useAuth } from '../../../../hooks/useAuth';

import { getTopics } from '../../../../api/courses'; // Assuming standard topic endpoints
import { getCenterTeacherTopics, assignTeacherTopic, removeTeacherTopic, updateTeacherTopic } from '../../../../api/teacherTopics';
import { getUsers } from '../../../../api/users'; // Assuming standard user endpoint

export default function TopicAssignmentTab({ cls }) {
  const centerId = cls.center_id;
  const courseId = cls.course_id;
  const qc = useQueryClient();
  const toast = useToast();
  const { role } = useAuth();
  const canEdit = role === 'super_admin' || role === 'center_manager';

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ teacher_user_id: '', topic_id: '' });
  const [busy, setBusy] = useState(false);

  // Fetch assignments
  const { data: assignments = [], isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-topics', centerId],
    queryFn: () => getCenterTeacherTopics(centerId),
    enabled: !!centerId,
  });

  // Filter assignments for this course
  const classAssignments = assignments.filter((a) => a.course_id === courseId);

  // Fetch teachers
  const { data: teachersData, isLoading: teachersLoading } = useQuery({
    queryKey: ['center-teachers', centerId],
    queryFn: () => getUsers({ center_id: centerId, role: 'teacher', per_page: 200 }),
    enabled: !!centerId,
  });
  const teachers = teachersData?.data ?? [];

  // Fetch topics
  const { data: topicsData, isLoading: topicsLoading } = useQuery({
    queryKey: ['topics', courseId],
    queryFn: () => getTopics(courseId),
    enabled: !!courseId,
  });
  const topics = topicsData?.data ?? topicsData ?? [];

  // Launches the assign form with the selected topic preloaded and locked
  function handleAssignClick(topicId) {
    setEditingId(null);
    setForm({
      topic_id: topicId,
      teacher_user_id: '',
    });
    setShowAdd(true);
  }

  function handleEdit(as) {
    setEditingId(as.id);
    setForm({
      teacher_user_id: as.teacher_user_id,
      topic_id: as.topic_id,
    });
    setShowAdd(true);
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!form.teacher_user_id || !form.topic_id) {
      toast.error('Please select a teacher.');
      return;
    }
    setBusy(true);
    try {
      if (editingId) {
        await updateTeacherTopic(centerId, editingId, {
          teacher_user_id: form.teacher_user_id,
          topic_id: form.topic_id,
        });
        toast.success('Topic assignment updated successfully.');
      } else {
        await assignTeacherTopic(centerId, {
          teacher_user_id: form.teacher_user_id,
          topic_id: form.topic_id,
        });
        toast.success('Topic assigned successfully.');
      }
      await qc.invalidateQueries({ queryKey: ['teacher-topics', centerId] });
      setForm({ teacher_user_id: '', topic_id: '' });
      setEditingId(null);
      setShowAdd(false);
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save topic assignment.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(assignmentId) {
    if (!window.confirm('Are you sure you want to remove this topic assignment?')) return;
    try {
      await removeTeacherTopic(centerId, assignmentId);
      await qc.invalidateQueries({ queryKey: ['teacher-topics', centerId] });
      toast.success('Assignment removed.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to remove assignment.');
    }
  }

  if (assignmentsLoading || teachersLoading || topicsLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      {showAdd && (
        <Card style={{ marginBottom: 20, border: '1.5px solid var(--primary)', borderRadius: 'var(--radius-md)' }}>
          <CardHeader>
            <span className="card-title">{editingId ? 'Change Assigned Teacher' : 'Assign Teacher to Topic'}</span>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleAssign}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px', marginBottom: 16 }}>
                
                {/* Topic selection is disabled so the user can only modify the teacher selection */}
                <div className="f-group">
                  <label className="f-label">Selected Topic</label>
                  <select
                    className="f-select"
                    value={form.topic_id}
                    disabled={true}
                    required
                    style={{ background: 'var(--sand-light)', color: 'var(--ink-pale)' }}
                  >
                    <option value="">-- No Topic Selected --</option>
                    {topics.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.display_order ? `${t.display_order}. ` : ''}{t.title} {t.title_ur ? `(${t.title_ur})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="f-group">
                  <label className="f-label">Select Teacher</label>
                  <select
                    className="f-select"
                    value={form.teacher_user_id}
                    onChange={(e) => setForm((f) => ({ ...f, teacher_user_id: e.target.value }))}
                    required
                  >
                    <option value="">-- Select Teacher --</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name} {t.full_name_ur ? `(${t.full_name_ur})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowAdd(false); setEditingId(null); setForm({ teacher_user_id: '', topic_id: '' }); }} disabled={busy}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" variant="primary" disabled={busy || !form.teacher_user_id || !form.topic_id}>
                  {busy ? 'Saving...' : (editingId ? 'Save Changes' : 'Confirm Assignment')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {topics.length === 0 ? (
        <EmptyState
          icon="📖"
          title="No topics found"
          description="There are no topics configured for this course level."
        />
      ) : (
        <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          {topics.map((t, i) => {
            const assignment = classAssignments.find((as) => as.topic_id === t.id);
            const isLast = i === topics.length - 1;

            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '11px 16px',
                  borderBottom: isLast ? 'none' : '1px solid var(--sand-mid)',
                }}
              >
                {/* Numeric Indicator Circular Badge */}
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    background: 'var(--emerald-light)',
                    color: 'var(--emerald)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {t.display_order || i + 1}
                </div>

                {/* Topic Titles Details */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                    {t.title}
                    {t.title_ur && (
                      <span
                        className="urdu"
                        style={{
                          fontSize: 12,
                          color: 'var(--ink-soft)',
                          marginLeft: 8,
                          display: 'inline-block',
                          fontFamily: 'var(--font-display)',
                        }}
                      >
                        ({t.title_ur})
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignment Status Actions & Badges */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {assignment ? (
                    <>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--emerald)' }}>
                        {assignment.teacher_name}
                      </span>
                      <Badge variant="green">Assigned</Badge>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Button size="xs" variant="outline" onClick={() => handleEdit(assignment)}>
                            Change
                          </Button>
                          <Button size="xs" variant="outline" onClick={() => handleRemove(assignment.id)} style={{ color: 'var(--red)' }}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Badge variant="sand">Unassigned</Badge>
                      {canEdit && (
                        <Button size="xs" variant="primary" onClick={() => handleAssignClick(t.id)}>
                          Assign Teacher
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}