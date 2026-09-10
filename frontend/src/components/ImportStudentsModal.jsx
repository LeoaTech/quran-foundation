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


  const handleMinimize = () => {
    onClose(); // close modal, float card takes over
  };

 
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
            ↘ Minimize modal, process continues in background
          </Button>
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
