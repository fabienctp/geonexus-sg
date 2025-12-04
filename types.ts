

export type FieldType = 'text' | 'number' | 'date' | 'datetime' | 'select' | 'boolean';
export type GeometryType = 'point' | 'line' | 'polygon' | 'mixed' | 'none';
export type MapDisplayMode = 'tooltip' | 'dialog';

export interface FieldOption {
  label: string;
  value: string;
  color?: string;
}

export interface FieldDefinition {
  id: string;
  name: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: FieldOption[]; // Updated for Label/Value support
  booleanLabels?: { true: string; false: string }; // Custom labels for checkbox
  sortable?: boolean;
  filterable?: boolean;
}

// Standalone Calendar Schema
export interface CalendarSchema {
  id: string;
  name: string;
  tableId: string; // The source table
  titleField: string; // Field name for event title
  startField: string; // Field name for start date
  endField?: string; // Field name for end date
  defaultView: 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
  timeZone?: string;
  color?: string; // Optional override for event color
  order?: number; // Display order in sidebar
}

export interface DashboardWidget {
  id: string;
  type: 'bar' | 'pie' | 'summary';
  field: string; // Field name
  title?: string;
}

export interface DashboardFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'neq';
  value: string;
}

// Standalone Dashboard Schema
export interface DashboardSchema {
  id: string;
  name: string;
  description?: string;
  tableId: string; // The source table this dashboard is built upon
  isDefault?: boolean;
  showTable?: boolean; // Show data grid below charts
  filters: DashboardFilter[]; // Global filters for this dashboard
  filterLogic?: 'and' | 'or'; // Logic for combining multiple filters
  widgets: DashboardWidget[];
  createdAt: string;
}

export interface DialogConfig {
  size: 'small' | 'medium' | 'large' | 'fullscreen' | 'custom';
  width?: string;
  height?: string;
}

export interface SubLayerRule {
  value: string;
  color: string;
  label?: string; // Optional override for legend
}

export interface SubLayerConfig {
  enabled: boolean;
  field: string;
  rules: SubLayerRule[];
}

export interface TableSchema {
  id: string;
  name: string;
  description?: string;
  geometryType: GeometryType;
  fields: FieldDefinition[];
  isSystem?: boolean;
  color: string;
  
  // View Configurations
  visibleInData: boolean;
  isDefaultInData?: boolean; 
  allowNonSpatialEntry?: boolean;
  visibleInMap: boolean;
  isDefaultVisibleInMap?: boolean;
  markerImage?: string; 
  mapDisplayMode?: MapDisplayMode;
  hoverFields?: string[]; 
  subLayerConfig?: SubLayerConfig; 
  dialogConfig?: DialogConfig;
  // planning removed - now handled by CalendarSchema
}

export interface FeatureGeometry {
  type: 'Point' | 'LineString' | 'Polygon';
  coordinates: any; // [lat, lng] or [[lat, lng], ...]
}

export interface DataRecord {
  id: string;
  tableId: string;
  geometry?: FeatureGeometry | null;
  data: Record<string, any>; // Keyed by FieldDefinition.name
  createdAt: string;
  updatedAt: string;
}

export type Permission = 
  | 'sys_admin'        // Full access to everything
  | 'manage_users'     // Create/Edit users and roles
  | 'manage_schemas'   // Create/Edit tables
  | 'view_map'         // Access Map tab
  | 'edit_map'         // Add/Edit features on map
  | 'view_data'        // Access Data tab
  | 'edit_data'        // Add/Edit records in data
  | 'view_dashboard'   // Access Dashboard
  | 'view_planning';   // Access Planning

export interface UserRole {
  id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem?: boolean; // System roles cannot be deleted
}

export interface User {
  id: string;
  username: string;
  email: string;
  roleId: string;
  avatar?: string;
  createdAt: string;
  password?: string; // Added for mock auth
}

export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppPreferences {
  theme: ThemeMode;
  language: string;
  primaryColor: string; // Hex code
}

export interface TileLayerConfig {
  id: string;
  name: string;
  url: string;
  attribution?: string;
  maxZoom?: number;
  subdomains?: string; // e.g., 'abcd'
  isDefaultVisible?: boolean;
  defaultOpacity?: number; // 0 to 1
}

export interface MapConfig {
  tileLayers: TileLayerConfig[];
}

export type ViewTab = 'map' | 'data' | 'dashboard' | 'planning' | 'settings' | 'profile';
export type MapToolMode = 'select' | 'add' | 'move' | 'measure' | 'route' | 'filter' | 'print';

export type ShortcutType = 'map_preset' | 'data_view' | 'quick_add' | 'map_search' | 'dashboard_view';

export interface Shortcut {
  id: string;
  name: string;
  description?: string;
  icon: string; // Icon name from Lucide
  color: string;
  type: ShortcutType;
  config: {
    // map_preset
    layers?: string[]; // IDs of layers to toggle ON
    center?: [number, number];
    zoom?: number;

    // data_view
    tableId?: string;
    search?: string;

    // quick_add
    targetTableId?: string;
    data?: Record<string, any>; // Default values for quick add

    // map_search
    filterLayerId?: string;
    filterCriteria?: Record<string, string>;

    // dashboard_view
    dashboardSchemaId?: string; // Now points to DashboardSchema.id
  };
}

declare global {
  interface Window {
    geoNexusDrawMode?: boolean;
    geoNexusActiveSchema?: string | null;
    geoNexusActiveTool?: string;
    geoNexusDrawingZone?: boolean;
  }
}