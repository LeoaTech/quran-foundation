import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getImportJobStatus, downloadImportErrorReport } from '../api/users';

const ImportJobContext = createContext(null);

const STORAGE_KEY_PREFIX = 'qf_student_import_job_';

// ── Floating progress card (portalled to document.body) ─────────────────────

function FloatingImportCard({ jobData, phase, onExpand, onDismiss }) {
  if (!jobData && phase !== 'uploading') return null;

  const isActive = phase === 'uploading' || phase === 'polling';
  const isFailed = phase === 'error';
  const isDone = phase === 'results';

  // Calculate overall progress
  let overallPct = 0;
  if (jobData) {
    const sp = jobData.progress?.students || {};
    const ep = jobData.progress?.enrollments || {};
    const totalWork = (sp.total || 0) + (ep.total || 0);
    const doneWork = (sp.processed || 0) + (ep.processed || 0);
    overallPct = totalWork > 0 ? Math.round((doneWork / totalWork) * 100) : 0;
  }

  const borderColor = isFailed ? 'var(--red)' : isDone ? 'var(--emerald)' : 'var(--blue, #3b82f6)';

  return createPortal(
    <div
      onClick={onExpand}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 998,
        width: 320,
        background: 'var(--white, #fff)',
        borderRadius: 'var(--radius-lg, 12px)',
        boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
        border: `2px solid ${borderColor}`,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        animation: 'fadeUp 0.3s ease both',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.15)'; }}
    >
      {/* Progress bar strip at top */}
      {isActive && (
        <div style={{ width: '100%', height: 4, background: 'var(--sand, #eee)' }}>
          <div style={{
            height: '100%',
            width: `${overallPct}%`,
            background: borderColor,
            transition: 'width 0.5s ease',
            borderRadius: '0 2px 2px 0',
          }} />
        </div>
      )}

      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: isFailed ? 'var(--red-light, #fdecea)' : isDone ? 'var(--emerald-light, #e6f9f0)' : 'rgba(59,130,246,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {isFailed ? '❌' : isDone ? '✅' : '📥'}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink, #1a1a1a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {isFailed ? 'Import Failed' : isDone ? 'Import Complete' : phase === 'uploading' ? 'Uploading File...' : 'Importing Students...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-mid, #666)', marginTop: 2 }}>
            {isFailed && jobData?.failedReason
              ? jobData.failedReason.substring(0, 60)
              : isDone
                ? `${jobData?.counters?.studentsCreated || 0} created · ${jobData?.counters?.enrollmentsCreated || 0} enrolled${jobData?.counters?.errors > 0 ? ` · ${jobData.counters.errors} errors` : ''}`
                : jobData
                  ? `${overallPct}% · ${jobData.counters?.studentsCreated || 0} created`
                  : 'Preparing...'
            }
          </div>
        </div>

        {/* Dismiss button (only when done/error) */}
        {!isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--ink-pale, #999)', fontSize: 18, lineHeight: 1,
              padding: '2px 4px', flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Provider ────────────────────────────────────────────────────────────────

export function ImportJobProvider({ children }) {
  const [userId, setUserId] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | uploading | polling | results | error
  const [modalOpen, setModalOpen] = useState(false);
  const [onSuccessCallbacks, setOnSuccessCallbacks] = useState([]);
  const pollRef = useRef(null);

  const storageKey = `${STORAGE_KEY_PREFIX}${userId || 'current'}`;

  // ── Persistence helpers ─────────────────────────────────────────────────

  const persistState = useCallback((id, status) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ jobId: id, status }));
    } catch { /* quota exceeded — ignore */ }
  }, [storageKey]);

  const clearPersisted = useCallback(() => {
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  }, [storageKey]);

  // ── Polling logic ───────────────────────────────────────────────────────

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async (id) => {
    try {
      const data = await getImportJobStatus(id);
      setJobData(data);
      persistState(id, data.status);

      if (data.status === 'completed') {
        const imagesDone = data.imageProgress.done + data.imageProgress.failed >= data.imageProgress.queued;
        if (imagesDone || data.imageProgress.queued === 0) {
          stopPolling();
          setPhase('results');
          persistState(id, 'completed');
          if (data.counters.studentsCreated > 0 || data.counters.enrollmentsCreated > 0) {
            // Fire all registered success callbacks
            setOnSuccessCallbacks(cbs => { cbs.forEach(cb => cb()); return cbs; });
          }
        }
      } else if (data.status === 'failed') {
        stopPolling();
        setPhase('error');
        persistState(id, 'failed');
      }
    } catch (err) {
      console.error('[ImportJobContext] Poll error:', err);
    }
  }, [persistState, stopPolling]);

  const startPolling = useCallback((id) => {
    stopPolling();
    pollOnce(id);
    pollRef.current = setInterval(() => pollOnce(id), 3000);
  }, [pollOnce, stopPolling]);

  // ── Recover from localStorage on mount / user change ────────────────────

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (!saved?.jobId) return;

      setJobId(saved.jobId);
      if (saved.status === 'failed') {
        setPhase('error');
        // Fetch final data for display
        pollOnce(saved.jobId);
      } else if (saved.status === 'completed') {
        setPhase('results');
        pollOnce(saved.jobId);
      } else {
        setPhase('polling');
        startPolling(saved.jobId);
      }
    } catch {
      clearPersisted();
    }
  }, [storageKey]); 

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // ── Public API ──────────────────────────────────────────────────────────

  const startImport = useCallback((newJobId) => {
    setJobId(newJobId);
    setJobData(null);
    setPhase('polling');
    persistState(newJobId, 'queued');
    startPolling(newJobId);
  }, [persistState, startPolling]);

  const setUploading = useCallback(() => {
    setPhase('uploading');
  }, []);

  const cancelUploading = useCallback(() => {
    if (phase === 'uploading') setPhase('idle');
  }, [phase]);

  const dismissJob = useCallback(() => {
    stopPolling();
    setJobId(null);
    setJobData(null);
    setPhase('idle');
    clearPersisted();
    setOnSuccessCallbacks([]);
  }, [stopPolling, clearPersisted]);

  const openModal = useCallback(() => setModalOpen(true), []);
  const closeModal = useCallback(() => setModalOpen(false), []);

  const registerOnSuccess = useCallback((cb) => {
    setOnSuccessCallbacks(prev => [...prev, cb]);
    return () => setOnSuccessCallbacks(prev => prev.filter(c => c !== cb));
  }, []);

  const isActive = phase === 'uploading' || phase === 'polling';
  const hasJob = phase !== 'idle';
  const showFloat = hasJob && !modalOpen;

  const ctx = {
    jobId,
    jobData,
    phase,
    isActive,
    hasJob,
    modalOpen,
    startImport,
    setUploading,
    cancelUploading,
    dismissJob,
    openModal,
    closeModal,
    setUserId,
    registerOnSuccess,
    pollOnce,
    persistState,
  };

  return (
    <ImportJobContext.Provider value={ctx}>
      {children}
      {showFloat && (
        <FloatingImportCard
          jobData={jobData}
          phase={phase}
          onExpand={openModal}
          onDismiss={dismissJob}
        />
      )}
    </ImportJobContext.Provider>
  );
}

export function useImportJob() {
  const ctx = useContext(ImportJobContext);
  if (!ctx) throw new Error('useImportJob must be used within an ImportJobProvider');
  return ctx;
}

export default ImportJobContext;
