import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useUser } from '@clerk/react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Sprout, Cpu, Lock, UserCheck, AlertCircle } from 'lucide-react';

export const Login = () => {
  const { user, loading, setSelectedRole, syncClerkUser } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const [selectedRole, setRole] = useState(() => localStorage.getItem('agritech_selected_role') || 'farmer');
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const handleRoleChange = (role) => {
    setRole(role);
    setSelectedRole(role);
  };

  // Auto-redirect if user is already authenticated with backend
  useEffect(() => {
    if (user && !loading) {
      const targetPath = user.role === 'admin' ? '/admin' : '/farmer/irrigation';
      navigate(targetPath, { replace: true });
    }
  }, [user, loading, navigate]);

  // When Clerk signs in but backend hasn't synced yet, trigger sync
  useEffect(() => {
    if (isLoaded && isSignedIn && !user && !loading && !syncing) {
      setSyncing(true);
      setError(null);
      syncClerkUser(selectedRole)
        .then((backendUser) => {
          const targetPath = backendUser.role === 'admin' ? '/admin' : '/farmer/irrigation';
          navigate(targetPath, { replace: true });
        })
        .catch((err) => {
          console.error('Backend sync error:', err);
          setError('Failed to sync your account with the backend. Please try again.');
        })
        .finally(() => setSyncing(false));
    }
  }, [isLoaded, isSignedIn, user, loading, syncing, syncClerkUser, selectedRole, navigate]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center relative overflow-hidden p-4">
      {/* Background Glow & Ambient Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl mb-4 shadow-lg shadow-emerald-500/5">
            <Sprout className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
            AgriTech Intelligence
          </h1>
          <p className="text-slate-400 text-sm">
            Clerk Auth & AWS DynamoDB RBAC Portal
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-400 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {syncing && (
            <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center gap-3 text-cyan-400 text-sm">
              <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Syncing your account with KrishiLoop backend...</span>
            </div>
          )}

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Portal Account Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => handleRoleChange('farmer')}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  selectedRole === 'farmer'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sprout className="w-4 h-4" />
                Farmer
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`py-2.5 px-3 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  selectedRole === 'admin'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-4 h-4" />
                Admin
              </button>
            </div>
          </div>

          {/* Clerk Sign-In Component */}
          <div className="flex flex-col items-center justify-center pt-2">
            <SignIn
              routing="hash"
              appearance={{
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none border-none p-0 w-full',
                  headerTitle: 'text-white',
                  headerSubtitle: 'text-slate-400',
                  socialButtonsBlockButton: 'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
                  socialButtonsBlockButtonText: 'text-white',
                  dividerLine: 'bg-slate-700',
                  dividerText: 'text-slate-500',
                  formFieldLabel: 'text-slate-300',
                  formFieldInput: 'bg-slate-800 border-slate-700 text-white',
                  formButtonPrimary: 'bg-emerald-600 hover:bg-emerald-500',
                  footerActionLink: 'text-emerald-400 hover:text-emerald-300',
                  identityPreviewText: 'text-white',
                  identityPreviewEditButton: 'text-emerald-400',
                  formFieldInputShowPasswordButton: 'text-slate-400',
                  footer: 'hidden'
                }
              }}
            />
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>AWS DynamoDB RBAC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Clerk Auth</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Isolated Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
