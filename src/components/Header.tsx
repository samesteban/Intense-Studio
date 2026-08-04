/**
 * Header Component with Offline Status, Intense Studio Branding and Navigation
 */
import React from 'react';
import { WifiOff, Lock, Home } from 'lucide-react';
import { IntenseLogo } from './IntenseLogo';

interface HeaderProps {
  isOnline: boolean;
  pendingSyncCount: number;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onResetData: () => void;
  onSync: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isOnline,
  pendingSyncCount,
  activeTab,
  setActiveTab,
  onResetData,
  onSync
}) => {
  const currentDate = new Date().toLocaleDateString('es-CL', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const navItems = [
    { id: 'home', label: 'Inicio', icon: Home },
    { id: 'students', label: 'Alumnos', icon: null },
    { id: 'schedule', label: 'Agenda & Clases', icon: null },
    { id: 'reports', label: 'Asistencia', icon: null },
    { id: 'payments', label: 'Finanzas', icon: Lock }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-2xl">
      {/* Top Banner for Offline Mode */}
      {!isOnline && (
        <div className="bg-amber-500/10 border-b border-amber-500/30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium">
              <WifiOff className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>MODO OFFLINE ACTIVO: Los datos se guardan localmente y se sincronizarán al reconectar.</span>
            </div>
            {pendingSyncCount > 0 && (
              <button
                onClick={onSync}
                className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded text-[11px] hover:bg-amber-400 transition"
              >
                Sincronizar {pendingSyncCount} cambios pendientes
              </button>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <IntenseLogo className="h-7 sm:h-9 text-white" />
        </div>

        {/* Date and Network & Sync Status Badge */}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="text-xs text-slate-400 capitalize font-medium">
            {currentDate}
          </span>

          {/* Online/Offline Indicator */}
          {isOnline ? (
            <div
              className="flex items-center justify-center p-2 rounded-lg border border-emerald-500/40 bg-emerald-950/80"
              title="En Línea"
            >
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-950/80 text-amber-400 text-xs font-semibold"
              title="Sin conexión"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span>Offline ({pendingSyncCount})</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="bg-slate-950 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto py-2 no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#7628A6] text-white shadow-lg shadow-[#7628A6]/30 scale-[1.02]'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

