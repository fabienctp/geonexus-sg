
import { TableSchema, UserRole, User, Permission, AppPreferences, DataRecord, Shortcut, DashboardSchema } from './types';

export const DEFAULT_MAP_CENTER: [number, number] = [48.8566, 2.3522]; // Paris
export const DEFAULT_ZOOM = 13;

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Checkbox' },
  { value: 'select', label: 'List' }, // Changed from Dropdown to List
];

export const GEO_TYPES = [
  { value: 'none', label: 'None (Table only)' },
  { value: 'point', label: 'Point (Marker)' },
  { value: 'line', label: 'Line (Path)' }, 
  { value: 'polygon', label: 'Polygon (Area)' },
  { value: 'mixed', label: 'Mixed Collection' },
];

export const MAP_DISPLAY_MODES = [
  { value: 'tooltip', label: 'Popup Tooltip' },
  { value: 'dialog', label: 'Modal Dialog' },
];

export const DIALOG_SIZE_PRESETS = [
  { value: 'small', label: 'Small (400px)' },
  { value: 'medium', label: 'Medium (Default)' },
  { value: 'large', label: 'Large (800px)' },
  { value: 'fullscreen', label: 'Fullscreen' },
  { value: 'custom', label: 'Custom Size' },
];

export const CALENDAR_VIEWS = [
  { value: 'dayGridMonth', label: 'Month View' },
  { value: 'timeGridWeek', label: 'Week View' },
  { value: 'timeGridDay', label: 'Day View' },
  { value: 'listWeek', label: 'List View' },
];

export const TIME_ZONES = [
  { value: 'local', label: 'Local System Time' },
  { value: 'UTC', label: 'Coordinated Universal Time (UTC)' },
];

export const SHORTCUT_TYPES = [
  { value: 'map_preset', label: 'Map Preset (Layers & View)' },
  { value: 'data_view', label: 'Data Filter View' },
  { value: 'quick_add', label: 'Quick Add Feature' },
  { value: 'map_search', label: 'Map Search / Filter' },
  { value: 'dashboard_view', label: 'Open Dashboard' },
];

export const SHORTCUT_ICONS = [
  { value: 'Zap', label: 'Lightning' },
  { value: 'Star', label: 'Star' },
  { value: 'MapPin', label: 'Pin' },
  { value: 'Layers', label: 'Layers' },
  { value: 'Search', label: 'Search' },
  { value: 'AlertTriangle', label: 'Alert' },
  { value: 'Tool', label: 'Tool' },
  { value: 'Truck', label: 'Truck' },
];

export const PERMISSIONS_LIST: { value: Permission; label: string; description: string }[] = [
  { value: 'sys_admin', label: 'System Administrator', description: 'Full access to all settings and configurations.' },
  { value: 'manage_users', label: 'Manage Users', description: 'Can create, update, and delete users and roles.' },
  { value: 'manage_schemas', label: 'Manage Configuration', description: 'Can create and modify table schemas and app structure.' },
  { value: 'view_map', label: 'View Map', description: 'Can access the Map tab.' },
  { value: 'edit_map', label: 'Edit Map Layers', description: 'Can add or modify spatial features on the map.' },
  { value: 'view_data', label: 'View Data', description: 'Can access the Data tab tables.' },
  { value: 'edit_data', label: 'Edit Data', description: 'Can add, edit, or delete data records.' },
  { value: 'view_dashboard', label: 'View Dashboard', description: 'Can access the Analytics Dashboard.' },
  { value: 'view_planning', label: 'View Planning', description: 'Can access the Planning/Calendar tab.' },
];

export const INITIAL_ROLES: UserRole[] = [
  {
    id: 'admin_role',
    name: 'Administrator',
    description: 'Full system access',
    isSystem: true,
    permissions: ['sys_admin', 'manage_users', 'manage_schemas', 'view_map', 'edit_map', 'view_data', 'edit_data', 'view_dashboard', 'view_planning']
  },
  {
    id: 'editor_role',
    name: 'Editor',
    description: 'Can manage data and maps',
    isSystem: true,
    permissions: ['view_map', 'edit_map', 'view_data', 'edit_data', 'view_dashboard', 'view_planning']
  },
  {
    id: 'viewer_role',
    name: 'Viewer',
    description: 'Read-only access',
    isSystem: true,
    permissions: ['view_map', 'view_data', 'view_dashboard', 'view_planning']
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    username: 'admin',
    email: 'admin@geonexus.com',
    roleId: 'admin_role',
    createdAt: new Date().toISOString()
  }
];

