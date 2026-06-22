import { useState } from 'react';
import client from '../api/client';
import { useToast } from '../hooks/useToast';

export default function ShareCredentialsModal({ isOpen, onClose, user }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const toast = useToast();

  if (!isOpen || !user) return null;

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
    navigator.clipboard.writeText(`Your new password is: ${newPassword}`);
    toast.success('Copied to clipboard');
  };

  const handleWhatsApp = () => {
    const text = `Assalamu Alaikum ${user.full_name},\n\nYour account credentials for the Quran Foundation LMS have been generated.\n\nPassword: ${newPassword}\n\nPlease login and change your password.`;
    const url = `https://wa.me/${user.phone?.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 400 }}>
        <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Share Credentials</h3>
        <p style={{ fontSize: 14, color: 'var(--ink-muted)', marginBottom: 24 }}>
          Generate a new password for <strong>{user.full_name}</strong> to share with them securely.
        </p>

        {!newPassword ? (
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--sand)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={handleRegenerate}
              disabled={isGenerating}
              style={{ padding: '8px 16px', background: 'var(--emerald)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}
            >
              {isGenerating ? 'Generating...' : 'Regenerate Password'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ padding: 16, background: 'var(--sand-light)', borderRadius: 'var(--radius-md)', marginBottom: 24, textAlign: 'center', fontSize: 20, fontWeight: 'bold', letterSpacing: 2 }}>
              {newPassword}
            </div>

            <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
              <button
                onClick={handleWhatsApp}
                style={{ padding: '12px', background: '#25D366', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
              >
                Share via WhatsApp
              </button>
              <button
                onClick={handleCopy}
                style={{ padding: '12px', background: 'var(--sand)', color: 'var(--ink)', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}
              >
                Copy to Clipboard
              </button>
              <button
                onClick={onClose}
                style={{ padding: '12px', background: 'none', color: 'var(--ink-muted)', border: 'none', cursor: 'pointer', marginTop: 8 }}
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
