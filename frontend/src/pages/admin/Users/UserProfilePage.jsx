import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../../../components/LoadingSpinner';
import PageHeader from '../../../components/PageHeader';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import { getUser, updateProfile, changePassword } from '../../../api/users';
import UserProfileTabs from './UserProfileTabs';

export default function UserProfilePage() {
  const { userId: paramUserId } = useParams();
  const { user: authUser, role } = useAuth();
  const userId = paramUserId || authUser?.id;
  const isOwnProfile = userId === authUser?.id;

  const qc = useQueryClient();
  const toast = useToast();

  const { data: user, isLoading } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUser(userId),
    staleTime: 60_000,
    enabled: !!userId,
  });

  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form State
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [qualification, setQualification] = useState('');
  const [occupation, setOccupation] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [address, setAddress] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  
  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (user) {
      setPhone(user.phone || '');
      setWhatsapp(user.whatsapp || '');
      const meta = typeof user.metadata === 'string' ? JSON.parse(user.metadata || '{}') : (user.metadata || {});
      setQualification(meta.qualification || '');
      setOccupation(meta.occupation || '');
      setMaritalStatus(meta.maritalStatus || meta.marital_status || '');
      setAddress(meta.address || '');
    }
  }, [user]);

  const updateProfileMutation = useMutation({
    mutationFn: (formData) => updateProfile(userId, formData),
    onSuccess: () => {
      toast.success('Profile updated successfully');
      qc.invalidateQueries(['user', userId]);
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to update profile');
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data) => changePassword(userId, data),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.error?.message || 'Failed to change password');
    }
  });

  const handleProfileSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('phone', phone);
    formData.append('whatsapp', whatsapp);
    formData.append('qualification', qualification);
    formData.append('occupation', occupation);
    formData.append('marital_status', maritalStatus);
    formData.append('address', address);
    if (profilePicture) {
      formData.append('profile_picture', profilePicture);
    }
    updateProfileMutation.mutate(formData);
  };

  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    changePasswordMutation.mutate({ current_password: currentPassword, new_password: newPassword });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <LoadingSpinner size={28} />
      </div>
    );
  }

  const meta = typeof user?.metadata === 'string' ? JSON.parse(user.metadata || '{}') : (user?.metadata || {});
  const avatarUrl = meta.profile_picture || null;
  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

  return (
    <div>
      <PageHeader title={isOwnProfile ? "My Profile Settings" : "User Profile"} />
      
      {paramUserId && <UserProfileTabs userId={userId} />}

      <div style={{ display: 'flex', gap: 24, flexDirection: 'column', marginTop: 24 }}>
        
        {/* Header summary */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--emerald-light)', color: 'var(--emerald)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
              {initials}
            </div>
          )}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--ink)', marginBottom: 4 }}>
              {user?.full_name ?? '—'}
            </h2>
            {user?.full_name_ur && (
              <div style={{ fontSize: 16, fontFamily: 'var(--font-display)', direction: 'rtl', color: 'var(--ink-soft)', marginBottom: 4 }}>
                {user.full_name_ur}
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--ink-pale)', textTransform: 'capitalize' }}>
              {user?.role?.replace('_', ' ')} · {user?.preferred_lang?.toUpperCase() ?? 'EN'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--sand-mid)' }}>
          <button
            onClick={() => setActiveTab('profile')}
            style={{
              padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === 'profile' ? '2px solid var(--emerald)' : '2px solid transparent',
              color: activeTab === 'profile' ? 'var(--emerald)' : 'var(--ink-muted)',
              fontWeight: activeTab === 'profile' ? 600 : 400,
            }}
          >
            Personal Details
          </button>
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('security')}
              style={{
                padding: '12px 24px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: activeTab === 'security' ? '2px solid var(--emerald)' : '2px solid transparent',
                color: activeTab === 'security' ? 'var(--emerald)' : 'var(--ink-muted)',
                fontWeight: activeTab === 'security' ? 600 : 400,
              }}
            >
              Security
            </button>
          )}
        </div>

        {activeTab === 'profile' && (
          <form onSubmit={handleProfileSubmit} style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
            <div className="field">
              <label>Phone</label>
              <input type="text" value={phone} onChange={e => setPhone(e.target.value)} required />
            </div>
            <div className="field">
              <label>WhatsApp</label>
              <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>
            <div className="field">
              <label>Qualification</label>
              <select value={qualification} onChange={(e) => setQualification(e.target.value)}>
                <option value="">— Select —</option>
                <option value="Matric">Matric</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Bachelors">Bachelors</option>
                <option value="Masters">Masters</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Occupation</label>
              <select value={occupation} onChange={(e) => setOccupation(e.target.value)}>
                <option value="">— Select —</option>
                <option value="Student">Student</option>
                <option value="Employee">Employee</option>
                <option value="Business">Business</option>
                <option value="Unemployed">Unemployed</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Marital Status</label>
              <select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)}>
                <option value="">— Select —</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div className="field">
              <label>Update Profile Picture</label>
              <input type="file" accept="image/*" onChange={e => setProfilePicture(e.target.files[0])} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Address</label>
              <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} />
            </div>
            
            <div style={{ gridColumn: 'span 2', textAlign: 'right', marginTop: 12 }}>
              <button type="submit" disabled={updateProfileMutation.isPending} style={{ padding: '10px 24px', background: 'var(--emerald)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        )}

        {activeTab === 'security' && isOwnProfile && (
          <form onSubmit={handlePasswordSubmit} style={{ background: 'var(--white)', padding: 24, borderRadius: 'var(--radius-lg)', border: '1px solid var(--sand-mid)', maxWidth: 500 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16 }}>Change Password</h3>
            <div className="field" style={{ marginBottom: 16 }}>
              <label>Current Password</label>
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="field" style={{ marginBottom: 24 }}>
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} required />
            </div>
            <div style={{ textAlign: 'right' }}>
              <button type="submit" disabled={changePasswordMutation.isPending} style={{ padding: '10px 24px', background: 'var(--emerald)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' }}>
                {changePasswordMutation.isPending ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