const opts = (items: string[]) => items.map(i => ({ label: i, value: i }));
// Helper with colors
const optsC = (items: {l: string, c: string}[]) => items.map(i => ({ label: i.l, value: i.l, color: i.c }));

export const INITIAL_SCHEMAS: TableSchema[] = [
  {
    id: '1',
    name: 'Interventions',
    description: 'Field work and maintenance requests',
    geometryType: 'point',
    color: '#ef4444',
    visibleInData: true,
    isDefaultInData: true,
    allowNonSpatialEntry: true,
    visibleInMap: true,
    isDefaultVisibleInMap: true,
    mapDisplayMode: 'tooltip',
    hoverFields: ['title', 'priority'],
    subLayerConfig: {
      enabled: true,
      field: 'priority',
      rules: [
        { value: 'Critical', color: '#ef4444', label: 'Critical' },
        { value: 'High', color: '#f97316', label: 'High' },
        { value: 'Medium', color: '#eab308', label: 'Medium' },
        { value: 'Low', color: '#22c55e', label: 'Low' }
      ]
    },
    planning: {
      enabled: true,
      titleField: 'title',
      startField: 'date',
      defaultView: 'dayGridMonth',
      timeZone: 'local'
    },
    fields: [
      { id: 'f1', name: 'title', label: 'Title', type: 'text', required: true, sortable: true, filterable: true },
      { id: 'f2', name: 'priority', label: 'Priority', type: 'select', required: true, options: optsC([{l:'Low', c:'#22c55e'}, {l:'Medium', c:'#eab308'}, {l:'High', c:'#f97316'}, {l:'Critical', c:'#ef4444'}]), sortable: true, filterable: true },
      { id: 'f3', name: 'status', label: 'Status', type: 'select', required: true, options: optsC([{l:'Open', c:'#3b82f6'}, {l:'In Progress', c:'#8b5cf6'}, {l:'Done', c:'#22c55e'}]), sortable: true, filterable: true },
      { id: 'f4', name: 'date', label: 'Due Date', type: 'date', required: false, sortable: true, filterable: true },
    ]
  },
  {
    id: '2',
    name: 'Assets',
    description: 'Physical infrastructure assets',
    geometryType: 'point',
    color: '#3b82f6',
    visibleInData: true,
    visibleInMap: true,
    isDefaultVisibleInMap: true,
    allowNonSpatialEntry: false,
    mapDisplayMode: 'dialog',
    hoverFields: ['type', 'condition'],
    dialogConfig: { size: 'medium' },
    planning: { enabled: false, titleField: '', startField: '' },
    fields: [
      { id: 'a1', name: 'type', label: 'Asset Type', type: 'select', required: true, options: opts(['Lamp Post', 'Bench', 'Trash Can', 'Signage']), sortable: true, filterable: true },
      { id: 'a2', name: 'condition', label: 'Condition', type: 'select', required: true, options: optsC([{l:'New', c:'#22c55e'}, {l:'Good', c:'#84cc16'}, {l:'Fair', c:'#facc15'}, {l:'Poor', c:'#f43f5e'}]), sortable: true, filterable: true },
      { id: 'a3', name: 'installDate', label: 'Install Date', type: 'date', required: true, sortable: true },
      { id: 'a4', name: 'active', label: 'In Service', type: 'boolean', required: false, sortable: true, booleanLabels: { true: 'Active', false: 'Inactive' } },
    ]
  },
  {
    id: '3',
    name: 'Metro Lines',
    description: 'Subway infrastructure lines',
    geometryType: 'line',
    color: '#8b5cf6',
    visibleInData: true,
    visibleInMap: true,
    isDefaultVisibleInMap: true,
    allowNonSpatialEntry: false,
    mapDisplayMode: 'tooltip',
    hoverFields: ['line_name', 'status'],
    planning: { enabled: false, titleField: '', startField: '' },
    fields: [
      { id: 'l1', name: 'line_name', label: 'Line Name', type: 'text', required: true, sortable: true, filterable: true },
      { id: 'l2', name: 'status', label: 'Status', type: 'select', required: true, options: opts(['Operational', 'Construction', 'Closed']), sortable: true, filterable: true },
    ]
  },
  {
    id: '4',
    name: 'Parks',
    description: 'Public green spaces',
    geometryType: 'polygon',
    color: '#22c55e',
    visibleInData: true,
    visibleInMap: true,
    isDefaultVisibleInMap: true,
    allowNonSpatialEntry: false,
    mapDisplayMode: 'tooltip',
    hoverFields: ['name'],
    planning: { enabled: false, titleField: '', startField: '' },
    fields: [
      { id: 'p1', name: 'name', label: 'Park Name', type: 'text', required: true, sortable: true, filterable: true },
      { id: 'p2', name: 'maintenance', label: 'Maintenance Day', type: 'select', required: false, options: opts(['Monday', 'Wednesday', 'Friday']), sortable: true, filterable: true },
    ]
  },
  {
    id: '5',
    name: 'Employees',
    description: 'Staff directory (Non-spatial)',
    geometryType: 'none',
    color: '#64748b',
    visibleInData: true,
    visibleInMap: false,
    isDefaultVisibleInMap: false,
    allowNonSpatialEntry: true,
    mapDisplayMode: 'tooltip',
    planning: { enabled: false, titleField: '', startField: '' },
    fields: [
      { id: 'e1', name: 'fullname', label: 'Full Name', type: 'text', required: true, sortable: true, filterable: true },
      { id: 'e2', name: 'role', label: 'Role', type: 'select', required: true, options: opts(['Technician', 'Manager', 'Driver']), sortable: true, filterable: true },
      { id: 'e3', name: 'hired_date', label: 'Hired Date', type: 'date', required: true, sortable: true },
    ]
  }
];

