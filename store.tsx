
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { TableSchema, DataRecord, User, UserRole, AppPreferences, ViewTab, MapToolMode, Shortcut } from './types';
import { INITIAL_SCHEMAS, INITIAL_USERS, INITIAL_ROLES, DEFAULT_PREFERENCES, INITIAL_RECORDS, INITIAL_SHORTCUTS, LANGUAGES } from './constants';

interface AppState {
  schemas: TableSchema[];
  records: DataRecord[];
  users: User[];
  roles: UserRole[];
  shortcuts: Shortcut[];
  currentUser: User | null;
  preferences: AppPreferences;
  
  // Navigation State
  activeTab: ViewTab;
  setActiveTab: (tab: ViewTab) => void;

  // Map State
  mapState: {
    activeLayerId: string | null;
    toolMode: MapToolMode;
    visibleLayers: string[];
    // Filter State
    filterPanelOpen: boolean;
    filterSchemaId: string | null;
    filterCriteria: Record<string, string>;
    // View State
    center?: [number, number];
    zoom?: number;
    projection: string; // New projection state
    // Interaction Defaults
    featureDefaults?: Record<string, any>;
  };
  setMapState: (state: Partial<{ 
    activeLayerId: string | null; 
    toolMode: MapToolMode; 
    visibleLayers: string[];
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
    activeSchemaId: string | null;
  };
  setDashboardState: (state: Partial<{ activeSchemaId: string | null }>) => void;

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

  updatePreferences: (prefs: Partial<AppPreferences>) => void;
  
  // Helper to run shortcut
  executeShortcut: (shortcut: Shortcut) => void;
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

  const [mapState, setMapStateRaw] = useState<{ 
    activeLayerId: string | null; 
    toolMode: MapToolMode; 
    visibleLayers: string[];
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
    filterPanelOpen: false,
    filterSchemaId: null,
    filterCriteria: {},
    featureDefaults: {},
    projection: 'EPSG:3857' // Default Web Mercator
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
  const [dashboardState, setDashboardStateRaw] = useState<{ activeSchemaId: string | null }>({
    activeSchemaId: null
  });

  const setDashboardState = useCallback((updates: Partial<{ activeSchemaId: string | null }>) => {
    setDashboardStateRaw(prev => ({ ...prev, ...updates }));
  }, []);


  // In a real app, this would be managed by auth session
  const [currentUser] = useState<User | null>(users[0] || null);

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
    localStorage.setItem('geo_prefs', JSON.stringify(preferences));
  }, [preferences]);

  // Schema Actions
  const addSchema = useCallback((schema: TableSchema) => setSchemas(prev => [...prev, schema]), []);
  const updateSchema = useCallback((schema: TableSchema) => setSchemas(prev => prev.map(s => s.id === schema.id ? schema : s)), []);
  const deleteSchema = useCallback((id: string) => {
    setSchemas(prev => prev.filter(s => s.id !== id));
    setRecords(prev => prev.filter(r => r.tableId !== id));
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
           activeSchemaId: shortcut.config.dashboardSchemaId || null
         });
         break;
    }
  }, [setActiveTab, setMapState, setDataState, setDashboardState]);

  const contextValue = useMemo(() => ({ 
      schemas, records, users, roles, shortcuts, currentUser, preferences,
      activeTab, setActiveTab,
      mapState, setMapState,
      dataState, setDataState,
      dashboardState, setDashboardState,
      addSchema, updateSchema, deleteSchema, 
      addRecord, updateRecord, deleteRecord,
      addUser, updateUser, deleteUser,
      addRole, updateRole, deleteRole,
      addShortcut, updateShortcut, deleteShortcut,
      updatePreferences, executeShortcut
    }), 
    [
      schemas, records, users, roles, shortcuts, currentUser, preferences, activeTab, mapState, dataState, dashboardState,
      setMapState, setDataState, setDashboardState, addSchema, updateSchema, deleteSchema, 
      addRecord, updateRecord, deleteRecord, 
      addUser, updateUser, deleteUser, 
      addRole, updateRole, deleteRole,
      addShortcut, updateShortcut, deleteShortcut,
      updatePreferences, executeShortcut
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
