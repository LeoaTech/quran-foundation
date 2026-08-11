import { useState, useRef, useEffect } from 'react';
import Button from './Button';
import Modal from './Modal';
import { uploadHomeworkAudio } from '../api/homework';
import { useToast } from '../hooks/useToast';
import {
  MicIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  RefreshIcon,
  TrashIcon,
  CheckIcon,
  BookIcon,
} from './Icons';

const MAX_DURATION_SECONDS = 180; // 3 Minutes limit

function formatSeconds(secs) {
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.floor(secs % 60);
  return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
}

export default function AudioRecorder({ assignmentId, classId, onUploadSuccess, currentAudioUrl = null, currentAudioDuration = null }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'file'

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileAudioUrl, setFileAudioUrl] = useState(null);
  const [fileDuration, setFileDuration] = useState(0);

  // General & Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // Clean up timer and media stream on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // ── Recording Controls ───────────────────────────────────────────────────────

  const startRecording = async () => {
    setErrorMsg('');
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setRecordingSeconds(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          setRecordedDuration(next);
          // Hard stop at 3 minutes
          if (next >= MAX_DURATION_SECONDS) {
            stopRecording();
            toast.info('Maximum 3-minute recording limit reached.');
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone permission error:', err);
      setErrorMsg('Microphone access denied or not available. Please allow microphone permissions in your browser.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          setRecordedDuration(next);
          if (next >= MAX_DURATION_SECONDS) {
            stopRecording();
            toast.info('Maximum 3-minute recording limit reached.');
          }
          return next;
        });
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
  };

  const resetRecording = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingSeconds(0);
    setRecordedBlob(null);
    setRecordedAudioUrl(null);
    setRecordedDuration(0);
    setErrorMsg('');
  };

  // ── File Selection & Validation ──────────────────────────────────────────────

  const handleFileSelect = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|webm|flac)$/i)) {
      setErrorMsg('Invalid file format. Please select a valid audio file (.mp3, .wav, .m4a, .webm, .ogg).');
      setSelectedFile(null);
      setFileAudioUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setFileAudioUrl(objectUrl);

    const audio = new Audio(objectUrl);
    audio.onloadedmetadata = () => {
      const durationSecs = Math.round(audio.duration || 0);
      setFileDuration(durationSecs);

      if (durationSecs > MAX_DURATION_SECONDS) {
        setErrorMsg(`Selected audio file duration (${formatSeconds(durationSecs)}) exceeds maximum limit of 3 minutes.`);
        setSelectedFile(null);
        setFileAudioUrl(null);
      } else {
        setSelectedFile(file);
      }
    };

    audio.onerror = () => {
      setSelectedFile(file);
      setFileDuration(0);
    };
  };

  // ── Trigger Confirmation Modal ────────────────────────────────────────────────

  const openConfirmationModal = () => {
    setErrorMsg('');
    let durationSecs = activeTab === 'record' ? recordedDuration : fileDuration;

    if (activeTab === 'record' && !recordedBlob) {
      setErrorMsg('Please record your audio before submitting.');
      return;
    }
    if (activeTab === 'file' && !selectedFile) {
      setErrorMsg('Please select an audio file to upload.');
      return;
    }

    if (durationSecs > MAX_DURATION_SECONDS) {
      setErrorMsg('Audio duration exceeds maximum 3-minute limit.');
      return;
    }

    setShowConfirmModal(true);
  };

  // ── Final Upload Execution ────────────────────────────────────────────────────

  const performUpload = async () => {
    let fileToUpload = null;
    let durationSecs = 0;

    if (activeTab === 'record') {
      fileToUpload = new File([recordedBlob], `recording_${Date.now()}.webm`, { type: 'audio/webm' });
      durationSecs = recordedDuration;
    } else {
      fileToUpload = selectedFile;
      durationSecs = fileDuration;
    }

    setIsUploading(true);
    try {
      const res = await uploadHomeworkAudio(assignmentId, classId, fileToUpload, durationSecs);
      toast.success('Voice recording submitted successfully!');
      setIsUploading(false);
      setShowConfirmModal(false);
      resetRecording();
      setSelectedFile(null);
      setFileAudioUrl(null);
      if (onUploadSuccess) onUploadSuccess(res);
    } catch (err) {
      console.error('Audio upload failed:', err);
      setErrorMsg(err?.response?.data?.message || err?.message || 'Failed to upload audio submission.');
      setIsUploading(false);
      setShowConfirmModal(false);
    }
  };

  const previewAudioSrc = activeTab === 'record' ? recordedAudioUrl : fileAudioUrl;

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid var(--sand-mid, #cbd5e1)',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink, #0f172a)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MicIcon size={18} color="var(--emerald, #059669)" /> Submit Voice Recording
        </h3>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#047857', background: '#ecfdf5', padding: '4px 10px', borderRadius: 12, border: '1px solid #a7f3d0', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ClockIcon size={13} color="#047857" /> Max Duration: 3:00 mins
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--sand-mid, #e2e8f0)', paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab('record')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: activeTab === 'record' ? 'var(--emerald, #059669)' : 'transparent',
            color: activeTab === 'record' ? '#ffffff' : 'var(--ink-soft, #64748b)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <MicIcon size={14} color={activeTab === 'record' ? '#ffffff' : 'var(--ink-soft)'} /> Record Audio
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('file')}
          style={{
            padding: '8px 16px',
            borderRadius: 'var(--radius-md, 8px)',
            border: 'none',
            background: activeTab === 'file' ? 'var(--emerald, #059669)' : 'transparent',
            color: activeTab === 'file' ? '#ffffff' : 'var(--ink-soft, #64748b)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <BookIcon size={14} color={activeTab === 'file' ? '#ffffff' : 'var(--ink-soft)'} /> Attach Audio File
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '10px 14px', borderRadius: 8, fontSize: 13 }}>
          {errorMsg}
        </div>
      )}

      {/* Tab 1: Live Voice Recording */}
      {activeTab === 'record' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', padding: '12px 0' }}>
          {/* Live Recording Timer */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'monospace', color: isRecording ? '#dc2626' : 'var(--ink)' }}>
              {formatSeconds(recordingSeconds)} / 03:00
            </div>
            {isRecording && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#dc2626', fontWeight: 600, marginTop: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                Recording in progress...
              </div>
            )}
          </div>

          {/* Recording Actions */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            {!isRecording && !recordedAudioUrl && (
              <Button variant="primary" onClick={startRecording} style={{ background: '#dc2626', borderColor: '#dc2626', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MicIcon size={15} color="#ffffff" /> Start Recording
              </Button>
            )}

            {isRecording && (
              <>
                {isPaused ? (
                  <Button variant="outline" onClick={resumeRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PlayIcon size={13} color="currentColor" /> Resume
                  </Button>
                ) : (
                  <Button variant="outline" onClick={pauseRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <PauseIcon size={13} color="currentColor" /> Pause
                  </Button>
                )}
                <Button variant="danger" onClick={stopRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <StopIcon size={13} color="#ffffff" /> Stop Recording
                </Button>
              </>
            )}

            {recordedAudioUrl && !isRecording && (
              <Button variant="outline" onClick={resetRecording} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <RefreshIcon size={14} color="currentColor" /> Re-record Audio
              </Button>
            )}
          </div>

          {/* Recorded Audio Preview */}
          {recordedAudioUrl && !isRecording && (
            <div style={{ width: '100%', maxWidth: 450, marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', marginBottom: 4 }}>
                Preview Recorded Audio:
              </div>
              <audio src={recordedAudioUrl} controls style={{ width: '100%', borderRadius: 8, accentColor: 'var(--emerald)' }} />
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Attach Audio File */}
      {activeTab === 'file' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            Select Audio File from Device (Max 3 Minutes):
          </label>
          <input
            type="file"
            accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
            onChange={handleFileSelect}
            style={{
              padding: '10px',
              border: '1px dashed var(--sand-mid, #cbd5e1)',
              borderRadius: 8,
              background: '#f8fafc',
              fontSize: 13,
              cursor: 'pointer',
            }}
          />

          {selectedFile && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '10px 14px', borderRadius: 8, fontSize: 13, color: '#166534' }}>
              <strong>Selected File:</strong> {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
              {fileDuration > 0 && <span> — Duration: {formatSeconds(fileDuration)}</span>}
            </div>
          )}
        </div>
      )}

      {/* Submit Action Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8, borderTop: '1px solid var(--sand-light)' }}>
        <Button
          variant="primary"
          onClick={openConfirmationModal}
          disabled={isUploading || (activeTab === 'record' ? !recordedBlob : !selectedFile)}
        >
          Submit Voice Recording
        </Button>
      </div>

      {/* Confirmation Modal */}
      <Modal
        open={showConfirmModal}
        title="Confirm Voice Recording Submission"
        size="md"
        onClose={() => setShowConfirmModal(false)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Instructions Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: '1px solid #a7f3d0',
              borderRadius: 10,
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: '#047857', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookIcon size={16} color="#047857" /> Recitation & Audio Instructions
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#166534', lineHeight: 1.6 }}>
              <li>Record or use your microphone in a quiet, silent place with clear audio.</li>
              <li>Pronounce each word slowly and follow the specified rules.</li>
              <li>Listen carefully to your recording preview below before final submission.</li>
            </ul>
          </div>

          {/* Audio Preview inside Modal */}
          {previewAudioSrc && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                Audio Preview (Listen Before Submitting):
              </label>
              <audio
                src={previewAudioSrc}
                controls
                style={{ width: '100%', borderRadius: 8, accentColor: 'var(--emerald)' }}
              />
            </div>
          )}

          {/* Modal Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingTop: 12, borderTop: '1px solid var(--sand-mid)' }}>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmModal(false);
                resetRecording();
                setSelectedFile(null);
                setFileAudioUrl(null);
                toast.info('Recording discarded. You can record again.');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <TrashIcon size={14} color="currentColor" /> Discard & Re-record
            </Button>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
                Back
              </Button>
              <Button variant="primary" onClick={performUpload} isLoading={isUploading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CheckIcon size={14} color="#ffffff" /> Confirm & Submit
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