export const INITIAL_DASHBOARDS: DashboardSchema[] = [
    {
        id: 'd1',
        name: 'Intervention Overview',
        tableId: '1', // Interventions
        isDefault: true,
        showTable: true,
        createdAt: new Date().toISOString(),
        filters: [],
        widgets: [
            { id: 'w1', type: 'pie', field: 'status', title: 'Status Distribution' },
            { id: 'w2', type: 'bar', field: 'priority', title: 'Priority Levels' }
        ]
    },
    {
        id: 'd2',
        name: 'Critical Issues',
        tableId: '1', // Interventions
        isDefault: false,
        showTable: true,
        createdAt: new Date().toISOString(),
        filters: [
            { id: 'f1', field: 'priority', operator: 'equals', value: 'Critical' }
        ],
        widgets: [
            { id: 'w3', type: 'bar', field: 'status', title: 'Critical Task Status' }
        ]
    },
    {
        id: 'd3',
        name: 'Asset Conditions',
        tableId: '2', // Assets
        isDefault: true,
        showTable: false,
        createdAt: new Date().toISOString(),
        filters: [],
        widgets: [
            { id: 'w4', type: 'pie', field: 'condition', title: 'Condition Overview' },
            { id: 'w5', type: 'bar', field: 'type', title: 'Assets by Type' }
        ]
    }
];

// Helper to generate today + n days
const getDate = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

