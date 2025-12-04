import React, { useState, useEffect } from 'react';
import { AppProvider, useAppStore } from './store';
import { MapTab } from './components/MapTab';
import { Backoffice } from './components/Backoffice';
import { DataTab } from './components/DataTab';
import { DashboardTab } from './components/DashboardTab';
import { PlanningTab } from './components/PlanningTab';
import { Login } from './components/Login';
import { Map, Database, Settings, LayoutDashboard, Calendar, LogOut, User, UserCircle, Zap, Star, MapPin, Layers, Search, AlertTriangle, Wrench, Truck } from 'lucide-react';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from './components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import { ToastProvider } from './components/ui/use-toast';
import { Toaster } from './components/ui/toaster';
import { hexToTailwindHsl } from './lib/utils';
import { useTranslation } from './hooks/useTranslation';
import { ViewTab } from './types';

const ThemeEffect = () => {
  const { preferences } = useAppStore();

  useEffect(() => {
    const root = window.document.documentElement;

    // Apply Dark Mode
    root.classList.remove('light', 'dark');
    if (preferences.theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(preferences.theme);
    }

    // Apply Primary Color
    // We convert Hex to HSL format required by the tailwind variable configuration
    const hsl = hexToTailwindHsl(preferences.primaryColor);
    root.style.setProperty('--primary', hsl);
    
    // Optionally set a ring color to match
    root.style.setProperty('--ring', hsl);

  }, [preferences]);

  return null;
};

// Helper for Icon Rendering (duplicated from Backoffice for simplicity in this file)
const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
  const icons: Record<string, any> = { Zap, Star, MapIcon: Map, MapPin, Layers, Search, AlertTriangle, Tool: Wrench, Truck };
  const LucideIcon = icons[name] || Zap;
  return <LucideIcon className={className} />;
};

