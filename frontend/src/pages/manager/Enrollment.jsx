import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { useToast } from '../../hooks/useToast';
import { getStudents } from '../../api/users';
import { getCourses, getCourseFees } from '../../api/courses';
import { getClasses } from '../../api/classes';
import { enrollNewStudent, enrollExistingStudent } from '../../api/enrollments';
import { formatClassroomWithSchedules } from '../../utils/classSessions';

export default function Enrollment() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pre-fill from query params when navigating from ClassDetail
  const presetClassId = searchParams.get('class_id') ?? '';
  const presetCourseId = searchParams.get('course_id') ?? '';

  const [activeTab, setActiveTab] = useState('existing'); // 'existing' | 'new'

  // Form State
  const [studentId, setStudentId] = useState('');
  const [fullName, setFullName] = useState('');
  const [fullNameUr, setFullNameUr] = useState('');
  const [phone, setPhone] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [qualification, setQualification] = useState('');
  const [occupation, setOccupation] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [isRepeater, setIsRepeater] = useState(false);
  const [address, setAddress] = useState('');
  const [centerManagerName, setCenterManagerName] = useState(user?.full_name || '');
  const [centerManagerContact, setCenterManagerContact] = useState(user?.phone || '');

  const [isMinor, setIsMinor] = useState(false);
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRelation, setGuardianRelation] = useState('');

  const [courseId, setCourseId] = useState(presetCourseId);
  const [classId, setClassId] = useState(presetClassId);
  const [enrollDate, setEnrollDate] = useState(new Date().toISOString().split('T')[0]);
  const [priorLevel, setPriorLevel] = useState('');
  const [notesUr, setNotesUr] = useState('');
  const [cashReceived, setCashReceived] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Data Fetching
  const { data: studentsData } = useQuery({
    queryKey: ['students'],
    queryFn: () => getStudents({ role: 'student' }),
    staleTime: 60_000,
  });
  const students = studentsData?.data ?? studentsData ?? [];

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: getCourses,
    staleTime: 60_000,
  });
  const courses = coursesData ?? [];

  const { data: classesData, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', user?.center_id],
    queryFn: () => getClasses(user?.center_id),
    enabled: !!user?.center_id,
    staleTime: 60_000,
  });
  const centerClasses = classesData?.data ?? classesData ?? [];
  // When a class is pre-selected (from ClassDetail), show all active classes so it's
  // visible in the dropdown. Otherwise filter by the chosen course as normal.
  const filteredClasses = courseId
    ? centerClasses.filter((c) => c.course_id === courseId && c.is_active)
    : centerClasses.filter((c) => c.is_active);
  const { data: feesData } = useQuery({
    queryKey: ['fees', courseId],
    queryFn: () => getCourseFees(courseId),
    enabled: !!courseId,
    staleTime: 60_000,
  });
  const courseFees = feesData ?? [];

  const selectedClass = filteredClasses?.find(c => c?.id === classId);
  const selectedFee = coursesData?.find(f => f?.id === selectedClass?.course_id);
  // Auto-select course when arriving with only class_id preset
  useEffect(() => {
    if (!presetClassId || courseId) return;
    const preset = centerClasses.find((c) => c.id === presetClassId);
    if (preset?.course_id) setCourseId(preset.course_id);
  }, [presetClassId, courseId, centerClasses]);

  // Reset minor-specific fields when toggling isMinor
  useEffect(() => {
    if (!isMinor) {
      setGuardianName('');
      setGuardianPhone('');
      setGuardianRelation('');
    } else {
      setPhone('');
    }
  }, [isMinor]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!classId) {
      setErrorMsg('Please select a classroom.');
      return;
    }

    if (selectedFee && Number(cashReceived) !== Number(selectedFee?.fee)) {
      setErrorMsg(`Full course level fee (PKR ${selectedFee?.fee}) must be received in cash before enrollment is confirmed.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (activeTab === 'existing') {
        if (!studentId) {
          setErrorMsg('Please select a student.');
          setIsSubmitting(false);
          return;
        }

        await enrollExistingStudent({
          student_user_id: studentId,
          class_id: classId,
          enrolled_on: enrollDate,
          prior_level: priorLevel || undefined,
          notes_ur: notesUr || undefined,
          amount_paid: cashReceived ? Number(cashReceived) : undefined,
          payment_method: 'cash',
        });

        toast.success('Student successfully enrolled!');

        // Reset specific form fields
        setStudentId('');
        setClassId('');
        setCourseId('');
        setCashReceived('');
        if (presetClassId && courseId) {
          navigate(-1)
        }

      } else {
        // ── Validation ──────────────────────────────────────────────────────
        if (!fullName) {
          setErrorMsg('Student name is required.');
          setIsSubmitting(false);
          return;
        }
        if (!isMinor && !phone) {
          setErrorMsg('Phone is required for adult students.');
          setIsSubmitting(false);
          return;
        }
        if (isMinor && !guardianPhone) {
          setErrorMsg('Guardian phone is required for minor students.');
          setIsSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('full_name', fullName);
        if (fullNameUr) formData.append('full_name_ur', fullNameUr);
        formData.append('is_minor', isMinor ? 'true' : 'false');

        if (isMinor) {
          // Minor student: no own phone — send guardian contact instead
          if (guardianName) formData.append('guardian_name', guardianName);
          formData.append('guardian_phone', guardianPhone);
          if (guardianRelation) formData.append('guardian_relation', guardianRelation);
        } else {
          // Adult student: own phone is their login identifier
          formData.append('phone', phone);
          // WhatsApp always mirrors phone
          formData.append('whatsapp', phone);
        }

        if (fatherName) formData.append('father_name', fatherName);
        if (dob) formData.append('date_of_birth', dob);
        if (gender) formData.append('gender', gender);
        formData.append('class_id', classId);
        if (enrollDate) formData.append('enrolled_on', enrollDate);
        if (priorLevel) formData.append('prior_level', priorLevel);
        if (notesUr) formData.append('notes_ur', notesUr);
        if (cashReceived) formData.append('amount_paid', Number(cashReceived));
        formData.append('payment_method', 'cash');

        if (profilePicture) formData.append('profile_picture', profilePicture);
        if (qualification) formData.append('qualification', qualification);
        if (occupation) formData.append('occupation', occupation);
        if (maritalStatus) formData.append('marital_status', maritalStatus);
        formData.append('is_repeater', isRepeater ? 'true' : 'false');
        if (address) formData.append('address', address);
        if (centerManagerName) formData.append('center_manager_name', centerManagerName);
        if (centerManagerContact) formData.append('center_manager_contact', centerManagerContact);

        const res = await enrollNewStudent(formData);

        toast.success(`${res.student.full_name} enrolled successfully!`);

        // Reset form fields
        setFullName('');
        setFullNameUr('');
        setFatherName('');
        setPhone('');
        setDob('');
        setGender('');
        setProfilePicture(null);
        setQualification('');
        setOccupation('');
        setMaritalStatus('');
        setIsRepeater(false);
        setAddress('');
        setCenterManagerName(user?.full_name || '');
        setCenterManagerContact(user?.phone || '');
        setIsMinor(false);
        setGuardianName('');
        setGuardianPhone('');
        setGuardianRelation('');
        setClassId(presetClassId);
        setCourseId(presetCourseId);
        setCashReceived('');
      }
    } catch (err) {
      if (err.response?.status === 409 && err.response?.data?.error?.code === 'USER_EXISTS') {
        setErrorMsg('A user with this phone number already exists. Please enroll them using the "Enroll Existing Student" tab.');
      } else {
        setErrorMsg(err.response?.data?.error?.message || 'Enrollment failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Enroll Student"
        subtitle="Enroll a new or existing student into a class"
      />

      {/* Back link when arriving from ClassDetail */}
      {presetClassId && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-pale)', fontSize: 13, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
          >
            ← Back to class
          </button>
          <div style={{ marginTop: 8, background: 'var(--emerald-pale)', border: '1px solid var(--emerald-light)', borderRadius: 'var(--radius-sm)', padding: '8px 14px', fontSize: 13, color: 'var(--emerald)' }}>
            Course and classroom pre-selected — choose a student below and submit.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 500px' }}>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--sand-mid)', marginBottom: 20 }}>
            <button
              onClick={() => { setActiveTab('existing'); setErrorMsg(''); }}
              style={{
                flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'existing' ? '2px solid var(--emerald)' : '2px solid transparent',
                color: activeTab === 'existing' ? 'var(--emerald)' : 'var(--ink-muted)',
                fontWeight: activeTab === 'existing' ? 600 : 400,
                fontSize: 14
              }}
            >
              Enroll Existing Student
            </button>
            <button
              onClick={() => { setActiveTab('new'); setErrorMsg(''); }}
              style={{
                flex: 1, padding: '12px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'new' ? '2px solid var(--emerald)' : '2px solid transparent',
                color: activeTab === 'new' ? 'var(--emerald)' : 'var(--ink-muted)',
                fontWeight: activeTab === 'new' ? 600 : 400,
                fontSize: 14
              }}
            >
              Add & Enroll New Student
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ background: 'var(--white)', borderRadius: 'var(--radius-lg)', padding: 24, border: '1px solid var(--sand-mid)' }}>

            {errorMsg && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
                {errorMsg}
              </div>
            )}

            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Student Details</h3>

              {activeTab === 'existing' ? (
                <div className="field">
                  <label>Select Student <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                    <option value="">— Select an existing student —</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.phone})</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>

                  {/* ── Minor / Adult Toggle ── */}
                  <div className="field" style={{ gridColumn: 'span 2' }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: isMinor ? 'var(--emerald-pale, #ecfdf5)' : 'var(--sand-light)',
                      border: `1.5px solid ${isMinor ? 'var(--emerald-light)' : 'var(--sand-mid)'}`,
                      borderRadius: 'var(--radius-md)', padding: '12px 16px', transition: 'all 0.2s',
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>
                          {isMinor ? ' Minor Student (Under 18)' : ' Adult Student (18+)'}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
                          {isMinor
                            ? 'Guardian contact will be used — no phone required for the student.'
                            : 'Adult Students must have their own phone number for enrollment.'}
                        </div>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Minor</span>
                        <div
                          onClick={() => setIsMinor(v => !v)}
                          style={{
                            width: 44, height: 24, borderRadius: 12, cursor: 'pointer',
                            background: isMinor ? 'var(--emerald)' : 'var(--ink-pale)',
                            position: 'relative', transition: 'background 0.2s',
                          }}
                        >
                          <div style={{
                            position: 'absolute', top: 2, left: isMinor ? 22 : 2,
                            width: 20, height: 20, borderRadius: '50%', background: '#fff',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
                          }} />
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="field">
                    <label>Full name <span style={{ color: 'var(--red)' }}>*</span></label>
                    <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Hamza Rauf" required />
                  </div>
                  <div className="field">
                    <label>Full name (Urdu)</label>
                    <input type="text" value={fullNameUr} onChange={(e) => setFullNameUr(e.target.value)} placeholder="حمزہ رؤف" dir="rtl" />
                  </div>

                  {/* ── Phone OR Guardian fields — conditional on isMinor ── */}
                  {!isMinor ? (
                    <div className="field">
                      <label>Phone <span style={{ color: 'var(--red)' }}>*</span></label>
                      <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" required />
                      <small style={{ color: 'var(--ink-pale)', fontSize: 11, marginTop: 4, display: 'block' }}>
                        Enter a number with an active WhatsApp account — same number will be used for WhatsApp.
                      </small>
                    </div>
                  ) : (
                    <>
                      <div className="field">
                        <label>Guardian Phone <span style={{ color: 'var(--red)' }}>*</span></label>
                        <input type="tel" value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} placeholder="+92 3xx xxxxxxx" />
                        <small style={{ color: 'var(--ink-pale)', fontSize: 11, marginTop: 4, display: 'block' }}>
                          If guardian already exists in system, their account will be linked automatically.
                        </small>
                      </div>
                      <div className="field">
                        <label>Guardian Name</label>
                        <input type="text" value={guardianName} onChange={(e) => setGuardianName(e.target.value)} placeholder="e.g. Muhammad Ali" />
                      </div>
                      <div className="field">
                        <label>Relation</label>
                        <select value={guardianRelation} onChange={(e) => setGuardianRelation(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="father">Father</option>
                          <option value="mother">Mother</option>
                          <option value="sibling">Sibling</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </>
                  )}

                  <div className="field">
                    <label>Father's Name</label>
                    <input type="text" value={fatherName} onChange={(e) => setFatherName(e.target.value)} placeholder="e.g. Muhammad Ali" />
                  </div>
                  <div className="field">
                    <label>Date of birth</label>
                    <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)}>
                      <option value="">— Select —</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Profile Picture</label>
                    <input type="file" accept="image/*" onChange={(e) => setProfilePicture(e.target.files[0])} />
                  </div>
                  {!isMinor && (
                    <>
                      <div className="field">
                        <label>Qualification</label>
                        <select value={qualification} onChange={(e) => setQualification(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="Matric">Matric</option>
                          <option value="Intermediate">Intermediate</option>
                          <option value="Bachelors">Bachelors</option>
                          <option value="Masters">Masters</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Occupation</label>
                        <select value={occupation} onChange={(e) => setOccupation(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="Student">Student</option>
                          <option value="Employee">Employee</option>
                          <option value="Business">Business</option>
                          <option value="Unemployed">Unemployed</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Marital Status</label>
                        <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                          <option value="">— Select —</option>
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>
                      <div className="field" style={{ display: 'flex', alignItems: 'center', gap: 8, height: '100%', marginTop: 24 }}>
                        <input type="checkbox" id="repeater" checked={isRepeater} onChange={(e) => setIsRepeater(e.target.checked)} style={{ width: 'auto' }} />
                        <label htmlFor="repeater" style={{ margin: 0 }}>Are you Repeater?</label>
                      </div>
                    </>
                  )}
                  <div className="field" style={{ gridColumn: 'span 2' }}>
                    <label>Complete Address</label>
                    <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows="2" placeholder="House #, Street, City..." />
                  </div>
                  <div className="field">
                    <label>Center Manager Name</label>
                    <input type="text" value={centerManagerName} onChange={(e) => setCenterManagerName(e.target.value)} placeholder="Name of Center Organizer" />
                  </div>
                  <div className="field">
                    <label>Center Manager Contact</label>
                    <input type="tel" value={centerManagerContact} onChange={(e) => setCenterManagerContact(e.target.value)} placeholder="+92 3xx xxxxxxx" />
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24, paddingTop: 24, borderTop: '1px solid var(--sand)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Course & Classroom</h3>

              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
                <div className="field">
                  <label>Course <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select
                    value={courseId}
                    onChange={(e) => {
                      setCourseId(e.target.value);
                      setClassId('');
                      setPriorLevel('');
                      setCashReceived('');
                    }}
                    required
                    disabled={!!presetClassId}
                  >
                    <option value="">— Select course —</option>
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.type ? `(${c.type})` : ''}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label>Classroom <span style={{ color: 'var(--red)' }}>*</span></label>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    required
                    disabled={!courseId || !!presetClassId || isLoadingClasses}
                  >
                    <option value="">{!courseId ? '— Select a course first —' : isLoadingClasses ? 'Loading...' : '— Select classroom —'}</option>
                    {filteredClasses.map(c => (
                      <option key={c.id} value={c.id}>{formatClassroomWithSchedules(c)}</option>
                    ))}
                  </select>
                  {selectedClass?.schedules?.length > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>
                      Student will attend all scheduled time slots for this classroom.
                    </div>
                  )}
                </div>

                <div className="field">
                  <label>Enrollment date</label>
                  <input type="date" value={enrollDate} onChange={(e) => setEnrollDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24, paddingTop: 24, borderTop: '1px solid var(--sand)' }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', marginBottom: 16 }}>Prior Knowledge</h3>

              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
                <div className="field">
                  <label>Level</label>
                  <select value={priorLevel} onChange={(e) => setPriorLevel(e.target.value)}>
                    <option value="">— Select level —</option>
                    <option value="None">None</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <div className="field">
                  <label>Notes (Urdu)</label>
                  <textarea value={notesUr} onChange={(e) => setNotesUr(e.target.value)} rows="2" dir="rtl" placeholder="کوئی متعلقہ معلومات…" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 24, paddingTop: 24, borderTop: '1px solid var(--sand)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>Fee Collection</h3>
                <div style={{ background: 'var(--ink)', color: '#5ED4A8', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>Cash Only</div>
              </div>

              <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
                <div className="field">
                  <label>Course Level Fee (Auto)</label>
                  <div style={{ display: 'flex', border: '1.5px solid var(--rule)', borderRadius: 'var(--radius-sm)', background: 'var(--rule2)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', borderRight: '1.5px solid var(--rule)' }}>PKR</div>
                    <input type="text" value={selectedFee ? selectedFee?.fee : '0'} readOnly style={{ border: 'none', background: 'transparent', flex: 1, padding: '8px 11px', color: 'var(--ink-muted)' }} />
                  </div>
                </div>

                <div className="field">
                  <label>Payment Method</label>
                  <select disabled style={{ background: 'var(--rule2)', color: 'var(--ink-muted)' }}>
                    <option>💵 Cash</option>
                  </select>
                </div>

                <div className="field" style={{ gridColumn: 'span 2' }}>
                  <label>Cash Received (PKR) {selectedFee && <span style={{ color: 'var(--red)' }}>*</span>}</label>
                  <div style={{ display: 'flex', border: '1.5px solid var(--rule)', borderRadius: 'var(--radius-sm)', background: 'var(--sand)', overflow: 'hidden' }}>
                    <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, color: 'var(--ink-muted)', borderRight: '1.5px solid var(--rule)', background: 'var(--rule2)' }}>PKR</div>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={selectedFee ? "Enter amount collected..." : "No fee configured for this level"}
                      required={!!selectedFee}
                      disabled={!selectedFee}
                      style={{ border: 'none', background: 'transparent', flex: 1, padding: '8px 11px', outline: 'none' }}
                    />
                  </div>
                  {selectedFee && <div style={{ fontSize: 11, color: 'var(--ink-muted)', marginTop: 4 }}>Must match fee exactly (PKR {selectedFee?.fee}).</div>}
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} style={{
              width: '100%', padding: '12px', background: 'var(--emerald)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1
            }}>
              {isSubmitting ? 'Enrolling...' : 'Enroll student'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
