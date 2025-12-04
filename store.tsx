import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { TableSchema, DataRecord, User, UserRole, AppPreferences, ViewTab, MapToolMode, Shortcut, DashboardSchema, CalendarSchema, Permission, MapConfig } from './types';
import { INITIAL_SCHEMAS, INITIAL_USERS, INITIAL_ROLES, DEFAULT_PREFERENCES, INITIAL_RECORDS, INITIAL_SHORTCUTS, LANGUAGES, INITIAL_DASHBOARDS, INITIAL_CALENDARS, INITIAL_MAP_CONFIG } from './constants';

interface AppState {
  schemas: TableSchema[];
  records: DataRecord[];
  users: User[];
  roles: UserRole[];
  shortcuts: Shortcut[];
  dashboards: DashboardSchema[];
  calendars: CalendarSchema[];
  mapConfig: MapConfig;
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  preferences: AppPreferences;
  
  // Navigation State
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;

  // Map State
  mapState: {
    activeLayerId: string | null;
    toolMode: MapToolMode;
    visibleLayers: string[];
    hiddenSubLayers: Record<string, string[]>;
    layerOpacity: Record<string, number>;
    layerOrder: string[]; // Order of feature layers (Schema IDs)
    
    // Base Layer State
    visibleBaseLayers: string[]; // Ordered list of active base layer IDs
    baseLayerOpacity: Record<string, number>;

    filterPanelOpen: boolean;
    filterSchemaId: string | null;
    filterCriteria: Record<string, string>;
    center?: [number, number];
    zoom?: number;
    projection: string;
    featureDefaults?: Record<string, any>;
  };
  setMapState: (state: Partial<{ 
    activeLayerId: string | null; 
    toolMode: MapToolMode; 
    visibleLayers: string[];
    hiddenSubLayers: Record<string, string[]>;
    layerOpacity: Record<string, number>;
    layerOrder: string[];
    visibleBaseLayers: string[];
    baseLayerOpacity: Record<string, number>;
    filterPanelOpen: boolean;
    filterSchemaId: string | null;
    filterCriteria: Record<string, string>;
    center?: [number, number];
    zoom?: number;
    projection: string;
    featureDefaults?: Record<string, any>;
  }>) => void;

  // Data View State
  dataState: {
    activeTableId: string | null;
    searchQuery: string;
  };
  setDataState: (state: Partial<{ activeTableId: string | null; searchQuery: string }>) => void;

  // Dashboard State
  dashboardState: {
    activeDashboardId: string | null;
  };
  setDashboardState: (state: Partial<{ activeDashboardId: string | null }>) => void;

  addSchema: (schema: TableSchema) => void;
  updateSchema: (schema: TableSchema) => void;
  deleteSchema: (id: string) => void;
  
  addRecord: (record: DataRecord) => void;
  updateRecord: (record: DataRecord) => void;
  deleteRecord: (id: string) => void;

  addUser: (user: User) => void;
  updateUser: (user: User) => void;
  deleteUser: (id: string) => void;

  addRole: (role: UserRole) => void;
  updateRole: (role: UserRole) => void;
  deleteRole: (id: string) => void;

  addShortcut: (shortcut: Shortcut) => void;
  updateShortcut: (shortcut: Shortcut) => void;
  deleteShortcut: (id: string) => void;

  addDashboard: (dashboard: DashboardSchema) => void;
  updateDashboard: (dashboard: DashboardSchema) => void;
  deleteDashboard: (id: string) => void;

  addCalendar: (calendar: CalendarSchema) => void; 
  updateCalendar: (calendar: CalendarSchema) => void; 
  deleteCalendar: (id: string) => void; 

  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  updateMapConfig: (config: MapConfig) => void;
  
  // Helper to run shortcut
  executeShortcut: (shortcut: Shortcut) => void;
  
  // Auth Helper
  hasPermission: (permission: Permission) => boolean;
}

const AppContext = createContext<AppState | undefined>(undefined);

