import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { FarmerLayout } from './layouts/FarmerLayout';
import { Login } from './pages/Login';
import { Loader } from './components/ui/Loader';

// Lazy Admin Pages
const Overview = React.lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })));
const LivePredictions = React.lazy(() => import('./pages/LivePredictions').then(m => ({ default: m.LivePredictions })));
const InputStream = React.lazy(() => import('./pages/InputStream').then(m => ({ default: m.InputStream })));
const Monitoring = React.lazy(() => import('./pages/Monitoring').then(m => ({ default: m.Monitoring })));
const Alerts = React.lazy(() => import('./pages/Alerts').then(m => ({ default: m.Alerts })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// Lazy Farmer Pages
const SoilIrrigation = React.lazy(() => import('./pages/farmer/SoilIrrigation').then(m => ({ default: m.SoilIrrigation })));
const CropRecommendation = React.lazy(() => import('./pages/farmer/CropRecommendation').then(m => ({ default: m.CropRecommendation })));
const FertilizerRecommendation = React.lazy(() => import('./pages/farmer/FertilizerRecommendation').then(m => ({ default: m.FertilizerRecommendation })));
const YieldPrediction = React.lazy(() => import('./pages/farmer/YieldPrediction').then(m => ({ default: m.YieldPrediction })));
const FarmerProfile = React.lazy(() => import('./pages/farmer/FarmerProfile').then(m => ({ default: m.FarmerProfile })));

const PageLoader = () => (
  <div className="h-[60vh] flex items-center justify-center">
    <Loader size={28} text="Loading module..." />
  </div>
);

// Protected Route wrappers
const RequireAuth = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader size={36} text="Verifying authentication..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If farmer tries to visit admin routes, redirect to farmer dashboard
    if (user.role === 'farmer') {
      return <Navigate to="/farmer/irrigation" replace />;
    }
  }

  return children;
};

// Root index redirect based on user role
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/farmer/irrigation" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DashboardProvider>
          <Suspense fallback={
            <div className="h-screen w-screen flex items-center justify-center bg-slate-950">
              <Loader size={36} text="Loading AgriTech Intelligence Platform..." />
            </div>
          }>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Root Index Redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Admin Dashboard Routes (Admin Role Only) */}
              <Route path="/admin" element={
                <RequireAuth allowedRoles={['admin']}>
                  <DashboardLayout />
                </RequireAuth>
              }>
                <Route index element={<Suspense fallback={<PageLoader />}><Overview /></Suspense>} />
                <Route path="predictions" element={<Suspense fallback={<PageLoader />}><LivePredictions /></Suspense>} />
                <Route path="stream" element={<Suspense fallback={<PageLoader />}><InputStream /></Suspense>} />
                <Route path="monitoring" element={<Suspense fallback={<PageLoader />}><Monitoring /></Suspense>} />
                <Route path="alerts" element={<Suspense fallback={<PageLoader />}><Alerts /></Suspense>} />
                <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              </Route>

              {/* Farmer Dashboard Routes (Farmer and Admin Roles) */}
              <Route path="/farmer" element={
                <RequireAuth allowedRoles={['farmer', 'admin']}>
                  <FarmerLayout />
                </RequireAuth>
              }>
                <Route index element={<Navigate to="irrigation" replace />} />
                <Route path="irrigation" element={<Suspense fallback={<PageLoader />}><SoilIrrigation /></Suspense>} />
                <Route path="crop" element={<Suspense fallback={<PageLoader />}><CropRecommendation /></Suspense>} />
                <Route path="fertilizer" element={<Suspense fallback={<PageLoader />}><FertilizerRecommendation /></Suspense>} />
                <Route path="yield" element={<Suspense fallback={<PageLoader />}><YieldPrediction /></Suspense>} />
                <Route path="profile" element={<Suspense fallback={<PageLoader />}><FarmerProfile /></Suspense>} />
              </Route>

              {/* Fallback Catch-all Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </DashboardProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
