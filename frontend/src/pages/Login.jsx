import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignIn, useUser } from '@clerk/react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Lock, UserCheck, AlertCircle, ArrowLeft } from 'lucide-react';

export const Login = () => {
  const { user, loading, setSelectedRole, syncClerkUser, demoLogin } = useAuth();
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  const [selectedRole, setRole] = useState(() => localStorage.getItem('agritech_selected_role') || 'farmer');
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

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

  const handleDemoAccess = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      const loggedUser = await demoLogin(selectedRole);
      const targetPath = loggedUser.role === 'admin' ? '/admin' : '/farmer/irrigation';
      navigate(targetPath, { replace: true });
    } catch (err) {
      setError('Demo authentication could not be completed.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <main className="relative min-h-[100dvh] w-full overflow-y-auto bg-[#70b9cf] text-slate-900 font-sans selection:bg-[#000] selection:text-[#fff] flex flex-col justify-between">
      {/* Background Video — Identical to Landing Page */}
      <video
        className="fixed inset-0 w-full h-full object-cover object-center pointer-events-none z-0"
        src="/farm-video.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Subtle Readability Overlay */}
      <div className="fixed inset-0 bg-gradient-to-b from-white/10 via-black/15 to-black/45 z-[1] pointer-events-none" />

      {/* Minimalist Top Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2.5 text-black hover:opacity-80 transition-opacity cursor-pointer group"
        >
          {/* Landing page 3-bar icon */}
          <span className="inline-flex items-end justify-center gap-[3px] w-[30px] h-[30px]">
            <span className="w-[4px] h-[10px] rounded-full bg-black group-hover:scale-y-110 transition-transform" />
            <span className="w-[4px] h-[17px] rounded-full bg-black group-hover:scale-y-110 transition-transform" />
            <span className="w-[4px] h-[13px] rounded-full bg-black group-hover:scale-y-110 transition-transform" />
          </span>
          <span className="text-[21px] font-[800] tracking-[-0.03em] text-black">
            KrishiLoop
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-black/80 hover:text-black bg-white/70 hover:bg-white/90 backdrop-blur-md rounded-full border border-black/10 transition-all shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Home</span>
        </button>
      </header>

      {/* Center Auth Card — Clean Single-Layer Card Container */}
      <div className="relative z-10 w-full max-w-[420px] mx-auto px-4 py-4 flex flex-col items-center my-auto">
        {/* Editorial Eyebrow Tag */}
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-white/80 backdrop-blur-md border border-black/10 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 animate-pulse" />
          <span className="text-[11px] font-[800] tracking-[0.14em] uppercase text-black/90">
            Secure Platform Access
          </span>
        </div>

        {/* Headline matching landing page typography */}
        <h1 className="text-2xl sm:text-3xl font-[900] tracking-[-0.04em] text-black text-center mb-1 drop-shadow-sm">
          Welcome to KrishiLoop
        </h1>
        <p className="text-xs font-[600] text-black/85 text-center mb-5 max-w-xs drop-shadow-sm">
          Sign in to access precision agricultural intelligence, soil telemetry, and predictive advisories.
        </p>

        {/* Single Outer Frame with Seamless Integration */}
        <div className="w-full bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl p-5 shadow-[0_12px_36px_rgb(0,0,0,0.14)] space-y-3.5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {syncing && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-emerald-900 text-xs">
              <div className="w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span>Verifying session with AWS DynamoDB...</span>
            </div>
          )}

          {/* Account Type Selector — Minimalist Segmented Control */}
          <div>
            <label className="block text-[11px] font-[700] text-slate-500 uppercase tracking-[0.08em] mb-1.5">
              Select Account Portal
            </label>
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleRoleChange('farmer')}
                className={`py-2 px-3 rounded-lg text-xs font-[700] transition-all flex items-center justify-center gap-1.5 ${
                  selectedRole === 'farmer'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <span>Farmer Portal</span>
              </button>
              <button
                type="button"
                onClick={() => handleRoleChange('admin')}
                className={`py-2 px-3 rounded-lg text-xs font-[700] transition-all flex items-center justify-center gap-1.5 ${
                  selectedRole === 'admin'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-slate-600 hover:text-black'
                }`}
              >
                <span>Admin Suite</span>
              </button>
            </div>
          </div>

          {/* Clerk Interactive Sign-In Component — Perfectly Fit to Container */}
          <div className="w-full flex justify-center">
            <SignIn
              routing="hash"
              appearance={{
                variables: {
                  colorPrimary: '#000000',
                  colorBackground: 'transparent',
                  colorText: '#0f172a',
                  colorTextSecondary: '#64748b',
                  colorInputBackground: '#f8fafc',
                  colorInputText: '#0f172a',
                  borderRadius: '0.75rem',
                  fontFamily: 'inherit',
                },
                elements: {
                  rootBox: 'w-full m-0 p-0 shadow-none border-none',
                  cardBox: 'w-full m-0 p-0 shadow-none border-none',
                  card: 'w-full m-0 p-0 shadow-none border-none bg-transparent',
                  header: 'hidden',
                  headerTitle: 'hidden',
                  headerSubtitle: 'hidden',
                  formButtonPrimary: 'w-full bg-black hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl shadow-none transition-all',
                  socialButtonsBlockButton: 'w-full bg-slate-50 border border-slate-200 text-slate-800 hover:bg-slate-100 rounded-xl transition-all shadow-none py-2.5',
                  socialButtonsBlockButtonText: 'font-semibold text-slate-800',
                  formFieldInput: 'w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:border-black focus:ring-0 text-sm py-2 px-3',
                  formFieldLabel: 'text-xs font-semibold text-slate-600',
                  footerActionLink: 'text-black font-semibold hover:underline',
                  footerActionText: 'text-xs text-slate-500',
                  identityPreviewText: 'text-slate-800 font-medium',
                  dividerLine: 'bg-slate-200',
                  dividerText: 'text-slate-400 text-[10px] uppercase tracking-wider',
                  footer: 'pt-2',
                }
              }}
            />
          </div>

          {/* Quick Demo Access Fallback */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              disabled={demoLoading}
              onClick={handleDemoAccess}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-[700] bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-900 border border-slate-200 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-none"
            >
              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>
                {demoLoading
                  ? 'Connecting...'
                  : `Instant 1-Click Access as ${selectedRole === 'admin' ? 'Admin' : 'Farmer'}`}
              </span>
            </button>
          </div>
        </div>

        {/* Security Badges */}
        <div className="mt-5 flex items-center justify-center gap-4 text-[11px] font-[600] text-black/80 drop-shadow-sm">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-black" />
            <span>AWS DynamoDB</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-black" />
            <span>Clerk Security</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <span>FastAPI ML</span>
          </div>
        </div>
      </div>

      {/* Bottom Features Strip matching Landing Page bottomInfo */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-center sm:justify-between text-xs font-[700] text-black/80 tracking-[-0.01em]">
        <div className="hidden sm:flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black/60" /> AI Yield & Harvest
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black/60" /> Precision Irrigation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-black/60" /> Smart Soil Telemetry
          </span>
        </div>
        <div className="text-black/70 text-[11px]">
          © {new Date().getFullYear()} KrishiLoop Intelligence Suite. All rights reserved.
        </div>
      </footer>
    </main>
  );
};

export default Login;
