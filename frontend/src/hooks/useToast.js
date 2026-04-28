import { useContext } from 'react';
import { ToastContext } from '../context/ToastContext';

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');

  const { addToast } = ctx;

  return {
    success: (message, opts) => addToast({ type: 'success', message, ...opts }),
    error:   (message, opts) => addToast({ type: 'error',   message, ...opts }),
    warning: (message, opts) => addToast({ type: 'warning', message, ...opts }),
    toast:   addToast,
  };
}
