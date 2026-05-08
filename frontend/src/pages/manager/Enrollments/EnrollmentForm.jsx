import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import { useToast } from '../../../hooks/useToast';
import { createEnrollment } from '../../../api/enrollments';
import { createUser } from '../../../api/users';
import { getCourses } from '../../../api/courses';
import { getClasses } from '../../../api/classes';

const PRIOR_LEVELS = [
  { value: 'beginner',     label: 'Beginner — ابتدائی' },
  { value: 'reader',       label: 'Can read with harakat — حرکات کے ساتھ پڑھ سکتا ہے' },
  { value: 'fluent',       label: 'Fluent reader — روانی سے پڑھتا ہے' },
  { value: 'partial_hifz', label: 'Partial hifz — جزوی حفظ' },
];

const GENDERS   = [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }];
const LANGUAGES = [{ value: 'ur', label: 'Urdu (اردو)' }, { value: 'en', label: 'English' }, { value: 'ar', label: 'Arabic (عربي)' }];

const EMPTY_STUDENT = {
  first_name: '', last_name: '', full_name_ur: '',
  date_of_birth: '', gender: 'male',
  guardian_name: '', guardian_phone: '', guardian_whatsapp: '',
  preferred_lang: 'ur',
};

const EMPTY_ENROLL = {
  course_id: '', class_id: '',
  enrolled_on: new Date().toISOString().slice(0, 10),
  prior_level: 'beginner', notes_ur: '',
};

function Field({ label, children, error }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
      {error && (
        <span style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{error}</span>
      )}
    </div>
  );
}

