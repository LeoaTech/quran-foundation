import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import Can from '../../../components/Can';
import Badge from '../../../components/Badge';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../hooks/useToast';
import {
  getClass,
  updateClass,
  getClassTeachers,
  assignTeacher,
  removeTeacher,
  getHomeworkCriteria,
  createCriterion,
  updateCriterion,
  deactivateCriterion,
  getClassEnrollments,
  getClassSchedules,
  getClassSessionPlans,
} from '../../../api/classes';
import { getClassAttendance } from '../../../api/attendance';
import { getTopics } from '../../../api/courses';
import { getUsers } from '../../../api/users';
import { getCenterTeacherTopics, assignTeacherTopic, removeTeacherTopic, updateTeacherTopic } from '../../../api/teacherTopics';
import SessionAttendanceModal from '../../../components/SessionAttendanceModal';
import ClassSessionModal from '../../../components/ClassSessionModal';
import {
  resolveSchedules,
  projectClassSessions,
  countExpectedSessionsPerSlot,
  getScheduledSessionOptions,
  getSessionStatus,
  buildScheduleSummary,
  getDurationMonths,
  formatTimeShort,
  sessionPlanKey,
} from '../../../utils/classSessions';
import { useIsMobile } from '../../../hooks/useIsMobile';
import MarkHomeworkModal from './MarkHomeworkModal';

