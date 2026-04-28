import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardBody } from '../../../components/Card';
import Button from '../../../components/Button';
import RTLInput from '../../../components/RTLInput';
import LoadingSpinner from '../../../components/LoadingSpinner';
import { useToast } from '../../../hooks/useToast';
import { getOrg, updateOrg } from '../../../api/centers';

function Field({ label, children }) {
  return (
    <div className="f-group" style={{ marginBottom: 16 }}>
      <label className="f-label">{label}</label>
      {children}
    </div>
  );
}

export default function OrgSettings() {
  const qc    = useQueryClient();
  const toast = useToast();

  const { data: org, isLoading, error } = useQuery({
    queryKey: ['org'],
    queryFn:  getOrg,
    staleTime: 5 * 60_000,
  });

  const [form, setForm] = useState({
    name: '', name_ur: '', name_ar: '',
    contact_email: '', contact_phone: '', logo_url: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setForm({
        name:          org.name          ?? '',
        name_ur:       org.name_ur       ?? '',
        name_ar:       org.name_ar       ?? '',
        contact_email: org.contact_email ?? '',
        contact_phone: org.contact_phone ?? '',
        logo_url:      org.logo_url      ?? '',
      });
    }
  }, [org]);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateOrg(form);
      await qc.invalidateQueries({ queryKey: ['org'] });
      toast.success('Organization settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.error?.message ?? 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 'var(--radius-md)', padding: '12px 16px', fontSize: 13 }}>
        Failed to load organization settings.
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 3 }}>
          Organization settings
        </h2>
        <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
          Global settings for Quran Foundation
        </p>
      </div>

      <div style={{ maxWidth: 640 }}>
        <Card style={{ marginBottom: 20 }}>
          <CardHeader><span className="card-title">Identity</span></CardHeader>
          <CardBody>
            <form onSubmit={handleSave}>
              <Field label="Organization name (English)">
                <input className="f-input" value={form.name} onChange={set('name')} placeholder="e.g. Quran Foundation" required />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Name (Urdu) — اردو نام">
                  <RTLInput placeholder="قرآن فاؤنڈیشن" value={form.name_ur} onChange={set('name_ur')} />
                </Field>
                <Field label="Name (Arabic) — الاسم بالعربية">
                  <RTLInput placeholder="مؤسسة القرآن" value={form.name_ar} onChange={set('name_ar')} />
                </Field>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--sand-mid)', margin: '4px 0 20px' }} />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
                <Field label="Contact email">
                  <input className="f-input" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder="info@example.org" />
                </Field>
                <Field label="Contact phone">
                  <input className="f-input" type="tel" value={form.contact_phone} onChange={set('contact_phone')} placeholder="+9221..." />
                </Field>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
              </div>
            </form>
          </CardBody>
        </Card>

        {/* Logo placeholder */}
        <Card>
          <CardHeader><span className="card-title">Logo</span></CardHeader>
          <CardBody>
            <div style={{ border: '2px dashed var(--sand-deep)', borderRadius: 'var(--radius-md)', padding: '32px 24px', textAlign: 'center', color: 'var(--ink-pale)' }}>
              <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>⊙</div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Logo upload</div>
              <div style={{ fontSize: 12 }}>File upload will be available once a storage backend is configured.</div>
              {form.logo_url && (
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--emerald)' }}>
                  Current: {form.logo_url}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
