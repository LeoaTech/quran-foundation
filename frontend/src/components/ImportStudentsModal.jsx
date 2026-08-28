import { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import LoadingSpinner from './LoadingSpinner';
import { importStudents, downloadImportTemplate } from '../api/users';
import { useToast } from '../hooks/useToast';

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
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);

  const toast = useToast();

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
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
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      if (targetCenter && targetCenter !== 'all') {
        formData.append('center_id', targetCenter);
      }

      const res = await importStudents(formData);
      setResult(res);

      if (res.successCount > 0) {
        if (res.skippedCount > 0) {
          toast.warning(`Import completed: ${res.successCount} imported, ${res.skippedCount} skipped due to validation errors.`);
        } else {
          toast.success(`Successfully imported all ${res.successCount} student account(s)!`);
        }
        if (onSuccess) onSuccess();
      } else {
        toast.error('No student records were imported. Please review the validation error list below.');
      }
    } catch (err) {
      toast.error(err.response?.data?.error?.message || err.message || 'Import process failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  return (
    <Modal open={isOpen} onClose={handleClose} title="➜] Bulk Import Student Accounts" size="lg">
      {uploading ? (
        /* Progress / Loader Screen during import process */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', gap: 16, textAlign: 'center' }}>
          <LoadingSpinner size={40} />
          <div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
              Processing Student Import...
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-mid)' }}>
              Parsing spreadsheet, verifying data, and setting up student profiles.
            </p>
          </div>
          <div style={{ width: '100%', maxWidth: 320, background: 'var(--sand)', borderRadius: 10, height: 6, overflow: 'hidden', marginTop: 10 }}>
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'var(--emerald)',
                animation: 'pulse 1.5s infinite ease-in-out',
              }}
            />
          </div>
        </div>
      ) : !result ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ fontSize: 13, color: 'var(--ink-mid)', margin: 0 }}>
            Upload a spreadsheet (<b>.csv</b> or <b>.xlsx</b>) containing student account profiles.
            You can download a pre-formatted sample template below 👇.
          </p>

          {/* Template Download Section */}
          <div style={{ background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', padding: 14, border: '1px solid var(--sand-mid)' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 8 }}>
              Need the file format template?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleDownloadTemplate('csv')}
              >
                𝄜 Sample CSV Template
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

          {/* File Input Dropzone */}
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
            <Button type="button" variant="outline" onClick={handleClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" variant="emerald" disabled={!file || uploading}>
             ⬇ Upload & Import Students
            </Button>
          </div>
        </form>
      ) : (
        /* Summary Results View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--emerald-light)', padding: 12, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--emerald)' }}>{result.successCount}</div>
              <div style={{ fontSize: 11, color: 'var(--emerald-dark)', fontWeight: 600 }}>Imported Successfully</div>
            </div>
            <div style={{ background: result.skippedCount > 0 ? 'var(--red-light)' : 'var(--sand-light)', padding: 12, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: result.skippedCount > 0 ? 'var(--red)' : 'var(--ink-mid)' }}>{result.skippedCount}</div>
              <div style={{ fontSize: 11, color: result.skippedCount > 0 ? 'var(--red-dark)' : 'var(--ink-soft)', fontWeight: 600 }}>Skipped / Errors</div>
            </div>
            <div style={{ background: 'var(--sand)', padding: 12, borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: 'var(--ink)' }}>{result.total}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-mid)', fontWeight: 600 }}>Total Rows Read</div>
            </div>
          </div>

          {result.errors && result.errors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>
                Validation & Error Details ({result.errors.length}):
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid var(--sand-mid)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ background: 'var(--sand-light)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Row #</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Student Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Phone</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Error Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((errItem, idx) => (
                      <tr key={idx} style={{ borderTop: '1px solid var(--sand)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600, color: 'var(--ink-mid)' }}>Row {errItem.row}</td>
                        <td style={{ padding: '6px 10px', fontWeight: 500 }}>{errItem.name}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--ink-soft)' }}>{errItem.phone || '—'}</td>
                        <td style={{ padding: '6px 10px', color: 'var(--red)', fontWeight: 500 }}>{errItem.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
            <Button variant="outline" onClick={handleReset}>
              Import Another File
            </Button>
            <Button variant="emerald" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

}
