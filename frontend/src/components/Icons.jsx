import React from 'react';

const iconStyle = (size = 16, color = 'currentColor') => ({
  width: size,
  height: size,
  stroke: color,
  fill: 'none',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  display: 'inline-block',
  verticalAlign: 'middle',
});

export const MicIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="22" />
  </svg>
);

export const LockIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

export const CheckIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const ClockIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export const PlayIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), fill: color, transform: 'translateX(1px)', ...style }} viewBox="0 0 24 24">
    <polygon points="6 4 19 12 6 20" />
  </svg>
);

export const PauseIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), fill: color, ...style }} viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" />
    <rect x="14" y="4" width="4" height="16" />
  </svg>
);

export const StopIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), fill: color, ...style }} viewBox="0 0 24 24">
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

export const DownloadIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

export const TrashIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

export const UserIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

export const EditIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

export const BookIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export const CalendarIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const RefreshIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
);

export const CloseIcon = ({ size = 16, color = 'currentColor', style = {} }) => (
  <svg style={{ ...iconStyle(size, color), ...style }} viewBox="0 0 24 24">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