export const INITIAL_RECORDS: DataRecord[] = [
  // Interventions
  {
    id: 'rec_1',
    tableId: '1',
    geometry: { type: 'Point', coordinates: [48.8584, 2.2945] }, // Near Eiffel Tower
    data: { title: 'Repair Street Light', priority: 'High', status: 'Open', date: getDate(1) },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_2',
    tableId: '1',
    geometry: { type: 'Point', coordinates: [48.8606, 2.3376] }, // Near Louvre
    data: { title: 'Pothole Maintenance', priority: 'Medium', status: 'In Progress', date: getDate(3) },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_3',
    tableId: '1',
    geometry: { type: 'Point', coordinates: [48.8550, 2.3400] },
    data: { title: 'Emergency Leak', priority: 'Critical', status: 'Open', date: getDate(0) },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  
  // Assets
  {
    id: 'rec_5',
    tableId: '2',
    geometry: { type: 'Point', coordinates: [48.8566, 2.3522] }, // Center
    data: { type: 'Bench', condition: 'Good', installDate: '2023-05-15', active: true },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_6',
    tableId: '2',
    geometry: { type: 'Point', coordinates: [48.8642, 2.3250] }, // Concorde
    data: { type: 'Lamp Post', condition: 'Fair', installDate: '2020-11-20', active: false },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Metro Lines (LineString)
  {
    id: 'rec_line_1',
    tableId: '3',
    geometry: { 
      type: 'LineString', 
      coordinates: [
        [48.8737, 2.2950], // Etoile
        [48.8718, 2.3007],
        [48.8650, 2.3125],
        [48.8642, 2.3250]  // Concorde
      ] 
    },
    data: { line_name: 'Line 1', status: 'Operational' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_line_2',
    tableId: '3',
    geometry: { 
      type: 'LineString', 
      coordinates: [
        [48.8464, 2.3436],
        [48.8534, 2.3488], // Cité
        [48.8582, 2.3483]
      ] 
    },
    data: { line_name: 'Line 4', status: 'Construction' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Parks (Polygon)
  {
    id: 'rec_poly_1',
    tableId: '4',
    geometry: { 
      type: 'Polygon', 
      coordinates: [
        [48.8630, 2.3260],
        [48.8650, 2.3280],
        [48.8640, 2.3340],
        [48.8615, 2.3320]
      ] 
    },
    data: { name: 'Tuileries Garden', maintenance: 'Friday' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_poly_2',
    tableId: '4',
    geometry: { 
      type: 'Polygon', 
      coordinates: [
        [48.8460, 2.3370],
        [48.8480, 2.3372],
        [48.8482, 2.3420],
        [48.8455, 2.3415]
      ] 
    },
    data: { name: 'Luxembourg Gardens', maintenance: 'Wednesday' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Employees (None)
  {
    id: 'rec_emp_1',
    tableId: '5',
    geometry: null,
    data: { fullname: 'John Doe', role: 'Manager', hired_date: '2021-03-15' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'rec_emp_2',
    tableId: '5',
    geometry: null,
    data: { fullname: 'Alice Smith', role: 'Technician', hired_date: '2022-07-01' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const DEFAULT_PREFERENCES: AppPreferences = {
  theme: 'system',
  language: 'en',
  primaryColor: '#3b82f6' // Default Tailwind blue-500
};

export const INITIAL_SHORTCUTS: Shortcut[] = [
  {
    id: 's1',
    name: 'Interventions View',
    icon: 'Layers',
    color: '#ef4444',
    type: 'map_preset',
    config: {
      layers: ['1', '3'], // Interventions + Metro
      zoom: 14
    }
  },
  {
    id: 's2',
    name: 'Urgent Work',
    icon: 'AlertTriangle',
    color: '#f59e0b',
    type: 'data_view',
    config: {
      tableId: '1', // Interventions
      search: 'High'
    }
  },
  {
    id: 's3',
    name: 'Intervention Dash',
    icon: 'LayoutDashboard',
    color: '#8b5cf6',
    type: 'dashboard_view',
    config: {
        dashboardSchemaId: 'd1'
    }
  }
];

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' }
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    // Common
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.create': 'Create',
    'common.update': 'Update',
    'common.add': 'Add',
    'common.close': 'Close',
    'common.reset': 'Reset',
    'common.done': 'Done',
    'common.confirm': 'Confirm',
    'common.back': 'Back',
    'common.next': 'Next',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',
    'common.warning': 'Warning',
    'common.info': 'Info',
    'common.yes': 'Yes',
    'common.no': 'No',
    'common.ok': 'OK',
    'common.operator': 'Operator',
    'common.value': 'Value',

    // Login
    'login.title': 'GeoNexus',
    'login.subtitle': 'Advanced Geospatial Intelligence System',
    'login.welcome': 'Welcome back',
    'login.instruction': 'Enter your credentials to access the platform.',
    'login.username': 'Username',
    'login.password': 'Password',
    'login.error': 'Invalid username or password',
    'login.authenticating': 'Authenticating...',
    'login.btn': 'Sign In',

    // Navigation & Menu
    'nav.map': 'Map',
    'nav.data': 'Data',
    'nav.dash': 'Dash',
    'nav.plan': 'Plan',
    'nav.config': 'Config',
    'menu.account': 'Account',
    'menu.profile': 'Profile',
    'menu.settings': 'Settings',
    'menu.logout': 'Log out',
    'shortcuts.quick_actions': 'Quick Actions',
    'shortcuts.no_config': 'No shortcuts configured.',

    // Profile
    'profile.title': 'User Profile',
    'profile.subtitle': 'Manage your account settings and preferences.',
    'profile.info': 'Account Information',
    'profile.username': 'Username',
    'profile.email': 'Email',
    'profile.prefs': 'Preferences',
    'profile.notifs': 'Notifications',
    'profile.notifs_desc': 'Receive alerts for critical updates.',
    'profile.enabled': 'Enabled',
    'profile.2fa': 'Two-factor Authentication',
    'profile.2fa_desc': 'Add an extra layer of security.',
    'profile.enable': 'Enable',

    // Config / Schema
    'cfg.title': 'Configuration',
    'cfg.tables': 'Table Schemas',
    'cfg.dash': 'Dashboards',
    'cfg.users': 'Users & Roles',
    'cfg.shortcuts': 'Shortcuts',
    'cfg.general': 'General Settings',
    
    'schema.required': 'Required',
    'schema.search': 'Search schemas...',
    'schema.create': 'New Table',
    'schema.basic_info': 'Basic Info',
    'schema.fields': 'Fields',
    'schema.data_view': 'Data View',
    'schema.map_view': 'Map View',
    'schema.planning': 'Planning',
    'schema.table_name': 'Table Name',
    'schema.description': 'Description',
    'schema.add_field': 'Add Field',
    'schema.no_fields': 'No fields defined yet.',
    'schema.enable_data': 'Enable Data View',
    'schema.default_data': 'Default Data View',
    'schema.allow_non_spatial': 'Allow Non-Spatial',
    'schema.enable_map': 'Enable Map Layer',
    'schema.default_visible': 'Visible by Default',
    'schema.geo_type': 'Geometry Type',
    'schema.color': 'Layer Color',
    'schema.interaction': 'Interaction Mode',
    'schema.dialog_size': 'Dialog Size',
    'schema.width': 'Width',
    'schema.height': 'Height',
    'schema.title_field': 'Title Field',
    'schema.start_field': 'Start Date Field',
    'schema.end_field': 'End Date Field',
    'schema.default_view': 'Default Calendar View',
    'schema.timezone': 'Time Zone',
    'schema.override_title': 'Change Default?',
    'schema.override_desc': 'Another table is set as the default view. Replace it?',
    'schema.all_types': 'All Types',
    'schema.no_results': 'No schemas found.',

    // Map
    'map.feature_updated': 'Feature Updated',
    'map.feature_added': 'Feature Created',
    'map.confirm_delete': 'Confirm Delete',

    // Data Tab
    'data.tables': 'Tables',
    'data.spatial': 'Spatial Dataset',
    'data.alphanumeric': 'Alphanumeric Dataset',
    'data.search': 'Search records...',
    'data.toggle_filters': 'Toggle Column Filters',
    'data.filters': 'Filters',
    'data.export': 'Export',
    'data.export_csv': 'Export CSV',
    'data.export_json': 'Export JSON',
    'data.export_geojson': 'Export GeoJSON',
    'data.export_png': 'Screenshot',
    'data.add': 'Add New',
    'data.add_map': 'Add on Map',
    'data.add_data': 'Add Record',
    'data.clear': 'Clear',
    'data.noRecords': 'No records found',
    'data.showing': 'Showing',
    'data.to': 'to',
    'data.of': 'of',
    'data.records': 'records',
    'data.create': 'Create Record',
    'data.edit': 'Edit Record',
    'data.create_desc': 'Add a new entry to this table.',
    'data.edit_desc': 'Modify existing data.',
    'data.save': 'Save Changes',
    'data.delete_title': 'Delete Record',
    'data.delete_desc': 'Are you sure? This action cannot be undone.',
    'data.select': 'Select a table to view data.',
    'data.record_deleted': 'Record deleted successfully',
    'data.map_activated': 'Map Mode Activated',
    'data.export_success': 'Export Successful',
    'data.record_added': 'Record Added',
    'data.record_updated': 'Record Updated',
    'data.noTables': 'No Tables Configured',
    'data.go_config': 'Go to Configuration to create tables.',

    // Dashboard
    'dash.title': 'Analytics Dashboard',
    'dash.total': 'Total Records',
    'dash.filtered': 'Filters Applied',
    'dash.fields': 'Fields',
    'dash.widgets': 'Widgets',
    'dash.analysis_by': 'Analysis by',
    'dash.ai': 'AI Insights',
    'dash.generate': 'Generate Analysis',
    'dash.generate_hint': 'Click generate to analyze this data with AI.',
    'dash.no_matches': 'No matching records.',
    'dash.showing_50': 'Showing first 50 records',
    'dash.select': 'Select a dashboard view',
    'dash.noDash': 'No Dashboards',
    'dash.create': 'Create Dashboard',
    'dash.edit': 'Edit Dashboard',
    'dash.name': 'Dashboard Name',
    'dash.source_table': 'Source Table',
    'dash.default': 'Set as Default',
    'dash.show_table': 'Show Data Grid',
    'dash.filters': 'Global Filters',
    'dash.add_filter': 'Add Filter',
    'dash.add_widget': 'Add Widget',
    'dash.delete_confirm': 'Delete dashboard?',
    'dash.no_config': 'No dashboards configured.',

    // Planning
    'plan.noPlan': 'Planning Disabled',
  }
};
