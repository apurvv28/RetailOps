import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { KrishiMitraAssistant } from '../components/assistant/KrishiMitraAssistant';

export const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen w-full flex bg-[#F4F6F4] dark:bg-[#0E1411] text-slate-900 dark:text-slate-100 overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Full Height, Sticky) */}
      <Sidebar isOpen={sidebarOpen} setisOpen={setSidebarOpen} />
      
      {/* Main Content Area (Full Screen width/height, Zero Outer Margin) */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Navbar setSidebarOpen={setSidebarOpen} />
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8">
          <div className="w-full">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Floating Multi-Lingual AI Assistant */}
      <KrishiMitraAssistant />
    </div>
  );
};

export default DashboardLayout;