function AppContent({ onLogout }: { onLogout: () => void }) {
  const { activeTab, setActiveTab, shortcuts, executeShortcut, setCurrentUser, hasPermission } = useAppStore();
  const { t } = useTranslation();

  const handleLogout = () => {
    setCurrentUser(null);
    onLogout();
  };

  const renderContent = () => {
    // Basic protection if user manually sets tab state but lacks permission
    if (activeTab === 'map' && !hasPermission('view_map')) return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;
    if (activeTab === 'data' && !hasPermission('view_data')) return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;
    if (activeTab === 'dashboard' && !hasPermission('view_dashboard')) return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;
    if (activeTab === 'planning' && !hasPermission('view_planning')) return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;
    
    // Settings has internal checks, but we can block top level
    if (activeTab === 'settings' && !hasPermission('sys_admin') && !hasPermission('manage_schemas') && !hasPermission('manage_users')) {
        return <div className="p-8 text-center text-muted-foreground">Access Denied</div>;
    }

    switch(activeTab) {
      case 'map': return <MapTab />;
      case 'data': return <DataTab />;
      case 'dashboard': return <DashboardTab />;
      case 'planning': return <PlanningTab />;
      case 'settings': return <Backoffice />;
      case 'profile': return <UserProfileView />;
      default: return <MapTab />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      {/* Sidebar Navigation */}
      <nav className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-8 z-[2000] shrink-0">
        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/50 cursor-pointer" onClick={() => setActiveTab('map')}>
          <span className="text-primary-foreground font-bold text-xl">G</span>
        </div>

        <div className="flex-1 flex flex-col w-full gap-4">
          {hasPermission('view_map') && (
            <NavButton icon={<Map />} label={t('nav.map')} active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
          )}
          {hasPermission('view_data') && (
            <NavButton icon={<Database />} label={t('nav.data')} active={activeTab === 'data'} onClick={() => setActiveTab('data')} />
          )}
          {hasPermission('view_dashboard') && (
            <NavButton icon={<LayoutDashboard />} label={t('nav.dash')} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          )}
          {hasPermission('view_planning') && (
            <NavButton icon={<Calendar />} label={t('nav.plan')} active={activeTab === 'planning'} onClick={() => setActiveTab('planning')} />
          )}
          
          {/* Quick Actions Menu */}
          <div className="w-full flex justify-center mt-2">
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                 <button className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/20 transition-all">
                   <Zap className="w-5 h-5" />
                 </button>
               </DropdownMenuTrigger>
               <DropdownMenuContent side="right" align="start" className="w-64 ml-3 mb-2 p-2">
                  <DropdownMenuLabel className="text-xs uppercase text-muted-foreground tracking-wider">{t('shortcuts.quick_actions')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {shortcuts.length === 0 && <div className="text-xs text-muted-foreground p-2 italic">{t('shortcuts.no_config')}</div>}
                  {shortcuts.map(s => (
                    <DropdownMenuItem key={s.id} onClick={() => executeShortcut(s)} className="flex items-center gap-3 p-2 cursor-pointer">
                       <div className="w-6 h-6 rounded flex items-center justify-center text-white" style={{ backgroundColor: s.color }}>
                         <IconRenderer name={s.icon} className="w-3 h-3" />
                       </div>
                       <span className="font-medium">{s.name}</span>
                    </DropdownMenuItem>
                  ))}
               </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-6 w-full items-center">
          {(hasPermission('sys_admin') || hasPermission('manage_schemas') || hasPermission('manage_users')) && (
             <NavButton icon={<Settings />} label={t('nav.config')} active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-200 hover:border-primary hover:text-primary transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-slate-900">
                <User className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-56 ml-3 mb-2">
              <DropdownMenuLabel>{t('menu.account')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveTab('profile')}>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>{t('menu.profile')}</span>
              </DropdownMenuItem>
              {(hasPermission('sys_admin') || hasPermission('manage_schemas') || hasPermission('manage_users')) && (
                  <DropdownMenuItem onClick={() => setActiveTab('settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>{t('menu.settings')}</span>
                  </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>{t('menu.logout')}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full relative bg-slate-50 dark:bg-slate-950 overflow-hidden text-foreground">
        {renderContent()}
        <Toaster />
      </main>
    </div>
  );
}

const NavButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={`group relative flex items-center justify-center w-full h-12 transition-all duration-200
      ${active ? 'text-primary' : 'text-slate-400 hover:text-slate-200'}
    `}
  >
    <div className={`absolute left-0 w-1 h-8 bg-primary rounded-r-full transition-all duration-300 ${active ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
    <div className="w-6 h-6">{icon}</div>
    <span className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
      {label}
    </span>
  </button>
);

const UserProfileView = () => {
  const { t } = useTranslation();
  const { currentUser } = useAppStore();

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('profile.title')}</h1>
        <p className="text-muted-foreground mt-2">{t('profile.subtitle')}</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('profile.info')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('profile.username')}</Label>
                <Input defaultValue={currentUser?.username} readOnly />
              </div>
              <div className="space-y-2">
                <Label>{t('profile.email')}</Label>
                <Input defaultValue={currentUser?.email} readOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.prefs')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <Label>{t('profile.notifs')}</Label>
                <p className="text-sm text-muted-foreground">{t('profile.notifs_desc')}</p>
              </div>
              <Button variant="outline" size="sm">{t('profile.enabled')}</Button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div className="space-y-0.5">
                <Label>{t('profile.2fa')}</Label>
                <p className="text-sm text-muted-foreground">{t('profile.2fa_desc')}</p>
              </div>
              <Button variant="outline" size="sm" className="text-primary border-primary/20 hover:bg-primary/10">{t('profile.enable')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <AppProvider>
      <ThemeEffect />
      <ToastProvider>
        {isAuthenticated ? (
          <AppContent onLogout={() => setIsAuthenticated(false)} />
        ) : (
          <Login onLogin={() => setIsAuthenticated(true)} />
        )}
      </ToastProvider>
    </AppProvider>
  );
}