export const AppProvider = ({ children }: { children?: ReactNode }) => {
  const [schemas, setSchemas] = useState<TableSchema[]>(() => {
    const saved = localStorage.getItem('geo_schemas');
    return saved ? JSON.parse(saved) : INITIAL_SCHEMAS;
  });

  const [records, setRecords] = useState<DataRecord[]>(() => {
    const saved = localStorage.getItem('geo_records');
    return saved ? JSON.parse(saved) : INITIAL_RECORDS;
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('geo_users');
    return saved ? JSON.parse(saved) : INITIAL_USERS;
  });

  const [roles, setRoles] = useState<UserRole[]>(() => {
    const saved = localStorage.getItem('geo_roles');
    return saved ? JSON.parse(saved) : INITIAL_ROLES;
  });

  const [shortcuts, setShortcuts] = useState<Shortcut[]>(() => {
    const saved = localStorage.getItem('geo_shortcuts');
    return saved ? JSON.parse(saved) : INITIAL_SHORTCUTS;
  });

  const [dashboards, setDashboards] = useState<DashboardSchema[]>(() => {
    const saved = localStorage.getItem('geo_dashboards');
    return saved ? JSON.parse(saved) : INITIAL_DASHBOARDS;
  });

  const [calendars, setCalendars] = useState<CalendarSchema[]>(() => {
    const saved = localStorage.getItem('geo_calendars');
    return saved ? JSON.parse(saved) : INITIAL_CALENDARS;
  });

  const [mapConfig, setMapConfig] = useState<MapConfig>(() => {
    const saved = localStorage.getItem('geo_map_config');
    // Safety check for existing configs that might be corrupted or old
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed && Array.isArray(parsed.tileLayers)) {
                return parsed;
            }
        } catch (e) { console.error("Failed to parse map config", e); }
    }
    return INITIAL_MAP_CONFIG;
  });

  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    const saved = localStorage.getItem('geo_prefs');
    if (saved) {
      return JSON.parse(saved);
    }
    
    // Detect Browser Language
    const browserLang = navigator.language.split('-')[0];
    const isSupported = LANGUAGES.some(l => l.value === browserLang);
    
    return {
      ...DEFAULT_PREFERENCES,
      language: isSupported ? browserLang : DEFAULT_PREFERENCES.language
    };
  });

  // Navigation State
  const [activeTab, setActiveTab] = useState<ViewTab>('map');
  
  // Map State
  // Initialize visible layers based on schema config
  const initialMapSchemas = schemas
    .filter(s => s.geometryType !== 'none' && s.visibleInMap && (s.isDefaultVisibleInMap !== false))
    .map(s => s.id);

  // Derive initial base layers from config
  const initialBaseLayers = mapConfig.tileLayers
      .filter(l => l.isDefaultVisible)
      .map(l => l.id);
  
  // Fallback if none configured but layers exist (legacy or user disabled all)
  if (initialBaseLayers.length === 0 && mapConfig.tileLayers.length > 0) {
      initialBaseLayers.push(mapConfig.tileLayers[0].id);
  }

  const initialBaseOpacity = mapConfig.tileLayers.reduce((acc, l) => ({
      ...acc,
      [l.id]: l.defaultOpacity !== undefined ? l.defaultOpacity : 1
  }), {} as Record<string, number>);

  const [mapState, setMapStateRaw] = useState<{ 
    activeLayerId: string | null; 
    toolMode: MapToolMode; 
    visibleLayers: string[];
    hiddenSubLayers: Record<string, string[]>;
    layerOpacity: Record<string, number>;
    layerOrder: string[];
    visibleBaseLayers: string[];
    baseLayerOpacity: Record<string, number>;
    filterPanelOpen: boolean;
    filterSchemaId: string | null;
    filterCriteria: Record<string, string>;
    center?: [number, number];
    zoom?: number;
    projection: string;
    featureDefaults?: Record<string, any>;
  }>({
    activeLayerId: null,
    toolMode: 'select',
    visibleLayers: initialMapSchemas,
    hiddenSubLayers: {},
    layerOpacity: {},
    layerOrder: [], // Will be populated in components or effects if empty
    visibleBaseLayers: initialBaseLayers,
    baseLayerOpacity: initialBaseOpacity,
    filterPanelOpen: false,
    filterSchemaId: null,
    filterCriteria: {},
    featureDefaults: {},
    projection: 'EPSG:3857'
  });

  const setMapState = useCallback((updates: Partial<typeof mapState>) => {
    setMapStateRaw(prev => ({ ...prev, ...updates }));
  }, []);

  // Data View State
  const [dataState, setDataStateRaw] = useState<{ activeTableId: string | null; searchQuery: string }>({
    activeTableId: null,
    searchQuery: ''
  });
  
  const setDataState = useCallback((updates: Partial<{ activeTableId: string | null; searchQuery: string }>) => {
    setDataStateRaw(prev => ({ ...prev, ...updates }));
  }, []);

  // Dashboard State
  const [dashboardState, setDashboardStateRaw] = useState<{ activeDashboardId: string | null }>({
    activeDashboardId: null
  });

  const setDashboardState = useCallback((updates: Partial<{ activeDashboardId: string | null }>) => {
    setDashboardStateRaw(prev => ({ ...prev, ...updates }));
  }, []);


  // User Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    localStorage.setItem('geo_schemas', JSON.stringify(schemas));
  }, [schemas]);

  useEffect(() => {
    localStorage.setItem('geo_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('geo_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('geo_roles', JSON.stringify(roles));
  }, [roles]);

  useEffect(() => {
    localStorage.setItem('geo_shortcuts', JSON.stringify(shortcuts));
  }, [shortcuts]);

  useEffect(() => {
    localStorage.setItem('geo_dashboards', JSON.stringify(dashboards));
  }, [dashboards]);

  useEffect(() => {
    localStorage.setItem('geo_calendars', JSON.stringify(calendars));
  }, [calendars]);

  useEffect(() => {
    localStorage.setItem('geo_map_config', JSON.stringify(mapConfig));
  }, [mapConfig]);

  useEffect(() => {
    localStorage.setItem('geo_prefs', JSON.stringify(preferences));
  }, [preferences]);

  // Schema Actions
  const addSchema = useCallback((schema: TableSchema) => setSchemas(prev => [...prev, schema]), []);
  const updateSchema = useCallback((schema: TableSchema) => setSchemas(prev => prev.map(s => s.id === schema.id ? schema : s)), []);
  const deleteSchema = useCallback((id: string) => {
    setSchemas(prev => prev.filter(s => s.id !== id));
    setRecords(prev => prev.filter(r => r.tableId !== id));
    setDashboards(prev => prev.filter(d => d.tableId !== id));
    setCalendars(prev => prev.filter(c => c.tableId !== id));
  }, []);

  // Record Actions
  const addRecord = useCallback((record: DataRecord) => setRecords(prev => [...prev, record]), []);
  const updateRecord = useCallback((record: DataRecord) => setRecords(prev => prev.map(r => r.id === record.id ? record : r)), []);
  const deleteRecord = useCallback((id: string) => setRecords(prev => prev.filter(r => r.id !== id)), []);

  // User Actions
  const addUser = useCallback((user: User) => setUsers(prev => [...prev, user]), []);
  const updateUser = useCallback((user: User) => setUsers(prev => prev.map(u => u.id === user.id ? user : u)), []);
  const deleteUser = useCallback((id: string) => setUsers(prev => prev.filter(u => u.id !== id)), []);

  // Role Actions
  const addRole = useCallback((role: UserRole) => setRoles(prev => [...prev, role]), []);
  const updateRole = useCallback((role: UserRole) => setRoles(prev => prev.map(r => r.id === role.id ? role : r)), []);
  const deleteRole = useCallback((id: string) => setRoles(prev => prev.filter(r => r.id !== id)), []);

  // Shortcut Actions
  const addShortcut = useCallback((shortcut: Shortcut) => setShortcuts(prev => [...prev, shortcut]), []);
  const updateShortcut = useCallback((shortcut: Shortcut) => setShortcuts(prev => prev.map(s => s.id === shortcut.id ? shortcut : s)), []);
  const deleteShortcut = useCallback((id: string) => setShortcuts(prev => prev.filter(s => s.id !== id)), []);

  // Dashboard Actions
  const addDashboard = useCallback((dashboard: DashboardSchema) => setDashboards(prev => [...prev, dashboard]), []);
  const updateDashboard = useCallback((dashboard: DashboardSchema) => setDashboards(prev => prev.map(d => d.id === dashboard.id ? dashboard : d)), []);
  const deleteDashboard = useCallback((id: string) => setDashboards(prev => prev.filter(d => d.id !== id)), []);

  // Calendar Actions
  const addCalendar = useCallback((calendar: CalendarSchema) => setCalendars(prev => [...prev, calendar]), []);
  const updateCalendar = useCallback((calendar: CalendarSchema) => setCalendars(prev => prev.map(c => c.id === calendar.id ? calendar : c)), []);
  const deleteCalendar = useCallback((id: string) => setCalendars(prev => prev.filter(c => c.id !== id)), []);

  // Map Config Action
  const updateMapConfig = useCallback((config: MapConfig) => setMapConfig(config), []);

  // Preferences Action
  const updatePreferences = useCallback((prefs: Partial<AppPreferences>) => setPreferences(prev => ({ ...prev, ...prefs })), []);

  // Execution Logic
  const executeShortcut = useCallback((shortcut: Shortcut) => {
    switch(shortcut.type) {
      case 'map_preset':
         setActiveTab('map');
         const updates: any = {};
         if (shortcut.config.layers) {
           updates.visibleLayers = shortcut.config.layers;
         }
         if (shortcut.config.center) {
           updates.center = shortcut.config.center;
         }
         if (shortcut.config.zoom) {
           updates.zoom = shortcut.config.zoom;
         }
         setMapState(updates);
         break;

      case 'data_view':
         setActiveTab('data');
         setDataState({ 
           activeTableId: shortcut.config.tableId || null,
           searchQuery: shortcut.config.search || ''
         });
         break;

      case 'quick_add':
         setActiveTab('map');
         setMapState({
           activeLayerId: shortcut.config.targetTableId || null,
           toolMode: 'add',
           featureDefaults: shortcut.config.data || {} // Pass default values
         });
         break;
         
      case 'map_search':
         setActiveTab('map');
         setMapState({
           toolMode: 'filter',
           filterPanelOpen: true,
           filterSchemaId: shortcut.config.filterLayerId || null,
           filterCriteria: shortcut.config.filterCriteria || {}
         });
         // Ensure the target layer is visible
         if (shortcut.config.filterLayerId) {
            setMapStateRaw(prev => {
              const newLayers = new Set(prev.visibleLayers);
              newLayers.add(shortcut.config.filterLayerId!);
              return { ...prev, visibleLayers: Array.from(newLayers) };
            });
         }
         break;

      case 'dashboard_view':
         setActiveTab('dashboard');
         setDashboardState({
           activeDashboardId: shortcut.config.dashboardSchemaId || null
         });
         break;
    }
  }, [setActiveTab, setMapState, setDataState, setDashboardState]);

  // Authorization Check
  const hasPermission = useCallback((permission: Permission) => {
    if (!currentUser) return false;
    const role = roles.find(r => r.id === currentUser.roleId);
    if (!role) return false;
    
    // System Admins have all permissions implicit or explicit
    if (role.permissions.includes('sys_admin')) return true;
    
    return role.permissions.includes(permission);
  }, [currentUser, roles]);

  const contextValue = useMemo(() => ({ 
      schemas, records, users, roles, shortcuts, dashboards, calendars, mapConfig, currentUser, setCurrentUser, preferences,
      activeTab, setActiveTab,
      mapState, setMapState,
      dataState, setDataState,
      dashboardState, setDashboardState,
      addSchema, updateSchema, deleteSchema, 
      addRecord, updateRecord, deleteRecord,
      addUser, updateUser, deleteUser,
      addRole, updateRole, deleteRole,
      addShortcut, updateShortcut, deleteShortcut,
      addDashboard, updateDashboard, deleteDashboard,
      addCalendar, updateCalendar, deleteCalendar,
      updatePreferences, updateMapConfig, executeShortcut, hasPermission
    }), 
    [
      schemas, records, users, roles, shortcuts, dashboards, calendars, mapConfig, currentUser, preferences, activeTab, mapState, dataState, dashboardState,
      setMapState, setDataState, setDashboardState, addSchema, updateSchema, deleteSchema, 
      addRecord, updateRecord, deleteRecord, 
      addUser, updateUser, deleteUser, 
      addRole, updateRole, deleteRole,
      addShortcut, updateShortcut, deleteShortcut,
      addDashboard, updateDashboard, deleteDashboard,
      addCalendar, updateCalendar, deleteCalendar,
      updatePreferences, updateMapConfig, executeShortcut, hasPermission
    ]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore must be used within AppProvider");
  return context;
};