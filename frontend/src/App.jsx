import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DashboardProvider } from './context/DashboardContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { FarmerLayout } from './layouts/FarmerLayout';
import { Login } from './pages/Login';
import { Loader } from './components/ui/Loader';
//import { AnimatedFarmHero } from './AnimatedFarmHero';
import { AnimatedFarmHero } from "./components/ui/AnimatedFarmHero/AnimatedFarmHero";


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

// Shared Loading Fallback for Sub-routes
const PageLoader = () => (
  <div className="h-[60vh] flex items-center justify-center">
    <Loader size={28} text="Loading module..." />
  </div>
);

// Protected Route Wrapper
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
    if (user.role === 'farmer') {
      return <Navigate to="/farmer/irrigation" replace />;
    }
  }

  return children;
};

// Landing Page Hero Wrapper (Integrates with Router Navigation)
const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleGetStarted = () => {
    if (user) {
      navigate(user.role === "admin" ? "/admin" : "/farmer/irrigation");
    } else {
      navigate("/login");
    }
  };

  return (
    <AnimatedFarmHero
      badgeText="AI-POWERED AGRICULTURE"
      title="AI-powered agriculture"
      subtitle="for smarter farming"
      description="Turn agricultural data into smarter predictions, better decisions, and more efficient farming."
      primaryCtaText="Get Started"
      secondaryCtaText="Explore Platform"
      onGetStarted={handleGetStarted}
      
    />
  );
};

export default function App() {
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
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />

              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Admin Dashboard Routes */}
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

              {/* Farmer Dashboard Routes */}
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

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </DashboardProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}