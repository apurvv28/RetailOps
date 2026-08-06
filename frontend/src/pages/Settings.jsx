import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Settings as SettingsIcon, Globe, Bell, User } from 'lucide-react';

export const Settings = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-1 mb-8">
        <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Configure dashboard preferences and API connections.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-slate-500" />
              <CardTitle>API Connection</CardTitle>
            </div>
            <CardDescription>Backend serving service integration parameters.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base URL</label>
              <input 
                type="text" 
                defaultValue={import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080'}
                disabled
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
              <input 
                type="password" 
                defaultValue="****************"
                disabled
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">Configured via environment variables.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-slate-500" />
              <CardTitle>Dashboard Preferences</CardTitle>
            </div>
            <CardDescription>UI polling and theme behavior.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Auto Refresh</label>
                <p className="text-xs text-slate-500">Poll backend for new predictions</p>
              </div>
              <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input type="checkbox" name="toggle" id="toggle" checked disabled className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-not-allowed checked:right-0 checked:border-sky-500"/>
                <label htmlFor="toggle" className="toggle-label block overflow-hidden h-5 rounded-full bg-slate-300 cursor-not-allowed"></label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Refresh Interval (ms)</label>
              <input 
                type="text" 
                defaultValue={import.meta.env.VITE_REFRESH_INTERVAL || '5000'}
                disabled
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-500 cursor-not-allowed"
              />
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
};
