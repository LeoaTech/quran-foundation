import { useState, useEffect } from 'react';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { importStudents, downloadImportTemplate, downloadImportErrorReport } from '../api/users';
import { useToast } from '../hooks/useToast';
import { useImportJob } from '../context/ImportJobContext';

// ── ImportStudentsModal ─────────────────────────────────────────────────────
// Uses ImportJobContext for persistent polling across page navigations.
// The modal is a view-only layer on top of the context state.

export default function ImportStudentsModal({
  isOpen,
  onClose,
  centers = [],
  defaultCenterId = 'all',
  isGlobal = false,
  onSuccess,
}) {
  const [file, setFile] = useState(null);
  const [targetCenter, setTargetCenter] = useState(defaultCenterId);
  const [showGuide, setShowGuide] = useState(false);

  const toast = useToast();
  const ctx = useImportJob();

  // Register the onSuccess callback with the context so it fires
  // even if the modal is closed when the import completes.
  useEffect(() => {
    if (!onSuccess) return;
    return ctx.registerOnSuccess(onSuccess);
  }, [onSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync modal open state with context
  useEffect(() => {
    if (isOpen) ctx.openModal();
    else ctx.closeModal();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const { phase, jobData, jobId, isActive } = ctx;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleDownloadTemplate = async (format) => {
    try {
      toast.info(`Downloading ${format.toUpperCase()} sample template...`);
      await downloadImportTemplate(format);
    } catch (err) {
      toast.error('Failed to download template file.');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error('Please select a CSV or Excel file to upload.');
      return;
    }

    if (isGlobal && (targetCenter === 'all' || !targetCenter)) {
      toast.error('Please select a target center for importing students.');
      return;
    }

    try {
      ctx.setUploading();
      const formData = new FormData();
      formData.append('file', file);
      if (targetCenter && targetCenter !== 'all') {
        formData.append('center_id', targetCenter);
      }

      const res = await importStudents(formData);
      ctx.startImport(res.jobId);
      toast.success('File uploaded! Import is being processed in the background.');
    } catch (err) {
      ctx.cancelUploading();
      toast.error(err.response?.data?.error?.message || err.message || 'Upload failed.');
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!jobId) return;
    try {
      await downloadImportErrorReport(jobId);
      toast.info('Error report downloaded.');
    } catch {
      toast.error('Failed to download error report.');
    }
  };

  const handleMinimize = () => {
    onClose(); // close modal, float card takes over
  };

  const handleReset = () => {
    ctx.dismissJob();
    setFile(null);
  };

  const handleDone = () => {
    ctx.dismissJob();
    setFile(null);
    onClose();
  };

  // ── Shared sub-components ────────────────────────────────────────────────

  const ProgressBar = ({ label, processed, total, percentage }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
        <span>{label}</span>
        <span>{processed}/{total} ({percentage}%)</span>
      </div>
      <div style={{ width: '100%', background: 'var(--sand)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: 'var(--emerald)',
          borderRadius: 10,
          transition: 'width 0.4s ease',
        }} />
      </div>
    </div>
  );

  const CounterCard = ({ value, label, color, bgColor }) => (
    <div style={{ background: bgColor, padding: 10, borderRadius: 'var(--radius-md)', textAlign: 'center', flex: 1 }}>
      <div style={{ fontSize: 20, fontWeight: 'bold', color }}>{value}</div>
      <div style={{ fontSize: 10, color, fontWeight: 600, opacity: 0.8 }}>{label}</div>
    </div>
  );

  // Determine if we should show the form or the job view
  const showForm = phase === 'idle';
  const showJobView = phase !== 'idle';

  return (
    <Modal open={isOpen} onClose={handleMinimize} title="⬇ Bulk Import Students" size="lg">
      
      {/* ── UPLOADING PHASE ───────────────────────────────────────────────── */}
      {phase === 'uploading' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 16, textAlign: 'center' }}>
          <LoadingSpinner size={40} />
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Uploading File...
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mid)' }}>
              Validating format and sending to background processor.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={handleMinimize} style={{ marginTop: 8 }}>
            ↘ Minimize modal, process continues in background...
          </Button>
        </div>
      )}

      {/* ── POLLING / RESULTS / ERROR PHASE ───────────────────────────────── */}
      {showJobView && phase !== 'uploading' && jobData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>

          {/* Status header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {phase === 'polling' && <LoadingSpinner size={20} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>
              {phase === 'error'
                ? 'Import failed (fix the reported rows and ) try again.'
                : phase === 'results'
                  ? '✔ Import completed.'
                  : jobData.status === 'completed'
                    ? 'Finishing up image uploads...'
                    : 'Processing import...'}
            </span>
            {phase === 'polling' && (
              <Button size="sm" variant="outline" onClick={handleMinimize} title="Minimize dialog">
                ↘
              </Button>
            )}
          </div>

          {/* Progress bars */}
          <ProgressBar
            label="📉 Student Accounts"
            processed={jobData.progress.students.processed}
            total={jobData.progress.students.total}
            percentage={jobData.progress.students.percentage}
          />

          {jobData.progress.enrollments.total > 0 && (
            <ProgressBar
              label="🗒 Enrollments"
              processed={jobData.progress.enrollments.processed}
              total={jobData.progress.enrollments.total}
              percentage={jobData.progress.enrollments.percentage}
            />
          )}

          {/* Counter cards */}
          <div style={{ display: 'flex', gap: 8 }}>
            <CounterCard value={jobData.counters.studentsCreated} label="Created" color="var(--emerald)" bgColor="var(--emerald-light)" />
            <CounterCard value={jobData.counters.studentsReused} label="Reused" color="var(--blue, #3b82f6)" bgColor="rgba(59,130,246,0.1)" />
            <CounterCard value={jobData.counters.enrollmentsCreated} label="Enrolled" color="var(--purple, #8b5cf6)" bgColor="rgba(139,92,246,0.1)" />
            <CounterCard value={jobData.counters.errors} label="Errors" color="var(--red)" bgColor="var(--red-light)" />
          </div>

          {/* Image progress */}
          {jobData.imageProgress.queued > 0 && (
            <div style={{ fontSize: 12, color: 'var(--ink-mid)', padding: '6px 10px', background: 'var(--sand-light)', borderRadius: 'var(--radius-md)' }}>
              📸 Profile images: {jobData.imageProgress.done}/{jobData.imageProgress.queued} uploaded
              {jobData.imageProgress.failed > 0 && <span style={{ color: 'var(--red)' }}> · {jobData.imageProgress.failed} failed</span>}
            </div>
          )}

          {/* Failed reason banner */}
          {jobData.failedReason && (
            <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--red-light, #fdecea)', color: 'var(--red)', fontSize: 13 }}>
              <b>What went wrong:</b> {jobData.failedReason}
            </div>
          )}

          {/* Error table */}
          {(phase === 'results' || phase === 'error') && jobData.errors && jobData.errors.length > 0 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>
                Error Details ({jobData.pagination.totalErrors}):
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: 'var(--sand-light)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Sheet</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Row</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Student</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobData.errors.map((errItem) => (
                      <tr key={errItem.id} style={{ borderTop: '1px solid var(--sand)' }}>
                        <td style={{ padding: '6px 10px', color: 'var(--ink-soft)', fontWeight: 500 }}>{errItem.sheet}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--ink-mid)' }}>{errItem.row || '—'}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{errItem.studentName || errItem.studentRef || '—'}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--red)', fontWeight: 500 }}>{errItem.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {jobData.pagination.hasMore && (
                <div style={{ fontSize: 11, color: 'var(--ink-soft)', marginTop: 4, textAlign: 'center' }}>
                  Showing {jobData.errors.length} of {jobData.pagination.totalErrors} errors
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            {(phase === 'results' || phase === 'error') && jobData.pagination?.totalErrors > 0 && (
              <Button variant="outline" onClick={handleDownloadErrorReport}>
                ⬇ Download Error Report
              </Button>
            )}
            {(phase === 'results' || phase === 'error') && (
              <Button variant="outline" onClick={handleReset}>Import Another File</Button>
            )}
            {phase === 'polling' && (
              <Button variant="outline" onClick={handleMinimize}>
                ↘ Minimize
              </Button>
            )}
            {(phase === 'results' || phase === 'error') && (
              <Button variant="emerald" onClick={handleDone}>Done & Close</Button>
            )}
          </div>
        </div>
      )}

      {/* ── Polling but no data yet ───────────────────────────────────────── */}
      {phase === 'polling' && !jobData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 16, textAlign: 'center' }}>
          <LoadingSpinner size={40} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mid)' }}>Loading import progress...</p>
        </div>
      )}


      {/* ── Initial PHASE (Upload File Form) ──────────────────────────────────────── */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-mid)', margin: 0 }}>
            Upload a spreadsheet (<b>.xlsx</b> or <b>.csv</b>) containing student accounts and enrollments.
            The file will be processed in the background. You can minimize this dialog and continue working in the app.
          </p>

          {/* Template Download Section */}
          <div style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--sand-mid)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>
                Download Sample Templates
              </span>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                style={{ background: 'none', border: 'none', color: 'var(--emerald)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                {showGuide ? '▲ Hide Guide' : '▼ View Columns & Types Guide'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadTemplate('csv')}
              >
                𝄜  Sample CSV Template
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadTemplate('xlsx')}
              >
                💹 Sample Excel Template
              </Button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
              Excel template has two sheets (<b>Students</b> & <b>Enrollments</b>). CSV uses a single flat sheet.
            </p>

            {/* Column Specs & Guide Accordion */}
            {showGuide && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--sand-mid)', fontSize: 11, color: 'var(--ink-mid)' }}>
                <div style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>📋 Expected Sheets & Columns Guide:</div>

                <div style={{ background: '#fff', padding: 10, borderRadius: 6, marginBottom: 8, border: '1px solid var(--sand-mid)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--emerald)', marginBottom: 4 }}>🗒Sheet 1: Students</div>
                  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                    <li><b>Student Ref</b> <span style={{ color: 'var(--red)' }}>*</span>: Unique ID per student in this file (e.g. <code>S1</code>, <code>S2</code>) or their phone number.</li>
                    <li><b>Name (English)</b> <span style={{ color: 'var(--red)' }}>*</span>: Full name in English (e.g. <code>Ahmad Raza</code>).</li>
                    <li><b>Name (Urdu)</b>: Optional Urdu name (e.g. <code>احمد رضا</code>).</li>
                    <li><b>Father Name</b>: Father's full name.</li>
                    <li><b>Is Minor</b> <span style={{ color: 'var(--red)' }}>*</span>: Strictly <code>true</code> or <code>false</code>.</li>
                    <li><b>Phone Number</b>: Student's phone (required if <i>Is Minor</i> is <code>false</code>).</li>
                    <li><b>Guardian Name / Phone</b>: Guardian details (required if <i>Is Minor</i> is <code>true</code>).</li>
                    <li><b>Gender</b> <span style={{ color: 'var(--red)' }}>*</span>: <code>male</code> or <code>female</code>.</li>
                    <li><b>Date of Birth</b>: Format <code>MM-DD-YYYY</code> (e.g. <code>05-15-1998</code>).</li>
                    <li><b>Profile Picture</b>: Optional image URL (e.g. <code>https://example.com/photo.jpg</code> or Google Drive link).</li>
                    <li><b>Marital Status, Qualification, Occupation, Address</b>: Optional student info.</li>
                  </ul>
                </div>

                <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid var(--sand-mid)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--purple, #8b5cf6)', marginBottom: 4 }}>🗒 Sheet 2: Enrollments</div>
                  <ul style={{ margin: 0, paddingLeft: 16, lineHeight: 1.5 }}>
                    <li><b>Student Ref</b> <span style={{ color: 'var(--red)' }}>*</span>: <b style={{ color: 'var(--red)' }}>MUST MATCH</b> a <i>Student Ref</i> from the Students sheet (e.g. <code>S1</code>) or an existing student's phone.</li>
                    <li><b>Class ID</b> <span style={{ color: 'var(--red)' }}>*</span>: Class ID (e.g. <code>123e4567-e89b-12d3-a456-426614174000</code>).</li>
                    <li><b>Enrolled On</b> <span style={{ color: 'var(--red)' }}>*</span>: Format <code>MM-DD-YYYY</code> (e.g. <code>01-15-2024</code>).</li>
                    <li><b>Prior Level</b>: Optional (e.g. <code>Beginner</code>, <code>Intermediate</code>).</li>
                    <li><b>Notes (Urdu)</b>: Optional enrollment notes by teachers in Urdu.</li>
                    <li><b>Amount Paid</b>: Optional fee payment amount (e.g. <code>5000</code>).</li>
                    <li><b>Payment Method</b>: Optional (e.g. <code>cash</code>, <code>online</code>, <code>bank_transfer</code>).</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Target Center Selector for Super Admin */}
          {isGlobal && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
                Target Center <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <select
                className="f-input"
                style={{ width: '100%' }}
                value={targetCenter}
                onChange={(e) => setTargetCenter(e.target.value)}
              >
                <option value="all" disabled>-- Select Center --</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* File Input */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
              Select File (.csv or .xlsx) <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileChange}
              className="f-input"
              style={{ width: '100%', padding: '8px 12px' }}
            />
          </div>

          {file && (
            <div style={{ fontSize: 12, color: 'var(--emerald)', fontWeight: 500 }}>
              Selected file: <b>{file.name}</b> ({(file.size / 1024).toFixed(1)} KB)
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button type="button" variant="outline" onClick={() => onClose()}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" disabled={!file}>
              ⬆ Upload & Start Import
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
