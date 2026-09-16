import { useState, useEffect } from 'react';
import client from '../api/client';
import { dispatchCredentials } from '../api/users';
import { useToast } from '../hooks/useToast';

export default function ShareCredentialsModal({ isOpen, onClose, user }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const toast = useToast();

  // Reset password state whenever modal opens for a user
  useEffect(() => {
    if (isOpen) {
      setNewPassword('');
    }
  }, [isOpen, user?.id]);

  if (!isOpen || !user) return null;

  const handleDispatchTwilio = async () => {
    setIsDispatching(true);
    try {
      await dispatchCredentials(user.id);
      toast.success(`Credentials dispatch queued via Twilio WhatsApp for ${user.full_name}!`);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to dispatch credentials via Twilio.');
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRegenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await client.post(`/users/${user.id}/regenerate-password`);
      setNewPassword(res.data.new_password);
      toast.success('Password regenerated successfully.');
    } catch (err) {
      toast.error('Failed to regenerate password.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    const text = `Assalamu Alaikum ${user.full_name},\n\nYour account credentials for the Quran Foundation LMS have been generated.\n\nPhone (Login): ${user.phone}\nPassword: ${newPassword}\n\nPlease login using your phone number and change your password after first login.`;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleWhatsAppWeb = () => {
    const text = `Assalamu Alaikum ${user.full_name},\n\nYour account credentials for the Quran Foundation LMS have been generated.\n\nPhone (Login): ${user.phone}\nPassword: ${newPassword}\n\nPlease login using your phone number and change your password after first login.`;
    const url = `https://wa.me/${user.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 440 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Share Credentials</h3>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 20 }}>
          Send automated WhatsApp credentials to <strong>{user.full_name}</strong> via Twilio, or manually generate a password.
        </p>

        {!newPassword ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <button
              onClick={handleDispatchTwilio}
              disabled={isDispatching}
              style={{
                padding: '12px 16px',
                background: 'var(--emerald)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              {isDispatching ? 'Enqueuing Dispatch...' : ' Send Automatically via Twilio WhatsApp'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--ink-pale)', margin: '4px 0' }}>— OR —</div>

            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              style={{
                padding: '10px 16px',
                background: 'var(--sand-light)',
                color: 'var(--ink)',
                border: '1px solid var(--sand-mid)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              {isGenerating ? 'Generating...' : ' Manually Regenerate & Copy Password'}
            </button>

            <button
              onClick={onClose}
              style={{ padding: '8px 16px', background: 'none', border: 'none', color: 'var(--ink-muted)', cursor: 'pointer', marginTop: 4 }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <div>
            <div style={{ padding: 16, background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', marginBottom: 20, textAlign: 'center', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>
              {newPassword}
            </div>

            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button
                onClick={handleCopy}
                style={{ padding: '12px', background: 'var(--emerald)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={handleWhatsAppWeb}
                style={{ padding: '10px', background: 'none', border: '1px solid var(--sand-mid)', color: 'var(--ink-muted)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 13 }}
              >
                Open in WhatsApp Web (Manual)
              </button>
              <button
                onClick={onClose}
                style={{ padding: '8px', background: 'none', color: 'var(--ink-muted)', border: 'none', cursor: 'pointer', marginTop: 4 }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
