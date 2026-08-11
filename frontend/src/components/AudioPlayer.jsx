import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { MicIcon, DownloadIcon, PlayIcon, PauseIcon } from './Icons';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds === null || seconds === undefined || !isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function AudioPlayer({ src, title = 'Audio Submission', duration: initialDuration = 0, compact = false, allowDownload = null }) {
  const { role, user } = useAuth();
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration && isFinite(initialDuration) ? initialDuration : 0);

  // Download permission: only Teachers, Center Managers, or Super Admins
  const userRoles = user?.roles || [];
  const isPrivilegedUser = role === 'teacher' || role === 'center_manager' || role === 'super_admin' || userRoles.some(r => ['teacher', 'center_manager', 'super_admin'].includes(r));
  const canDownload = allowDownload !== null ? allowDownload : isPrivilegedUser;

  // Normalize relative backend upload path to backend base URL if needed
  const audioSrc = src?.startsWith('/') && !src.startsWith('http')
    ? `${import.meta.env.VITE_API_URL || ''}${src}`.replace('/api/v1', '')
    : src;

  useEffect(() => {
    if (initialDuration && !isNaN(initialDuration) && isFinite(initialDuration) && initialDuration > 0) {
      setDuration(initialDuration);
    }
  }, [initialDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      } else if (initialDuration && !isNaN(initialDuration) && isFinite(initialDuration) && initialDuration > 0) {
        setDuration(initialDuration);
      }
    };
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [src, initialDuration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => console.error('Audio play error:', err));
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  if (!src) return null;

  if (compact) {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '6px 14px', borderRadius: 24, minWidth: 260 }}>
        <audio ref={audioRef} src={audioSrc} preload="metadata" />
        <button
          type="button"
          onClick={togglePlay}
          style={{
            background: 'var(--emerald, #059669)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: 28,
            height: 28,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            lineHeight: 1,
            flexShrink: 0,
          }}
          title={isPlaying ? 'Pause' : 'Play Audio'}
        >
          {isPlaying ? <PauseIcon size={12} color="#ffffff" /> : <PlayIcon size={12} color="#ffffff" />}
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%',
              accentColor: 'var(--emerald, #059669)',
              cursor: 'pointer',
              height: 4,
            }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap' }}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
        border: '1px solid #a7f3d0',
        borderRadius: 'var(--radius-lg, 12px)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: '0 2px 4px rgba(5,150,105,0.06)',
      }}
    >
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#047857' }}>
          <MicIcon size={18} color="#047857" /> {title}
        </div>
        {canDownload && (
          <a
            href={audioSrc}
            target="_blank"
            rel="noopener noreferrer"
            download
            style={{ fontSize: 12, color: 'var(--emerald, #059669)', textDecoration: 'none', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <DownloadIcon size={14} color="#059669" /> Download Audio
          </a>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="button"
          onClick={togglePlay}
          style={{
            background: 'var(--emerald, #059669)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '50%',
            width: 38,
            height: 38,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(5,150,105,0.3)',
            transition: 'transform 0.1s ease',
          }}
        >
          {isPlaying ? <PauseIcon size={16} color="#ffffff" /> : <PlayIcon size={16} color="#ffffff" />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            style={{
              width: '100%',
              accentColor: 'var(--emerald, #059669)',
              cursor: 'pointer',
              height: 6,
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#166534', fontWeight: 600 }}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
