import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '../services/api';
import { ShieldCheck, Sprout, Cpu, ArrowRight, Lock, UserCheck, AlertCircle, ExternalLink } from 'lucide-react';
import Swal from 'sweetalert2';

export const Login = () => {
  const { user, demoLogin, loginWithGoogle, saveSession } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedRole, setSelectedRole] = useState('farmer');

  // Auto-redirect if already logged in
  useEffect(() => {
    if (user && !searchParams.get('token')) {
      const targetPath = user.role === 'admin' ? '/admin' : '/farmer/irrigation';
      navigate(targetPath, { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Handle URL callback token from OAuth Redirect flow
  useEffect(() => {
    const token = searchParams.get('token');
    const userStr = searchParams.get('user');

    if (token && userStr) {
      try {
        let parsedUser;
        try {
          parsedUser = JSON.parse(userStr);
        } catch {
          parsedUser = JSON.parse(decodeURIComponent(userStr));
        }

        saveSession(token, parsedUser);
        Swal.fire({
          title: 'Google OAuth Verified!',
          text: `Welcome back, ${parsedUser.name}! (${parsedUser.role.toUpperCase()} Portal)`,
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
        const targetPath = parsedUser.role === 'admin' ? '/admin' : '/farmer/irrigation';
        navigate(targetPath, { replace: true });
      } catch (err) {
        console.error('URL auth parse error:', err);
      }
    }
  }, [searchParams, navigate, saveSession]);



  const handleGoogleRedirectLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await AuthService.getGoogleAuthUrl(selectedRole);
      if (data?.auth_url) {
        window.location.href = data.auth_url;
      }
    } catch (err) {
      setError('Could not initiate Google OAuth redirect flow.');
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setLoading(true);
    setError(null);
    try {
      if (!credentialResponse.credential) {
        throw new Error('Google did not return a valid credential token.');
      }
      const loggedUser = await loginWithGoogle(credentialResponse.credential, selectedRole);
      Swal.fire({
        title: 'Google OAuth Verified!',
        text: `Welcome back, ${loggedUser.name}! (${loggedUser.role.toUpperCase()} Portal)`,
        icon: 'success',
        timer: 1800,
        showConfirmButton: false
      });
      if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/farmer/irrigation');
      }
    } catch (err) {
      console.error('Google OAuth backend verification error:', err);
      const detailMsg = err.response?.data?.detail || 'Failed to authenticate Google account with CockroachDB backend.';
      setError(detailMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google OAuth popup encountered origin_mismatch or was cancelled. Use Redirect OAuth below.');
  };

  const handleDemoLogin = async (role) => {
    setLoading(true);
    setError(null);
    try {
      const loggedUser = await demoLogin(role);
      if (loggedUser.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/farmer/irrigation');
      }
    } catch (err) {
      setError('Demo login failed. Please check backend server status.');
    } finally {
      setLoading(false);
    }
  };

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
            Google OAuth 2.0 & CockroachDB RBAC Portal
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

          {/* Role Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Select Portal Account Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950/60 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedRole('farmer')}
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
                onClick={() => setSelectedRole('admin')}
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

          {/* Primary Google OAuth Login */}
          <div className="flex flex-col items-center justify-center pt-2 space-y-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="filled_blue"
              shape="pill"
              size="large"
              text="continue_with"
              locale="en"
              width="100%"
            />
            
            <button
              onClick={handleGoogleRedirectLogin}
              disabled={loading}
              className="text-xs text-slate-400 hover:text-slate-200 underline flex items-center gap-1 transition-colors pt-1"
            >
              <span>Alternative Google OAuth Redirect</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>


        {/* Footer Security Badges */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>CockroachDB RBAC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Google OAuth 2.0</span>
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