export default function EnrollmentForm() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const toast    = useToast();

  const centerId = user?.center_id;

  const [student,  setStudent]  = useState(EMPTY_STUDENT);
  const [enroll,   setEnroll]   = useState(EMPTY_ENROLL);
  const [busy,     setBusy]     = useState(false);
  const [fieldErr, setFieldErr] = useState({});
  const [done,     setDone]     = useState(null); // { studentId, studentName }

  const { data: coursesRaw = [] } = useQuery({
    queryKey: ['courses'],
    queryFn:  getCourses,
    staleTime: 5 * 60_000,
  });

  const { data: classesRaw = [] } = useQuery({
    queryKey:  ['classes', centerId, enroll.course_id],
    queryFn:   () => getClasses(centerId, { course_id: enroll.course_id, is_active: true }),
    staleTime: 60_000,
    enabled:   !!centerId && !!enroll.course_id,
  });

  const courses = coursesRaw?.data ?? coursesRaw ?? [];
  const classes = classesRaw?.data ?? classesRaw ?? [];

  // Reset class when course changes
  useEffect(() => {
    setEnroll((f) => ({ ...f, class_id: '' }));
  }, [enroll.course_id]);

  function setS(field) {
    return (e) => setStudent((f) => ({ ...f, [field]: e.target.value }));
  }
  function setE(field) {
    return (e) => {
      setEnroll((f) => ({ ...f, [field]: e.target.value }));
      setFieldErr((f) => ({ ...f, [field]: undefined }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldErr({});

    if (!enroll.class_id) {
      setFieldErr({ class_id: 'Select a class.' });
      return;
    }

    setBusy(true);
    try {
      // Step 1 — create the student user
      const full_name = `${student.first_name} ${student.last_name}`.trim();
      const newUser = await createUser({
        full_name,
        full_name_ur:   student.full_name_ur  || undefined,
        date_of_birth:  student.date_of_birth || undefined,
        gender:         student.gender,
        preferred_lang: student.preferred_lang,
        role:           'student',
        center_id:      centerId,
      });
      const studentId = newUser.id ?? newUser.data?.id;

      // Step 2 — enroll
      await createEnrollment({
        student_user_id: studentId,
        class_id:        enroll.class_id,
        center_id:       centerId,
        enrolled_on:     enroll.enrolled_on,
        prior_level:     enroll.prior_level || undefined,
        notes_ur:        enroll.notes_ur    || undefined,
      });

      toast.success('Student enrolled successfully.');
      setDone({ studentId, studentName: full_name });
    } catch (err) {
      const code = err.response?.data?.error?.code;
      if (code === 'ENROLLMENT_CONFLICT') {
        setFieldErr({ class_id: 'This student is already enrolled in this class. طالب علم پہلے سے اس کلاس میں داخل ہے' });
      } else if (code === 'CLASS_FULL') {
        setFieldErr({ class_id: 'This class is full. کلاس مکمل بھر گئی ہے' });
      } else {
        toast.error(err.response?.data?.error?.message ?? 'Failed to enroll student.');
      }
    } finally {
      setBusy(false);
    }
  }

  function handleEnrollAnother() {
    setStudent(EMPTY_STUDENT);
    setEnroll({ ...EMPTY_ENROLL, enrolled_on: new Date().toISOString().slice(0, 10) });
    setFieldErr({});
    setDone(null);
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (done) {
    return (
      <div style={{ maxWidth: 480, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink)', marginBottom: 8 }}>
          Enrolled successfully
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 28 }}>
          <strong>{done.studentName}</strong> has been enrolled.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button variant="outline" onClick={handleEnrollAnother}>Enroll another</Button>
          <Button variant="primary" onClick={() => navigate(`/students/${done.studentId}`)}>
            View student profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Enroll student
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Create a new student record and place them in a class.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Left: student details ── */}
          <Card>
            <CardHeader><span className="card-title">Student details</span></CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="First name">
                  <input className="f-input" value={student.first_name} onChange={setS('first_name')} placeholder="e.g. Hamza" required />
                </Field>
                <Field label="Last name">
                  <input className="f-input" value={student.last_name} onChange={setS('last_name')} placeholder="e.g. Rauf" required />
                </Field>
              </div>

              <Field label="Full name (Urdu) — اردو نام">
                <RTLInput placeholder="حمزہ رؤف" value={student.full_name_ur} onChange={setS('full_name_ur')} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Date of birth">
                  <input className="f-input" type="date" value={student.date_of_birth} onChange={setS('date_of_birth')} />
                </Field>
                <Field label="Gender">
                  <select className="f-select" value={student.gender} onChange={setS('gender')}>
                    {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Guardian name">
                <input className="f-input" value={student.guardian_name} onChange={setS('guardian_name')} placeholder="Parent or guardian" />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Guardian phone">
                  <input className="f-input" type="tel" value={student.guardian_phone} onChange={setS('guardian_phone')} placeholder="+92 3xx…" />
                </Field>
                <Field label="WhatsApp">
                  <input className="f-input" type="tel" value={student.guardian_whatsapp} onChange={setS('guardian_whatsapp')} placeholder="+92 3xx…" />
                </Field>
              </div>

              <Field label="Preferred language">
                <select className="f-select" value={student.preferred_lang} onChange={setS('preferred_lang')}>
                  {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </Field>
            </CardBody>
          </Card>

          {/* ── Right: course + prior knowledge ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <CardHeader><span className="card-title">Course & class</span></CardHeader>
              <CardBody>
                <Field label="Course">
                  <select className="f-select" value={enroll.course_id} onChange={setE('course_id')} required>
                    <option value="">— Select course —</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Class" error={fieldErr.class_id}>
                  <select
                    className="f-select"
                    value={enroll.class_id}
                    onChange={setE('class_id')}
                    disabled={!enroll.course_id}
                    required
                    style={fieldErr.class_id ? { borderColor: 'var(--red)' } : {}}
                  >
                    <option value="">— Select class —</option>
                    {classes.map((cls) => {
                      const enrolled = cls.enrolled_count ?? cls.student_count ?? 0;
                      const cap      = cls.max_capacity;
                      const isFull   = cap && enrolled >= cap;
                      const teacher  = cls.primary_teacher_name ? ` (${cls.primary_teacher_name})` : '';
                      const label    = `${cls.name}${teacher}${cap ? ` — ${enrolled}/${cap} students` : ''}${isFull ? ' — Full' : ''}`;
                      return (
                        <option key={cls.id} value={cls.id} disabled={isFull}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                </Field>

                <Field label="Enrollment date">
                  <input className="f-input" type="date" value={enroll.enrolled_on} onChange={setE('enrolled_on')} required />
                </Field>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><span className="card-title">Prior knowledge</span></CardHeader>
              <CardBody>
                <Field label="Level">
                  <select className="f-select" value={enroll.prior_level} onChange={setE('prior_level')}>
                    {PRIOR_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Notes (Urdu) — اردو نوٹس">
                  <RTLInput
                    multiline
                    rows={3}
                    placeholder="کوئی متعلقہ معلومات…"
                    value={enroll.notes_ur}
                    onChange={setE('notes_ur')}
                  />
                </Field>
              </CardBody>
            </Card>

            <Button type="submit" variant="primary" disabled={busy} style={{ width: '100%', padding: '13px' }}>
              {busy ? 'Enrolling…' : 'Enroll student'}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