// We will build MyTopicsTab directly in this file or another file, omitting CenterLevelTopicAssignment.
const TYPE_CHIP = {
  hifz: { label: 'Hifz', cls: 'chip chip-green' },
  nazra: { label: 'Nazra', cls: 'chip chip-blue' },
  tajweed: { label: 'Tajweed', cls: 'chip chip-gold' },
  arabic: { label: 'Arabic', cls: 'chip chip-sand' },
};

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  let hours = parseInt(h, 10);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${m} ${suffix}`;
}
//  date normalization function 
function normalizeDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
}
// ── Tab bar ───────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex',
      overflowX: 'auto',
      whiteSpace: 'nowrap',
      borderBottom: '1.5px solid var(--sand-mid)',
      marginBottom: 24
    }}>      {tabs.map((t) => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        style={{
          padding: '10px 20px 12px',
          fontSize: 14, fontWeight: 500,
          color: active === t.id ? 'var(--emerald)' : 'var(--ink-pale)',
          borderBottom: active === t.id ? '2.5px solid var(--emerald)' : '2.5px solid transparent',
          marginBottom: -1.5,
          background: 'none', border: 'none',
          cursor: 'pointer',
          fontFamily: 'var(--font-body)',
          transition: 'color 0.2s',
        }}
      >
        {t.label}
      </button>
    ))}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 14 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

// ── Students tab ──────────────────────────────────────────────────────────────
function StudentsTab({ classId, cls, isMobile }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: enrollments = [], isLoading } = useQuery({
    queryKey: ['class-enrollments', classId],
    queryFn: () => getClassEnrollments(classId),
    staleTime: 60_000,
  });

  const rows = enrollments?.data ?? enrollments ?? [];

  const getInitials = (name) => {
    if (!name) return 'S';
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  };

  const filteredRows = rows.filter((row) => {
    const name = (row.full_name ?? row.student?.full_name ?? '').toLowerCase();
    const nameUr = (row.full_name_ur ?? row.student?.full_name_ur ?? '').toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || nameUr.includes(search.toLowerCase());

    const statusVal = (row.status ?? 'active').toLowerCase();
    let matchesStatus = true;
    if (statusFilter === 'active') {
      matchesStatus = statusVal === 'active';
    } else if (statusFilter === 'dropped_withdrawn') {
      matchesStatus = statusVal === 'withdrawn' || statusVal === 'dropped';
    }
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile && 'column', gap: isMobile && 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="f-input"
            placeholder="Search student…"
            style={{ width: 200, padding: '6px 10px', fontSize: 12 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="f-select"
            style={{ width: 150, padding: '6px 8px', fontSize: 12 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="dropped_withdrawn">Dropped/Withdrawn</option>
          </select>
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            const params = new URLSearchParams({ class_id: classId });
            if (cls?.course_id) params.set('course_id', cls.course_id);
            navigate(`/manager/enrollment?${params.toString()}`);
          }}
        >
          + Enroll Student
        </Button>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState icon="○" title="No enrolled students" description="No students matching criteria." />
      ) : (
        <div style={{ border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--white)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--sand-light)' }}>
                <th style={{ width: 45, padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}></th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Student</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Urdu Name</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Enrolled On</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Prior Level</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Fee Status</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Attendance</th>
                <th style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}>Status</th>
                <th style={{ width: 80, padding: '10px 14px 8px', borderBottom: '1px solid var(--sand-mid)' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((en, i) => {
                const isPaid = !en.course_fee || Number(en.total_paid) >= Number(en.course_fee);
                const attendancePercent = en.attendance_total > 0 ? Math.round((en.attendance_present / en.attendance_total) * 100) : null;
                const initials = getInitials(en.full_name);

                return (
                  <tr key={en.id} style={{ borderBottom: i < filteredRows.length - 1 ? '1px solid var(--sand)' : 'none' }}>
                    <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                      <div className="student-avatar" style={{
                        width: 28, height: 28, fontSize: 10, borderRadius: '50%',
                        background: 'var(--emerald-light)', color: 'var(--emerald)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600
                      }}>
                        {initials}
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                      {en.full_name ?? en.student?.full_name ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl', textAlign: 'right' }}>
                      {en.full_name_ur ?? en.student?.full_name_ur ?? ''}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)' }}>
                      {en.enrolled_on ? new Date(en.enrolled_on).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--ink-soft)' }}>
                      {en.prior_level ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={isPaid ? 'green' : 'yellow'}>{isPaid ? 'Paid' : 'Pending'}</Badge>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{
                        fontWeight: 600,
                        color: attendancePercent >= 80 ? 'var(--emerald)' : attendancePercent != null ? 'var(--red)' : 'var(--ink-pale)'
                      }}>
                        {attendancePercent != null ? `${attendancePercent}%` : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <Badge variant={en.status === 'active' ? 'green' : 'sand'}>{en.status ?? 'active'}</Badge>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/reports/students/${en.student_user_id}`)}>
                        View
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ── Teachers tab ──────────────────────────────────────────────────────────────
function TeachersTab({ classId, centerId, courseId }) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['teacher-topics', centerId],
    queryFn: () => getCenterTeacherTopics(centerId),
    enabled: !!centerId,
    staleTime: 60_000,
  });

  const topicTeachersFiltered = assignments.filter((a) => a.course_id === courseId);

  // Group assignments by teacher id
  const mergedTeachersMap = new Map();
  topicTeachersFiltered.forEach((at) => {
    const tid = at.teacher_user_id;
    if (!mergedTeachersMap.has(tid)) {
      mergedTeachersMap.set(tid, {
        id: tid,
        teacher_user_id: tid,
        full_name: at.teacher_name,
        full_name_ur: at.teacher_name_ur,
        topics: [],
      });
    }
    mergedTeachersMap.get(tid).topics.push(at);
  });

  const teacherList = Array.from(mergedTeachersMap.values());

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>;
  }

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Assigned Teachers</h3>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Teachers teaching topics for this cohort's course syllabus.
        </p>
      </div>

      {teacherList.length === 0 ? (
        <EmptyState icon="◉" title="No teachers assigned" description="Go to the Topic Assignment tab to assign teachers to topics." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {teacherList.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>
                  {(t.full_name ?? '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    {t.full_name ?? '—'}
                    {t.full_name_ur && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--ink-soft)', fontFamily: 'var(--font-display)', direction: 'rtl' }}>({t.full_name_ur})</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 2 }}>
                    Assigned Topics:
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {t.topics.map((at) => (
                      <span key={at.id} className="chip chip-green" style={{ fontSize: 10, padding: '2px 8px', borderRadius: 'var(--radius-sm)' }}>
                        {at.topic_title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}



// ── Homework Criteria tab ─────────────────────────────────────────────────────
// Moved this Part into ClassSessionHomeWork/HomeWorkCriteriaTab.jsx

// ── Class Tab (Schedules & Projected Sessions) ──────────────────────────────────

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function ClassSchedulesTab({ cls, classId, myTopics }) {
  const { role } = useAuth();
  // Teachers assigned to this class should be able to mark attendance and set topics
  // only if the session topic matches one of their assigned topics.
  const canEditBase = true;

  const [showAddClass, setShowAddClass] = useState(false);
  const [addClassKey, setAddClassKey] = useState('');
  const [slotFilter, setSlotFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [attendanceModal, setAttendanceModal] = useState(null);
  const [sessionModal, setSessionModal] = useState(null);

  const { data: schedulesRaw = [], isLoading: schedLoading } = useQuery({
    queryKey: ['class-schedules', classId],
    queryFn: () => getClassSchedules(classId),
    staleTime: 60_000,
  });
  const apiSchedules = schedulesRaw?.data ?? schedulesRaw ?? [];
  const schedules = resolveSchedules(apiSchedules, cls);

  const { data: plansRaw = [], isLoading: plansLoading } = useQuery({
    queryKey: ['class-session-plans', classId],
    queryFn: () => getClassSessionPlans(classId),
    staleTime: 30_000,
  });
  const sessionPlans = plansRaw?.data ?? plansRaw ?? [];

  const { data: enrollmentsRaw = [] } = useQuery({
    queryKey: ['class-enrollments', classId, 'active'],
    queryFn: () => getClassEnrollments(classId, { status: 'active' }),
    staleTime: 60_000,
  });
  const enrolledCount = (enrollmentsRaw?.data ?? enrollmentsRaw ?? []).length;

  const { data: sessionsRaw = [], isLoading: sessionsLoading } = useQuery({
    queryKey: ['class-attendance', classId],
    queryFn: () => getClassAttendance(classId),
    staleTime: 30_000,
  });
  const sessions = sessionsRaw?.data ?? sessionsRaw ?? [];

  const { data: topicsData = [] } = useQuery({
    queryKey: ['topics', cls?.course_id],
    queryFn: () => getTopics(cls?.course_id),
    staleTime: 5 * 60_000,
    enabled: !!cls?.course_id,
  });
  const topics = topicsData?.data ?? topicsData ?? [];

  const durationMonths = getDurationMonths(cls);
  const expectedPerSlotMap = countExpectedSessionsPerSlot(cls, schedules);
  const projectedSessions = projectClassSessions(cls, schedules);
  const scheduledDateOptions = getScheduledSessionOptions(cls, schedules);
  const scheduleSummary = buildScheduleSummary(schedules, cls);
  const todayStr = new Date().toISOString().split('T')[0];


  const plansMap = new Map();
  sessionPlans.forEach((p) => {
    plansMap.set(sessionPlanKey(normalizeDate(p.session_date), p.schedule_id), p);
  });


  const validSessions = sessions.filter((s) => {
    if (!s.session_date) return false;
    const norm = normalizeDate(s.session_date);
    return norm && norm !== 'Invalid Date' && norm !== 'null' && norm !== 'undefined';
  });
  const actualSessionsMap = new Map();
  validSessions.forEach((s) => {
    actualSessionsMap.set(normalizeDate(s.session_date), s);
  });

  const combined = [];
  const matchedDates = new Set();

  projectedSessions.forEach((proj) => {
    const projDateNorm = normalizeDate(proj.date);
    const actual = actualSessionsMap.get(projDateNorm);
    if (actual) matchedDates.add(projDateNorm);
    const plan = plansMap.get(sessionPlanKey(projDateNorm, proj.schedule_id))
      || plansMap.get(sessionPlanKey(projDateNorm, null));
    const topicFromPlan = plan?.topic_title || plan?.syllabus_topic_title || null;
    const topicFromActual = actual?.topic_title || null;

    combined.push({
      ...proj,
      session_id: actual?.session_id || null,
      marked_at: actual?.marked_at || null,
      cnt_present: actual?.cnt_present || 0,
      cnt_absent: actual?.cnt_absent || 0,
      cnt_late: actual?.cnt_late || 0,
      cnt_total: actual?.cnt_total || 0,
      actual_topic_title: topicFromActual,
      date: projDateNorm,
      plan_topic_id: plan?.topic_id || null,
      plan_topic_title: topicFromPlan,
      plan_topic_title_ur: plan?.topic_title_ur || plan?.syllabus_topic_title_ur || null,
      display_topic_title: topicFromPlan || topicFromActual || null,
      is_projected: true,
    });
  });

  validSessions.forEach((act) => {
    const actDateNorm = normalizeDate(act.session_date);
    if (!matchedDates.has(actDateNorm)) {
      combined.push({
        date: actDateNorm,
        day_of_week: new Date(actDateNorm + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
        schedule_id: null,
        start_time: null,
        end_time: null,
        session_id: act.session_id,
        marked_at: act.marked_at,
        cnt_present: act.cnt_present,
        cnt_absent: act.cnt_absent,
        cnt_late: act.cnt_late,
        cnt_total: act.cnt_total,
        actual_topic_title: act.topic_title,
        plan_topic_id: null,
        plan_topic_title: null,
        plan_topic_title_ur: null,
        display_topic_title: act.topic_title || null,
        is_projected: false,
      });
    }
  });

  combined.sort((a, b) => a.date.localeCompare(b.date) || (a.start_time || '').localeCompare(b.start_time || ''));

  const sessionsWithMeta = combined.map((sess, idx) => ({
    ...sess,
    session_number: idx + 1,
    status: getSessionStatus(sess, todayStr),
  }));

  const slotDayOptions = [...new Set(schedules.map((s) => s.day_of_week))].sort(
    (a, b) => DAYS_ORDER.indexOf(a) - DAYS_ORDER.indexOf(b),
  );

  const filteredSessions = sessionsWithMeta.filter((sess) => {
    if (slotFilter !== 'all' && sess.day_of_week !== slotFilter) return false;
    if (statusFilter !== 'all' && sess.status !== statusFilter) return false;
    return true;
  });

  const completedPerSlot = {};
  sessionsWithMeta.forEach((s) => {
    if (s.schedule_id && s.status === 'completed') {
      completedPerSlot[s.schedule_id] = (completedPerSlot[s.schedule_id] || 0) + 1;
    }
  });


  function openAttendanceModal(sess, mode) {
    let resolvedDate = sess.date || sess.session_date || '';
    if (!resolvedDate && sess.key) {
      // Handles keys formatted as 'YYYY-MM-DD_scheduleId'
      const parts = sess.key.split('_');
      if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
        resolvedDate = parts[0];
      } else {
        resolvedDate = sess.key;
      }
    }

    if (!resolvedDate || resolvedDate === 'Invalid Date') {
      resolvedDate = todayStr;
    }

    setAttendanceModal({
      sessionId: sess.session_id,
      scheduleId: sess.schedule_id,
      date: resolvedDate,
      dayOfWeek: sess.day_of_week || new Date(resolvedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
      startTime: sess.start_time,
      endTime: sess.end_time,
      mode,
    });
  }

  function handleAddClass(e) {
    e.preventDefault();
    const option = scheduledDateOptions.find((o) => o.key === addClassKey);
    if (!option) {
      toast.error('Please select a class date.');
      return;
    }
    setShowAddClass(false);
    openAttendanceModal(option, 'mark');
    setAddClassKey('');
  }

  function fmtDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  const sortedSchedules = [...schedules].sort(
    (a, b) => DAYS_ORDER.indexOf(a.day_of_week) - DAYS_ORDER.indexOf(b.day_of_week),
  );

  const SLOT_CHIP = {
    Monday: 'chip chip-blue',
    Tuesday: 'chip chip-gold',
    Wednesday: 'chip chip-green',
    Thursday: 'chip chip-sand',
    Friday: 'chip chip-blue',
    Saturday: 'chip chip-gold',
    Sunday: 'chip chip-sand',
  };

  const isLoading = schedLoading || sessionsLoading || plansLoading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>


      {/* ── Schedule slot summary ── */}
      {sortedSchedules.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {sortedSchedules.map((s, idx) => (
            <div
              key={s.id}
              style={{
                background: 'var(--white)',
                border: '1.5px solid var(--sand-mid)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-pale)' }}>
                Slot {String.fromCharCode(65 + idx)} — {s.day_of_week}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 4 }}>
                {formatTime(s.start_time)}{s.end_time ? ` – ${formatTime(s.end_time)}` : ''}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 6 }}>
                {expectedPerSlotMap[s.id] ?? 0} expected · {completedPerSlot[s.id] ?? 0} completed
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── All expected sessions table ── */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--ink)' }}>All Expected Classes</div>
            <div style={{ fontSize: 12, color: 'var(--ink-pale)', marginTop: 2 }}>
              {sessionsWithMeta.length} sessions in the current course period · {enrolledCount} students enrolled
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="f-select"
              style={{ width: 130, padding: '5px 8px', fontSize: 12 }}
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
            >
              <option value="all">All Slots</option>
              {slotDayOptions.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              className="f-select"
              style={{ width: 140, padding: '5px 8px', fontSize: 12 }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="scheduled">Scheduled</option>
              <option value="upcoming">Upcoming</option>
            </select>
            {/* {canEdit && projectedSessions.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowAddClass(true)}>+ Add Class</Button>
            )} */}
          </div>
        </div>

        {showAddClass && (
          <Card style={{ marginBottom: 16, border: '1.5px solid var(--emerald)', borderRadius: 'var(--radius-md)' }}>
            <CardHeader><span className="card-title">Create New Class</span></CardHeader>
            <CardBody>
              <form onSubmit={handleAddClass}>
                <div className="f-group" style={{ marginBottom: 16 }}>
                  <label className="f-label">Class Date & Time Slot</label>
                  <select className="f-select" required value={addClassKey} onChange={(e) => setAddClassKey(e.target.value)}>
                    <option value="">— Select a scheduled class date —</option>
                    {scheduledDateOptions.map((opt) => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <Button type="button" variant="outline" size="sm" onClick={() => { setShowAddClass(false); setAddClassKey(''); }}>Cancel</Button>
                  <Button type="submit" variant="primary" size="sm">Mark Attendance</Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><LoadingSpinner size={28} /></div>
        ) : schedules.length === 0 ? (
          <EmptyState icon="🗓" title="No schedule configured" description="Set schedule days and start time in Edit Classroom, then sessions will appear here." />
        ) : projectedSessions.length === 0 ? (
          <EmptyState icon="📋" title="No sessions to show" description="Check that the classroom has a start date and course duration configured." />
        ) : filteredSessions.length === 0 ? (
          <EmptyState icon="📋" title="No sessions match filters" description="Try changing the slot or status filter above." />
        ) : (
          <div style={{ background: 'var(--white)', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)', overflow: 'auto', boxShadow: 'var(--shadow-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ background: 'var(--sand-light)' }}>
                  {['#', 'Date', 'Slot', 'Topic Name', 'Attendance', 'Status', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--ink-pale)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '12px 14px 10px', borderBottom: '1px solid var(--sand-mid)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((sess, i) => {
                  const isLast = i === filteredSessions.length - 1;
                  const total = sess.cnt_total ?? 0;
                  const present = sess.cnt_present ?? 0;
                  const hasAttendance = total > 0;
                  const isUpcoming = sess.status === 'upcoming';
                  const chipCls = SLOT_CHIP[sess.day_of_week] ?? 'chip chip-sand';
                  const attendanceText = hasAttendance
                    ? `${present}/${total}`
                    : `—/${enrolledCount}`;

                  const isToday = sess.date === todayStr;
                  const isMyTopic = !sess.plan_topic_id || myTopics.some(t => t.topic_id === sess.plan_topic_id);
                  const canEditSession = canEditBase && isMyTopic;
                  
                  // If we only want to show the teacher's own topics
                  if (!isMyTopic) return null;

                  return (
                    <tr
                      key={`${sess.date}-${sess.schedule_id}-${i}`}
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--sand)',
                      }}
                    >
                      <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--ink-pale)', fontWeight: 600 }}>
                        {sess.session_number}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                        {fmtDate(sess.date)}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, whiteSpace: 'nowrap' }}>
                        <span className={chipCls} style={{ fontSize: 11 }}>{sess.day_of_week}</span>
                        {sess.start_time && (
                          <div style={{ fontSize: 11, color: 'var(--ink-pale)', marginTop: 4 }}>
                            {formatTimeShort(sess.start_time)}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--ink-mid)', minWidth: 160 }}>
                        {sess.display_topic_title ? (
                          <span style={{ fontWeight: 500, color: 'var(--emerald)' }}>{sess.display_topic_title}</span>
                        ) : (
                          <span style={{ color: 'var(--ink-pale)', fontStyle: 'italic' }}>
                            {canEditSession && !isUpcoming ? 'Center Manager will set topic' : '—'}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', color: hasAttendance ? 'var(--emerald)' : 'var(--ink-pale)' }}>
                        {attendanceText}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {hasAttendance ? (
                          <Badge variant="green">Completed</Badge>
                        ) : isUpcoming ? (
                          <Badge variant="sand">Upcoming</Badge>
                        ) : (
                          <Badge variant="gold">Scheduled</Badge>
                        )}
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        {isUpcoming ? null : hasAttendance ? (
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="outline" onClick={() => openAttendanceModal(sess, 'view')}>View</Button>
                            {canEditSession && (
                              <Button size="sm" variant="primary" onClick={() => openAttendanceModal(sess, 'mark')}>Edit</Button>
                            )}
                          </div>
                        ) : canEditSession && (isToday || !isUpcoming) ? (
                          <Button size="sm" variant="primary" onClick={() => openAttendanceModal(sess, 'mark')}>Mark</Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ClassSessionModal
        open={!!sessionModal}
        onClose={() => setSessionModal(null)}
        classId={classId}
        session={sessionModal}
        topics={topics}
        canEdit={canEditBase}
        enrolledCount={enrolledCount}
        onMarkAttendance={(sess) => openAttendanceModal(sess, 'mark')}
        onViewAttendance={(sess) => openAttendanceModal(sess, 'view')}
      />

      <SessionAttendanceModal
        open={!!attendanceModal}
        onClose={() => setAttendanceModal(null)}
        classId={classId}
        attendanceSessionId={attendanceModal?.sessionId}
        sessionId={attendanceModal?.sessionId}
        scheduleId={attendanceModal?.scheduleId}
        sessionDate={attendanceModal?.date}
        dayOfWeek={attendanceModal?.dayOfWeek}
        startTime={attendanceModal?.startTime}
        endTime={attendanceModal?.endTime}
        mode={attendanceModal?.mode ?? 'view'}
      />
    </div>
  );
}

// ── My Topics tab ─────────────────────────────────────────────────────────────
function MyTopicsTab({ cls, classId, myTopics, isLoading }) {
  const [hwModalOpen, setHwModalOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState(null);

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><LoadingSpinner size={32} /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ borderRadius: 'var(--radius-md)', padding: '11px 16px', fontSize: 13, lineHeight: 1.6, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--amber-light, #fef3c7)', border: '1px solid #fcd34d', color: 'var(--amber-d, #92400e)' }}>
        <span>📌</span>
        <div>Topics shown here are assigned to you by the Center Manager. <strong>Homework marking is your responsibility</strong> — after completing a topic across its sessions, mark homework for all students using the cumulative criteria sheet.</div>
      </div>

      {myTopics.length === 0 ? (
        <EmptyState icon="📚" title="No topics assigned" description="You have not been assigned any topics for this class." />
      ) : (
        myTopics.map((assignment, idx) => (
          <div key={assignment.id} style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '18px 20px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-l, #ecfdf5)', color: 'var(--primary-h, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>{idx + 1}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{assignment.topic_title || 'Unknown Topic'}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span>📅 Class: {cls.name}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
              <Button size="sm" variant="outline" onClick={() => { setSelectedTopic(assignment); setHwModalOpen(true); }}>Mark Homework</Button>
            </div>
          </div>
        ))
      )}

      <MarkHomeworkModal
        open={hwModalOpen}
        onClose={() => { setHwModalOpen(false); setSelectedTopic(null); }}
        classId={classId}
        topic={selectedTopic}
      />
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'schedules', label: 'Sessions' },
  { id: 'my-topics', label: 'My Topics' },
  { id: 'students', label: 'Students' },
];

export default function TeacherClassDetail() {
  const { user } = useAuth();
  const { id: classId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState('schedules');
  const isMobile = useIsMobile();
  const { data: cls, isLoading, error } = useQuery({
    queryKey: ['class', classId],
    queryFn: () => getClass(classId),
    staleTime: 2 * 60_000,
  });

  const centerId = user?.center_id;
  const { data: assignmentsRaw = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['teacher-topics', centerId],
    queryFn: () => getCenterTeacherTopics(centerId),
    staleTime: 60_000,
    enabled: !!centerId,
  });
  const assignments = assignmentsRaw?.data ?? assignmentsRaw ?? [];
  const myTopics = assignments.filter(a => String(a.teacher_user_id) === String(user.id));

  const courseType = cls?.course_type ?? cls?.course?.type;
  const chip = courseType ? (TYPE_CHIP[courseType] ?? { label: courseType, cls: 'chip chip-sand' }) : null;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Class not found.
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <button
          onClick={() => navigate('/teacher/classes')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 13, padding: 0, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}
        >
          ← My Classrooms
        </button>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2 }}>
                {cls.name}
              </h2>
              {chip && <span className={chip.cls}>{chip.label}</span>}
              {!cls.is_active && <span className="chip chip-red" style={{ fontSize: 10 }}>Inactive</span>}
            </div>
            {cls.name_ur && (
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--ink-soft)', direction: 'rtl', marginBottom: 4 }}>
                {cls.name_ur}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--ink-pale)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Array.isArray(cls.schedules) && cls.schedules.length > 0 ? (
                cls.schedules.map((s, idx) => (
                  <span key={s.id || idx} style={{ background: 'var(--sand-mid)', padding: '2px 8px', borderRadius: 'var(--radius-sm)', fontSize: 11 }}>
                    {s.day_of_week} · {formatTime(s.start_time)}{s.end_time ? `–${formatTime(s.end_time)}` : ''}
                  </span>
                ))
              ) : cls.schedule_days ? (
                <span>{cls.schedule_days} · {formatTime(cls.start_time) || ''}</span>
              ) : null}
              {(cls.center_name ?? cls.center?.name) && (
                <span>{cls.center_name ?? cls.center?.name}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <TabBar tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'schedules' && <ClassSchedulesTab cls={cls} classId={classId} myTopics={myTopics} />}
      {tab === 'my-topics' && <MyTopicsTab cls={cls} classId={classId} myTopics={myTopics} isLoading={loadingTopics} />}
      {tab === 'students' && <StudentsTab classId={classId} cls={cls} isMobile={isMobile} />}
    </>
  );
}
