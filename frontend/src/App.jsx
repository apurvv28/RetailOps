import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DashboardProvider } from './context/DashboardContext';
import { DashboardLayout } from './layouts/DashboardLayout';
import { Loader } from './components/ui/Loader';

const Overview = React.lazy(() => import('./pages/Overview').then(m => ({ default: m.Overview })));
const LivePredictions = React.lazy(() => import('./pages/LivePredictions').then(m => ({ default: m.LivePredictions })));
const InputStream = React.lazy(() => import('./pages/InputStream').then(m => ({ default: m.InputStream })));
const Monitoring = React.lazy(() => import('./pages/Monitoring').then(m => ({ default: m.Monitoring })));
const Alerts = React.lazy(() => import('./pages/Alerts').then(m => ({ default: m.Alerts })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

const PageLoader = () => (
  <div className="h-[60vh] flex items-center justify-center">
    <Loader size={28} text="Loading page..." />
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <DashboardProvider>
        <Suspense fallback={
          <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19]">
            <Loader size={36} text="Starting Retail Ops Intelligence..." />
          </div>
        }>
          <Routes>
            <Route path="/" element={<DashboardLayout />}>
              <Route index element={<Suspense fallback={<PageLoader />}><Overview /></Suspense>} />
              <Route path="predictions" element={<Suspense fallback={<PageLoader />}><LivePredictions /></Suspense>} />
              <Route path="stream" element={<Suspense fallback={<PageLoader />}><InputStream /></Suspense>} />


              <Route path="monitoring" element={<Suspense fallback={<PageLoader />}><Monitoring /></Suspense>} />
              <Route path="alerts" element={<Suspense fallback={<PageLoader />}><Alerts /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </DashboardProvider>
    </BrowserRouter>
  );
}

export default App;
