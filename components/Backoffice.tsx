
import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Map as MapIcon, Users, LayoutDashboard, Calendar, 
  Plus, Trash2, Edit, X, ChevronRight, ChevronLeft, Check, Search, Zap, 
  List, AlignLeft, Image as ImageIcon, BarChart3
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store';
import { TableSchema, User, UserRole, Permission, FieldDefinition, Shortcut, DashboardSchema, DashboardFilter, DashboardWidget } from '../types';
import { 
  FIELD_TYPES, GEO_TYPES, MAP_DISPLAY_MODES, DIALOG_SIZE_PRESETS, 
  CALENDAR_VIEWS, TIME_ZONES, PERMISSIONS_LIST, SHORTCUT_TYPES, SHORTCUT_ICONS, LANGUAGES 
} from '../constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Switch } from './ui/switch';
import { Combobox } from './ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { useToast } from './ui/use-toast';
import { cn } from '../lib/utils';
import { DashboardView } from './DashboardTab';
import { DatePicker } from './ui/date-picker';

const genId = () => Math.random().toString(36).substr(2, 9);

const ColorPicker = ({ color, onChange, disabled }: { color: string, onChange: (c: string) => void, disabled?: boolean }) => (
  <div className="flex items-center gap-2">
    <input 
      type="color" 
      value={color} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="h-8 w-8 rounded border p-0 cursor-pointer disabled:opacity-50"
    />
    <Input 
      value={color} 
      onChange={e => onChange(e.target.value)} 
      disabled={disabled}
      className="w-24 font-mono text-xs" 
    />
  </div>
);

const FieldEditorModal = ({ field, onSave, onCancel, existingNames }: { field?: FieldDefinition, onSave: (f: FieldDefinition) => void, onCancel: () => void, existingNames: string[] }) => {
   const [data, setData] = useState<FieldDefinition>(field || {
      id: genId(),
      name: '',
      label: '',
      type: 'text',
      required: false,
      sortable: true,
      filterable: true
   });
   const [error, setError] = useState('');

   const handleSave = () => {
      if (!data.name || !data.label) {
         setError('Name and Label are required');
         return;
      }
      const nameRegex = /^[a-zA-Z0-9_]+$/;
      if (!nameRegex.test(data.name)) {
          setError('Name must be alphanumeric (no spaces, use underscores)');
          return;
      }
      if (!field && existingNames.includes(data.name)) {
          setError('Field name must be unique');
          return;
      }
      onSave(data);
   };

   return (
      <DialogContent>
         <DialogHeader>
            <DialogTitle>{field ? 'Edit Field' : 'Add Field'}</DialogTitle>
         </DialogHeader>
         <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <Label>Label</Label>
                  <Input value={data.label} onChange={e => {
                     const val = e.target.value;
                     if (!field) {
                        setData({...data, label: val, name: val.toLowerCase().replace(/[^a-z0-9]/g, '_')});
                     } else {
                        setData({...data, label: val});
                     }
                  }} />
               </div>
               <div className="space-y-2">
                  <Label>System Name</Label>
                  <Input value={data.name} onChange={e => setData({...data, name: e.target.value})} />
               </div>
            </div>
            <div className="space-y-2">
               <Label>Type</Label>
               <Combobox options={FIELD_TYPES} value={data.type} onChange={v => setData({...data, type: v as any})} />
            </div>
            
            <div className="flex gap-4">
               <div className="flex items-center space-x-2">
                  <Switch checked={data.required} onCheckedChange={c => setData({...data, required: c})} />
                  <Label>Required</Label>
               </div>
               <div className="flex items-center space-x-2">
                  <Switch checked={data.sortable} onCheckedChange={c => setData({...data, sortable: c})} />
                  <Label>Sortable</Label>
               </div>
               <div className="flex items-center space-x-2">
                  <Switch checked={data.filterable} onCheckedChange={c => setData({...data, filterable: c})} />
                  <Label>Filterable</Label>
               </div>
            </div>

            {data.type === 'select' && (
               <div className="space-y-2 border-t pt-2">
                  <Label>Options</Label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                     {(data.options || []).map((opt, idx) => (
                        <div key={idx} className="flex gap-2">
                           <Input value={opt.label} onChange={e => {
                               const newOpts = [...(data.options || [])];
                               newOpts[idx] = { ...opt, label: e.target.value, value: e.target.value };
                               setData({...data, options: newOpts});
                           }} placeholder="Option" className="flex-1" />
                           <Input type="color" value={opt.color || '#cccccc'} onChange={e => {
                               const newOpts = [...(data.options || [])];
                               newOpts[idx] = { ...opt, color: e.target.value };
                               setData({...data, options: newOpts});
                           }} className="w-10 p-1" />
                           <Button variant="ghost" size="icon" onClick={() => {
                               const newOpts = (data.options || []).filter((_, i) => i !== idx);
                               setData({...data, options: newOpts});
                           }}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                     ))}
                     <Button size="sm" variant="outline" onClick={() => setData({...data, options: [...(data.options || []), { label: 'New Option', value: 'New Option', color: '#3b82f6' }]})}>
                        <Plus className="w-3 h-3 mr-1" /> Add Option
                     </Button>
                  </div>
               </div>
            )}
            
            {data.type === 'boolean' && (
               <div className="grid grid-cols-2 gap-2 border-t pt-2">
                  <div className="space-y-1">
                     <Label>True Label</Label>
                     <Input value={data.booleanLabels?.true || 'Yes'} onChange={e => setData({...data, booleanLabels: { ...data.booleanLabels, true: e.target.value, false: data.booleanLabels?.false || 'No' }})} />
                  </div>
                  <div className="space-y-1">
                     <Label>False Label</Label>
                     <Input value={data.booleanLabels?.false || 'No'} onChange={e => setData({...data, booleanLabels: { ...data.booleanLabels, true: data.booleanLabels?.true || 'Yes', false: e.target.value }})} />
                  </div>
               </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}
         </div>
         <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
         </DialogFooter>
      </DialogContent>
   );
};

const SchemaManager = ({ schema, onSave, onCancel, onSelectSchema }: { schema: TableSchema, onSave: (s: TableSchema) => void, onCancel: () => void, onSelectSchema: (s: TableSchema | null) => void }) => {
  const { t } = useTranslation();
  const { schemas } = useAppStore();
  const [activeTab, setActiveTab] = useState<'general'|'fields'|'data'|'map'|'planning'>('general');
  
  const [editingSchema, setEditingSchema] = useState<TableSchema>(schema);
  const [overrideAlert, setOverrideAlert] = useState<{ show: boolean, type: 'data' }>({ show: false, type: 'data' });
  const [sidebarSearch, setSidebarSearch] = useState('');
  
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<FieldDefinition | undefined>(undefined);

  useEffect(() => {
      setEditingSchema(schema);
  }, [schema]);

  const handleDeleteField = (id: string) => {
    setEditingSchema({
      ...editingSchema,
      fields: editingSchema.fields.filter(f => f.id !== id)
    });
  };

  const handleSaveField = (field: FieldDefinition) => {
    if (editingField) {
      setEditingSchema({
        ...editingSchema,
        fields: editingSchema.fields.map(f => f.id === field.id ? field : f)
      });
    } else {
      setEditingSchema({
        ...editingSchema,
        fields: [...editingSchema.fields, field]
      });
    }
    setIsFieldModalOpen(false);
  };

  const handleGenerateRules = (fieldName: string) => {
    const field = editingSchema.fields.find(f => f.name === fieldName);
    if (!field || !field.options) return;
    
    setEditingSchema({
      ...editingSchema,
      subLayerConfig: {
        enabled: true,
        field: fieldName,
        rules: field.options.map(o => ({ value: o.value, label: o.label, color: o.color || '#cccccc' }))
      }
    });
  };

  const handleUpdateRule = (idx: number, updates: any) => {
    if (!editingSchema.subLayerConfig) return;
    const newRules = [...editingSchema.subLayerConfig.rules];
    newRules[idx] = { ...newRules[idx], ...updates };
    setEditingSchema({
      ...editingSchema,
      subLayerConfig: { ...editingSchema.subLayerConfig, rules: newRules }
    });
  };

  const filteredSchemas = schemas.filter(s => s.name.toLowerCase().includes(sidebarSearch.toLowerCase()));

  return (
    <div className="flex h-full w-full bg-background">
        <div className="w-64 border-r bg-muted/10 flex flex-col">
            <div className="p-4 border-b">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={onCancel}>
                    <ChevronLeft className="w-4 h-4 mr-2" /> {t('common.back')}
                </Button>
            </div>
            <div className="p-2">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                    <Input 
                        className="h-8 pl-7 text-xs" 
                        placeholder={t('schema.search')}
                        value={sidebarSearch}
                        onChange={e => setSidebarSearch(e.target.value)}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredSchemas.map(s => (
                    <button
                        key={s.id}
                        onClick={() => onSelectSchema(s)}
                        className={cn(
                            "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                            s.id === editingSchema.id 
                                ? "bg-white shadow-sm border border-border text-primary" 
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                        )}
                    >
                        <div className="w-2 h-2 rounded-full shrink-0" style={{background: s.color}} />
                        <span className="truncate flex-1">{s.name}</span>
                        {s.id === editingSchema.id && <div className="w-1.5 h-1.5 bg-primary rounded-full" />}
                    </button>
                ))}
            </div>
            <div className="p-2 border-t">
                <Button className="w-full" size="sm" variant="secondary" onClick={() => onSelectSchema(null)}>
                    <Plus className="w-4 h-4 mr-2" /> {t('schema.create')}
                </Button>
            </div>
        </div>

        <div className="flex-1 flex flex-col h-full overflow-hidden bg-background">
            <div className="flex items-center justify-between p-4 border-b bg-background">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                       {editingSchema.id ? editingSchema.name : 'New Table'}
                       <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {editingSchema.id ? 'Editing' : 'Creating'}
                       </span>
                    </h2>
                </div>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setEditingSchema(schema)} disabled={JSON.stringify(schema) === JSON.stringify(editingSchema)}>{t('common.reset')}</Button>
                    <Button onClick={() => onSave(editingSchema)}>{t('common.save')}</Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
            <div className="border-b bg-muted/10 px-4 shrink-0">
                <div className="flex space-x-2 overflow-x-auto py-2">
                {[
                    {id: 'general', label: t('schema.basic_info'), icon: Settings},
                    {id: 'fields', label: t('schema.fields'), icon: List},
                    {id: 'data', label: t('schema.data_view'), icon: Database},
                    {id: 'map', label: t('schema.map_view'), icon: MapIcon},
                    {id: 'planning', label: t('schema.planning'), icon: Calendar},
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap",
                            activeTab === tab.id 
                                ? "bg-background text-primary shadow-sm border" 
                                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-900/20">
                <div className="max-w-4xl mx-auto space-y-6">
                    {/* ... (Previous tabs content remain same) ... */}
                    {activeTab === 'general' && (
                        <Card>
                            <CardHeader><CardTitle>{t('schema.basic_info')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label>{t('schema.table_name')}</Label>
                                    <Input value={editingSchema.name} onChange={e => setEditingSchema({...editingSchema, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('schema.description')}</Label>
                                    <Input value={editingSchema.description || ''} onChange={e => setEditingSchema({...editingSchema, description: e.target.value})} />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'fields' && (
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{t('schema.fields')}</CardTitle>
                                <Button size="sm" onClick={() => { setEditingField(undefined); setIsFieldModalOpen(true); }}>
                                    <Plus className="w-4 h-4 mr-2" /> {t('schema.add_field')}
                                </Button>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {editingSchema.fields.map((field) => (
                                        <div key={field.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/20 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/10 text-primary rounded min-w-[100px] justify-center">
                                                    {field.type === 'text' && <AlignLeft className="w-4 h-4" />}
                                                    {field.type === 'number' && <span className="font-mono font-bold text-xs">123</span>}
                                                    {field.type === 'date' && <Calendar className="w-4 h-4" />}
                                                    {field.type === 'boolean' && <Check className="w-4 h-4" />}
                                                    {field.type === 'select' && <List className="w-4 h-4" />}
                                                    <span className="text-xs font-medium capitalize">{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
                                                </div>
                                                <div>
                                                    <div className="font-medium flex items-center gap-2">
                                                        {field.label}
                                                        {field.required && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase font-bold">Req</span>}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground font-mono">{field.name}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="flex gap-1 mr-4">
                                                    {field.sortable && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border">Sort</span>}
                                                    {field.filterable && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border">Filter</span>}
                                                </div>
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingField(field); setIsFieldModalOpen(true); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDeleteField(field.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                    {editingSchema.fields.length === 0 && (
                                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                            {t('schema.no_fields')}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'data' && (
                        <Card>
                            <CardHeader><CardTitle>{t('schema.data_view')}</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded">
                                    <div className="space-y-0.5">
                                        <Label>{t('schema.enable_data')}</Label>
                                        <p className="text-xs text-muted-foreground">Show this table in the Data tab</p>
                                    </div>
                                    <Switch checked={editingSchema.visibleInData} onCheckedChange={c => setEditingSchema({...editingSchema, visibleInData: c})} />
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded">
                                    <div className="space-y-0.5">
                                        <Label>{t('schema.default_data')}</Label>
                                        <p className="text-xs text-muted-foreground">Open this table by default</p>
                                    </div>
                                    <Switch 
                                        checked={editingSchema.isDefaultInData} 
                                        onCheckedChange={c => {
                                            if (c) setOverrideAlert({ show: true, type: 'data' });
                                            else setEditingSchema({...editingSchema, isDefaultInData: false});
                                        }} 
                                    />
                                </div>
                                {editingSchema.geometryType !== 'none' && (
                                    <div className="flex items-center justify-between p-3 border rounded">
                                        <div className="space-y-0.5">
                                            <Label>{t('schema.allow_non_spatial')}</Label>
                                            <p className="text-xs text-muted-foreground">Allow adding records without map geometry</p>
                                        </div>
                                        <Switch checked={editingSchema.allowNonSpatialEntry} onCheckedChange={c => setEditingSchema({...editingSchema, allowNonSpatialEntry: c})} />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {activeTab === 'map' && (
                        <div className="space-y-6">
                            {editingSchema.geometryType === 'none' ? (
                                <Card>
                                    <CardHeader><CardTitle>{t('schema.map_view')}</CardTitle></CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="bg-muted/30 p-6 rounded-lg border-2 border-dashed flex flex-col items-center text-center space-y-4">
                                            <MapIcon className="w-12 h-12 text-muted-foreground opacity-50" />
                                            <div>
                                                <h3 className="font-medium text-lg">Enable Spatial Features</h3>
                                                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">This table is currently non-spatial. To display it on the map, please select a geometry type below.</p>
                                            </div>
                                            <div className="w-64">
                                                <Label className="mb-2 block text-left text-xs font-medium uppercase text-muted-foreground">Geometry Type</Label>
                                                <Combobox 
                                                    options={GEO_TYPES} 
                                                    value={editingSchema.geometryType} 
                                                    onChange={v => setEditingSchema({...editingSchema, geometryType: v as any, visibleInMap: v !== 'none' ? true : false })} 
                                                    placeholder="Select Geometry Type"
                                                />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <>
                                    <Card>
                                        <CardHeader><CardTitle>{t('schema.map_view')}</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <Label>{t('schema.enable_map')}</Label>
                                                <Switch checked={editingSchema.visibleInMap} onCheckedChange={c => setEditingSchema({...editingSchema, visibleInMap: c})} />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Label>{t('schema.default_visible')}</Label>
                                                <Switch checked={editingSchema.isDefaultVisibleInMap} onCheckedChange={c => setEditingSchema({...editingSchema, isDefaultVisibleInMap: c})} />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>{t('schema.geo_type')}</Label>
                                                    <Combobox options={GEO_TYPES} value={editingSchema.geometryType} onChange={v => setEditingSchema({...editingSchema, geometryType: v as any})} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>{t('schema.color')}</Label>
                                                    <ColorPicker color={editingSchema.color} onChange={c => setEditingSchema({...editingSchema, color: c})} />
                                                </div>
                                            </div>
                                            
                                            {(editingSchema.geometryType === 'point' || editingSchema.geometryType === 'mixed') && (
                                                <div className="space-y-3 pt-2 border-t">
                                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Marker Icon</Label>
                                                    <div className="flex gap-3 items-end">
                                                        {editingSchema.markerImage && (
                                                            <img src={editingSchema.markerImage} alt="Marker" className="w-10 h-10 object-contain border rounded bg-slate-50" />
                                                        )}
                                                        <div className="flex-1 space-y-1">
                                                            <Label className="text-xs">Image URL</Label>
                                                            <Input 
                                                                value={editingSchema.markerImage || ''} 
                                                                onChange={e => setEditingSchema({...editingSchema, markerImage: e.target.value})} 
                                                                placeholder="https://..."
                                                            />
                                                        </div>
                                                        <div className="relative">
                                                            <Button variant="outline" size="icon" className="relative overflow-hidden">
                                                                <ImageIcon className="w-4 h-4" />
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="absolute inset-0 opacity-0 cursor-pointer" 
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        if (file) {
                                                                            const reader = new FileReader();
                                                                            reader.onload = (ev) => setEditingSchema({...editingSchema, markerImage: ev.target?.result as string});
                                                                            reader.readAsDataURL(file);
                                                                        }
                                                                    }}
                                                                />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-center">
                                                <CardTitle className="text-base">Conditional Styling</CardTitle>
                                                <Switch 
                                                    checked={editingSchema.subLayerConfig?.enabled}
                                                    onCheckedChange={(c) => setEditingSchema({
                                                        ...editingSchema,
                                                        subLayerConfig: c ? { enabled: true, field: '', rules: [] } : undefined
                                                    })}
                                                />
                                            </div>
                                        </CardHeader>
                                        {editingSchema.subLayerConfig?.enabled && (
                                            <CardContent className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label>Style by Field</Label>
                                                    <Combobox 
                                                        options={editingSchema.fields.filter(f => f.type === 'select').map(f => ({ label: f.label, value: f.name }))}
                                                        value={editingSchema.subLayerConfig.field}
                                                        onChange={(val) => handleGenerateRules(val)}
                                                        placeholder="Select a list field..."
                                                    />
                                                </div>
                                                <div className="space-y-2 border-t pt-2">
                                                    {editingSchema.subLayerConfig.rules.length > 0 ? (
                                                        editingSchema.subLayerConfig.rules.map((rule, idx) => (
                                                            <div key={idx} className="flex items-center gap-2">
                                                                <ColorPicker color={rule.color} onChange={(c) => handleUpdateRule(idx, {color: c})} disabled={true} />
                                                                <span className="text-sm font-medium flex-1">{rule.label || rule.value}</span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <p className="text-sm text-muted-foreground italic">Select a field to generate rules from its options.</p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        )}
                                    </Card>

                                    <Card>
                                        <CardHeader><CardTitle>{t('schema.interaction')}</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Display Mode</Label>
                                                    <Combobox options={MAP_DISPLAY_MODES} value={editingSchema.mapDisplayMode || 'tooltip'} onChange={v => setEditingSchema({...editingSchema, mapDisplayMode: v as any})} />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-2">
                                                <Label>Hover Tooltip Fields</Label>
                                                <div className="border rounded-md p-2 max-h-[150px] overflow-y-auto bg-muted/20">
                                                    {editingSchema.fields.map(field => (
                                                        <label key={field.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-background cursor-pointer text-sm">
                                                            <input 
                                                                type="checkbox" 
                                                                className="rounded border-slate-300 text-primary focus:ring-primary"
                                                                checked={(editingSchema.hoverFields || []).includes(field.name)}
                                                                onChange={(e) => {
                                                                    const current = new Set(editingSchema.hoverFields || []);
                                                                    if (e.target.checked) current.add(field.name);
                                                                    else current.delete(field.name);
                                                                    setEditingSchema({...editingSchema, hoverFields: Array.from(current)});
                                                                }}
                                                            />
                                                            <span>{field.label}</span>
                                                        </label>
                                                    ))}
                                                    {editingSchema.fields.length === 0 && <p className="text-xs text-muted-foreground italic">No fields defined</p>}
                                                </div>
                                            </div>

                                            {editingSchema.mapDisplayMode === 'dialog' && (
                                                <div className="space-y-2 border-t pt-2">
                                                    <Label>{t('schema.dialog_size')}</Label>
                                                    <Combobox 
                                                        options={DIALOG_SIZE_PRESETS} 
                                                        value={editingSchema.dialogConfig?.size || 'medium'} 
                                                        onChange={v => setEditingSchema({...editingSchema, dialogConfig: { ...editingSchema.dialogConfig, size: v as any }})} 
                                                    />
                                                    {editingSchema.dialogConfig?.size === 'custom' && (
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div><Label className="text-xs">{t('schema.width')}</Label><Input value={editingSchema.dialogConfig.width} onChange={e => setEditingSchema({...editingSchema, dialogConfig: {...editingSchema.dialogConfig!, width: e.target.value}})} placeholder="500px" /></div>
                                                            <div><Label className="text-xs">{t('schema.height')}</Label><Input value={editingSchema.dialogConfig.height} onChange={e => setEditingSchema({...editingSchema, dialogConfig: {...editingSchema.dialogConfig!, height: e.target.value}})} placeholder="auto" /></div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'planning' && (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>{t('schema.planning')}</CardTitle>
                                    <Switch 
                                        checked={editingSchema.planning?.enabled} 
                                        onCheckedChange={c => setEditingSchema({...editingSchema, planning: c ? { ...editingSchema.planning, enabled: true } : { enabled: false, titleField: '', startField: '' }})} 
                                    />
                                </div>
                            </CardHeader>
                            {editingSchema.planning?.enabled && (
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>{t('schema.title_field')}</Label>
                                            <Combobox options={editingSchema.fields.filter(f => f.type === 'text').map(f => ({ label: f.label, value: f.name }))} value={editingSchema.planning.titleField} onChange={v => setEditingSchema({...editingSchema, planning: {...editingSchema.planning!, titleField: v}})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('schema.start_field')}</Label>
                                            <Combobox options={editingSchema.fields.filter(f => f.type === 'date').map(f => ({ label: f.label, value: f.name }))} value={editingSchema.planning.startField} onChange={v => setEditingSchema({...editingSchema, planning: {...editingSchema.planning!, startField: v}})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('schema.end_field')}</Label>
                                            <Combobox options={editingSchema.fields.filter(f => f.type === 'date').map(f => ({ label: f.label, value: f.name }))} value={editingSchema.planning.endField} onChange={v => setEditingSchema({...editingSchema, planning: {...editingSchema.planning!, endField: v}})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('schema.default_view')}</Label>
                                            <Combobox options={CALENDAR_VIEWS} value={editingSchema.planning.defaultView || 'dayGridMonth'} onChange={v => setEditingSchema({...editingSchema, planning: {...editingSchema.planning!, defaultView: v as any}})} />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>{t('schema.timezone')}</Label>
                                            <Combobox options={TIME_ZONES} value={editingSchema.planning.timeZone || 'local'} onChange={v => setEditingSchema({...editingSchema, planning: {...editingSchema.planning!, timeZone: v}})} />
                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    )}
                </div>
            </div>
            </div>

        <Dialog open={overrideAlert.show} onOpenChange={open => setOverrideAlert(prev => ({...prev, show: open}))}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('schema.override_title')}</DialogTitle>
                    <DialogDescription>{t('schema.override_desc')}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOverrideAlert(prev => ({...prev, show: false}))}>{t('common.cancel')}</Button>
                    <Button onClick={() => {
                        if (overrideAlert.type === 'data') setEditingSchema({...editingSchema, isDefaultInData: true});
                        setOverrideAlert(prev => ({...prev, show: false}));
                    }}>{t('common.confirm')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <Dialog open={isFieldModalOpen} onOpenChange={setIsFieldModalOpen}>
            <FieldEditorModal 
                field={editingField} 
                onSave={handleSaveField} 
                onCancel={() => setIsFieldModalOpen(false)}
                existingNames={editingSchema.fields.filter(f => f.id !== editingField?.id).map(f => f.name)}
            />
        </Dialog>
    </div>
    </div>
  );
};

// ... TablesView, NavItem, UsersSecurityView, ShortcutsConfigView, GeneralSettingsView remain the same ...
// Re-implemented to support the new features, keeping them concise for this XML block

const TablesView = ({ setEditingSchema }: { setEditingSchema: (s: TableSchema | null) => void }) => {
  const { schemas, deleteSchema } = useAppStore();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const filtered = schemas.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || s.geometryType === typeFilter || (typeFilter === 'spatial' && s.geometryType !== 'none');
      return matchesSearch && matchesType;
  });

  const itemsPerPage = 6;
  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const pageItems = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder={t('schema.search')} 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
            <div className="w-40">
                <Combobox 
                    options={[{value: 'all', label: t('schema.all_types')}, {value: 'spatial', label: 'Spatial Only'}, ...GEO_TYPES]}
                    value={typeFilter}
                    onChange={setTypeFilter}
                />
            </div>
        </div>
        <Button onClick={() => setEditingSchema({
          id: '',
          name: '',
          geometryType: 'point',
          color: '#3b82f6',
          visibleInData: true,
          visibleInMap: true,
          isDefaultVisibleInMap: true,
          fields: [],
          planning: { enabled: false, titleField: '', startField: '' },
        })}>
          <Plus className="w-4 h-4 mr-2" /> {t('schema.create')}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pageItems.map(schema => (
          <Card key={schema.id} className="hover:shadow-md transition-all cursor-pointer group relative" onClick={() => setEditingSchema(schema)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                   <div className="w-3 h-3 rounded-full ring-2 ring-offset-1 ring-offset-background" style={{background: schema.color}}></div>
                   <CardTitle className="text-base">{schema.name}</CardTitle>
                </div>
                {schema.geometryType !== 'none' && <MapIcon className="w-4 h-4 text-muted-foreground" />}
              </div>
              <CardDescription className="line-clamp-1">{schema.description || 'No description'}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mt-2">
                 <span className="text-xs bg-muted px-2 py-1 rounded border">{schema.fields.length} {t('schema.fields')}</span>
                 {schema.visibleInData && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">Data View</span>}
                 {schema.isDefaultInData && <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-300 font-medium">Data - Default</span>}
                 {schema.planning?.enabled && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-200">Planning</span>}
              </div>
            </CardContent>
            
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                    variant="destructive" 
                    size="icon" 
                    className="h-8 w-8 shadow-sm" 
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(schema.id); }}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
          </Card>
        ))}
        {pageItems.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                {t('schema.no_results')}
            </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-4">
         <div className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
         <div className="flex gap-2">
             <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1}>Previous</Button>
             <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages}>Next</Button>
         </div>
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
         <DialogContent>
            <DialogHeader>
               <DialogTitle>Delete Table?</DialogTitle>
               <DialogDescription>
                  Are you sure you want to delete this table? All associated data records will be permanently lost.
               </DialogDescription>
            </DialogHeader>
            <DialogFooter>
               <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
               <Button variant="destructive" onClick={() => { if(deleteConfirmId) deleteSchema(deleteConfirmId); setDeleteConfirmId(null); }}>Delete</Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
    </div>
  );
};

const NavItem = ({ id, label, icon: Icon, active, onClick }: { id: string, label: string, icon: any, active: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    <Icon className="w-4 h-4" />
    {label}
  </button>
);

const UsersSecurityView = () => {
    const { t } = useTranslation();
    const { users, roles } = useAppStore();
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('cfg.users')}</CardTitle>
                    <CardDescription>Manage users and roles (Read-only view in this demo).</CardDescription>
                </CardHeader>
                <CardContent>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.map(u => (
                                <TableRow key={u.id}>
                                    <TableCell className="font-medium">{u.username}</TableCell>
                                    <TableCell>{u.email}</TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                                            {roles.find(r => r.id === u.roleId)?.name}
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

const ShortcutsConfigView = () => {
    const { shortcuts } = useAppStore();
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Shortcuts Configuration</CardTitle>
                    <CardDescription>Manage quick actions appearing in the Map tab.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {shortcuts.map(s => (
                            <div key={s.id} className="flex items-center p-3 border rounded-lg gap-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-sm" style={{background: s.color}}>
                                    <Zap className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-xs text-muted-foreground">{s.type}</div>
                                </div>
                            </div>
                        ))}
                        {shortcuts.length === 0 && <div className="text-sm text-muted-foreground">No shortcuts configured.</div>}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const GeneralSettingsView = () => {
    const { preferences, updatePreferences } = useAppStore();
    const { t } = useTranslation();
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>{t('cfg.general')}</CardTitle>
                    <CardDescription>Global application settings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label>App Theme</Label>
                            <div className="flex gap-2">
                                {['light', 'dark', 'system'].map((theme) => (
                                    <Button 
                                        key={theme}
                                        variant={preferences.theme === theme ? 'default' : 'outline'}
                                        onClick={() => updatePreferences({ theme: theme as any })}
                                        className="capitalize flex-1"
                                    >
                                        {theme}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Language</Label>
                            <Combobox 
                                options={LANGUAGES}
                                value={preferences.language}
                                onChange={(val) => updatePreferences({ language: val })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Primary Color</Label>
                            <div className="flex items-center gap-3">
                                <ColorPicker 
                                    color={preferences.primaryColor} 
                                    onChange={(c) => updatePreferences({ primaryColor: c })} 
                                />
                                <span className="text-xs text-muted-foreground">Used for buttons, active states, and highlights.</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

const DashboardConfigView = () => {
    const { dashboards, schemas, records, addDashboard, updateDashboard, deleteDashboard } = useAppStore();
    const { t } = useTranslation();
    const [isEditing, setIsEditing] = useState(false);
    const [editingDash, setEditingDash] = useState<DashboardSchema | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Filter/Sort State
    const [search, setSearch] = useState('');
    
    const filteredDashboards = dashboards.filter(d => d.name.toLowerCase().includes(search.toLowerCase()));

    const handleSave = () => {
        if (!editingDash) return;
        if (!editingDash.tableId || !editingDash.name) return;

        if (editingDash.id) {
            updateDashboard(editingDash);
        } else {
            addDashboard({ ...editingDash, id: genId(), createdAt: new Date().toISOString() });
        }
        setIsEditing(false);
        setEditingDash(null);
    };

    const handleCreate = () => {
        const defaultSchema = schemas[0];
        setEditingDash({
            id: '',
            name: '',
            tableId: defaultSchema?.id || '',
            filters: [],
            filterLogic: 'and',
            widgets: [],
            showTable: true,
            isDefault: false,
            createdAt: ''
        });
        setIsEditing(true);
    };

    // Helper to determine available operators based on field type
    const getOperators = (type: string) => {
        switch(type) {
            case 'number': 
                return [{value:'equals', label:'='}, {value:'gt', label:'>'}, {value:'lt', label:'<'}, {value:'neq', label:'!='}];
            case 'date': 
                return [{value:'equals', label:'On'}, {value:'gt', label:'After'}, {value:'lt', label:'Before'}];
            case 'select':
            case 'boolean': 
                return [{value:'equals', label:'Is'}, {value:'neq', label:'Is Not'}];
            default: 
                return [{value:'equals', label:'Equals'}, {value:'contains', label:'Contains'}, {value:'neq', label:'Not Equals'}];
        }
    };

    if (isEditing && editingDash) {
        const sourceTable = schemas.find(s => s.id === editingDash.tableId);

        return (
            <div className="flex flex-col h-full bg-background">
               <div className="flex items-center justify-between p-4 border-b">
                   <div className="flex items-center gap-4">
                       <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setEditingDash(null); }}>
                          <ChevronLeft className="w-4 h-4 mr-2" /> Back
                       </Button>
                       <h2 className="text-lg font-bold">
                           {editingDash.id ? 'Edit Dashboard' : 'New Dashboard'}
                       </h2>
                   </div>
                   <Button onClick={handleSave}>Save Dashboard</Button>
               </div>
               
               <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-5xl mx-auto w-full">
                   <Card>
                       <CardHeader><CardTitle>General Configuration</CardTitle></CardHeader>
                       <CardContent className="space-y-4">
                           <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                   <Label>Dashboard Name</Label>
                                   <Input value={editingDash.name} onChange={e => setEditingDash({...editingDash, name: e.target.value})} placeholder="e.g. Sales Overview" />
                               </div>
                               <div className="space-y-2">
                                   <Label>Source Table</Label>
                                   <Combobox 
                                       options={schemas.map(s => ({label: s.name, value: s.id}))}
                                       value={editingDash.tableId}
                                       onChange={val => {
                                            // Reset filters and widgets if table changes, as fields might differ
                                            setEditingDash({ ...editingDash, tableId: val, filters: [], widgets: [] });
                                       }}
                                   />
                               </div>
                           </div>
                           <div className="flex gap-8 pt-2">
                               <div className="flex items-center space-x-2">
                                   <Switch checked={editingDash.isDefault} onCheckedChange={c => setEditingDash({...editingDash, isDefault: c})} />
                                   <Label>Set as Default</Label>
                               </div>
                               <div className="flex items-center space-x-2">
                                   <Switch checked={editingDash.showTable} onCheckedChange={c => setEditingDash({...editingDash, showTable: c})} />
                                   <Label>Show Data Table</Label>
                               </div>
                           </div>
                       </CardContent>
                   </Card>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {/* Filters Section */}
                       <Card className="flex flex-col">
                           <CardHeader className="flex flex-row items-center justify-between pb-2">
                               <div className="flex items-center gap-4">
                                   <CardTitle className="text-base">Global Filters</CardTitle>
                                   {editingDash.filters.length > 1 && (
                                       <Combobox 
                                           className="h-7 w-28 text-xs" 
                                           options={[{value:'and', label:'Match All (AND)'}, {value:'or', label:'Match Any (OR)'}]}
                                           value={editingDash.filterLogic || 'and'}
                                           onChange={v => setEditingDash({...editingDash, filterLogic: v as any})}
                                       />
                                   )}
                               </div>
                               <Button size="sm" variant="outline" onClick={() => setEditingDash({...editingDash, filters: [...editingDash.filters, { id: genId(), field: sourceTable?.fields[0]?.name || '', operator: 'equals', value: '' }]})}>
                                   <Plus className="w-3 h-3 mr-1" /> Add Filter
                               </Button>
                           </CardHeader>
                           <CardContent className="flex-1 space-y-2">
                               {editingDash.filters.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">No filters defined. All records will be shown.</p>}
                               {editingDash.filters.map((filter, idx) => {
                                   const fieldDef = sourceTable?.fields.find(f => f.name === filter.field);
                                   const fieldType = fieldDef?.type || 'text';
                                   
                                   return (
                                       <div key={filter.id} className="flex gap-2 items-center bg-muted/20 p-2 rounded border flex-wrap">
                                           {idx > 0 && (
                                               <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded uppercase">
                                                   {editingDash.filterLogic || 'AND'}
                                               </span>
                                           )}
                                           <Combobox 
                                               className="h-8 text-xs w-32 shrink-0" 
                                               options={sourceTable?.fields.map(f => ({value: f.name, label: f.label})) || []} 
                                               value={filter.field} 
                                               onChange={v => {
                                                   const newF = [...editingDash.filters];
                                                   newF[idx].field = v;
                                                   newF[idx].value = ''; // Reset value on field change
                                                   newF[idx].operator = 'equals'; // Reset op
                                                   setEditingDash({...editingDash, filters: newF});
                                               }} 
                                           />
                                           <Combobox 
                                                className="h-8 text-xs w-24 shrink-0"
                                                options={getOperators(fieldType)}
                                                value={filter.operator}
                                                onChange={v => {
                                                    const newF = [...editingDash.filters];
                                                    newF[idx].operator = v as any;
                                                    setEditingDash({...editingDash, filters: newF});
                                                }}
                                           />
                                           
                                           {/* Dynamic Value Input */}
                                           <div className="flex-1 min-w-[120px]">
                                                {fieldType === 'select' && fieldDef?.options ? (
                                                    <Combobox 
                                                        className="h-8 text-xs"
                                                        options={fieldDef.options.map(o => ({value: o.value, label: o.label}))}
                                                        value={filter.value}
                                                        onChange={v => {
                                                            const newF = [...editingDash.filters];
                                                            newF[idx].value = v;
                                                            setEditingDash({...editingDash, filters: newF});
                                                        }}
                                                    />
                                                ) : fieldType === 'boolean' ? (
                                                    <Combobox 
                                                        className="h-8 text-xs"
                                                        options={[{value: 'true', label: fieldDef?.booleanLabels?.true || 'Yes'}, {value: 'false', label: fieldDef?.booleanLabels?.false || 'No'}]}
                                                        value={filter.value}
                                                        onChange={v => {
                                                            const newF = [...editingDash.filters];
                                                            newF[idx].value = v;
                                                            setEditingDash({...editingDash, filters: newF});
                                                        }}
                                                    />
                                                ) : fieldType === 'date' ? (
                                                    <DatePicker 
                                                        className="h-8 text-xs"
                                                        value={filter.value ? new Date(filter.value) : undefined}
                                                        onChange={(date) => {
                                                            const newF = [...editingDash.filters];
                                                            newF[idx].value = date ? date.toISOString().split('T')[0] : '';
                                                            setEditingDash({...editingDash, filters: newF});
                                                        }}
                                                    />
                                                ) : (
                                                    <Input 
                                                        className="h-8 text-xs" 
                                                        type={fieldType === 'number' ? 'number' : 'text'}
                                                        placeholder="Value"
                                                        value={filter.value} 
                                                        onChange={e => {
                                                                const newF = [...editingDash.filters];
                                                                newF[idx].value = e.target.value;
                                                                setEditingDash({...editingDash, filters: newF});
                                                        }}
                                                    />
                                                )}
                                           </div>

                                           <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => {
                                               setEditingDash({...editingDash, filters: editingDash.filters.filter(f => f.id !== filter.id)});
                                           }}>
                                               <Trash2 className="w-4 h-4" />
                                           </Button>
                                       </div>
                                   );
                               })}
                           </CardContent>
                       </Card>

                       {/* Widgets Section */}
                       <Card className="flex flex-col">
                           <CardHeader className="flex flex-row items-center justify-between pb-2">
                               <CardTitle className="text-base">Widgets</CardTitle>
                               <Button size="sm" variant="outline" onClick={() => setEditingDash({...editingDash, widgets: [...editingDash.widgets, { id: genId(), type: 'bar', field: sourceTable?.fields[0]?.name || '' }]})}>
                                   <Plus className="w-3 h-3 mr-1" /> Add Widget
                               </Button>
                           </CardHeader>
                           <CardContent className="flex-1 space-y-2">
                               {editingDash.widgets.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4">No widgets defined.</p>}
                               {editingDash.widgets.map((widget, idx) => (
                                   <div key={widget.id} className="flex gap-2 items-center bg-muted/20 p-2 rounded border">
                                       <div className="flex-1 space-y-1">
                                           <Combobox 
                                               className="h-7 text-xs" 
                                               options={[{value:'bar', label:'Bar Chart'}, {value:'pie', label:'Pie Chart'}, {value:'summary', label:'Summary Card'}]} 
                                               value={widget.type} 
                                               onChange={v => {
                                                   const newW = [...editingDash.widgets];
                                                   newW[idx].type = v as any;
                                                   setEditingDash({...editingDash, widgets: newW});
                                               }} 
                                           />
                                       </div>
                                       <div className="flex-1 space-y-1">
                                           <Combobox 
                                                className="h-7 text-xs" 
                                                options={sourceTable?.fields.map(f => ({value: f.name, label: f.label})) || []} 
                                                value={widget.field} 
                                                onChange={v => {
                                                    const newW = [...editingDash.widgets];
                                                    newW[idx].field = v;
                                                    setEditingDash({...editingDash, widgets: newW});
                                                }} 
                                           />
                                       </div>
                                       <div className="flex-1">
                                            <Input 
                                                className="h-7 text-xs"
                                                placeholder="Title (Optional)"
                                                value={widget.title || ''}
                                                onChange={e => {
                                                    const newW = [...editingDash.widgets];
                                                    newW[idx].title = e.target.value;
                                                    setEditingDash({...editingDash, widgets: newW});
                                                }}
                                            />
                                       </div>
                                       <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                                           setEditingDash({...editingDash, widgets: editingDash.widgets.filter(w => w.id !== widget.id)});
                                       }}>
                                           <Trash2 className="w-3 h-3" />
                                       </Button>
                                   </div>
                               ))}
                           </CardContent>
                       </Card>
                   </div>
                   
                   {/* Preview Area */}
                   {sourceTable && (
                       <div className="border rounded-lg bg-slate-50 p-4">
                           <div className="text-sm font-bold text-muted-foreground mb-4 uppercase tracking-wider">Live Preview</div>
                           <DashboardView 
                               activeSchema={{
                                   ...sourceTable
                               }}
                               dashboardConfig={{
                                    title: editingDash.name,
                                    widgets: editingDash.widgets,
                                    filters: editingDash.filters,
                                    filterLogic: editingDash.filterLogic,
                                    showTable: editingDash.showTable
                               }} 
                               records={records} 
                               showHeader={false} 
                           />
                       </div>
                   )}
               </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div className="relative w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search dashboards..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" /> Create Dashboard
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDashboards.map(dash => {
                    const table = schemas.find(s => s.id === dash.tableId);
                    return (
                        <Card key={dash.id} className="hover:shadow-md transition-all cursor-pointer group relative" onClick={() => { setEditingDash(dash); setIsEditing(true); }}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">{dash.name}</CardTitle>
                                <CardDescription>Source: {table?.name || 'Unknown Table'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex gap-2 flex-wrap">
                                    <span className="text-xs bg-muted px-2 py-1 rounded border">{dash.widgets.length} Widgets</span>
                                    {dash.filters.length > 0 && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-200">{dash.filters.length} Filters ({dash.filterLogic === 'or' ? 'Any' : 'All'})</span>}
                                    {dash.isDefault && <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded border border-green-200">Default</span>}
                                </div>
                            </CardContent>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button 
                                    variant="destructive" 
                                    size="icon" 
                                    className="h-8 w-8 shadow-sm" 
                                    onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(dash.id); }}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    );
                })}
                {filteredDashboards.length === 0 && (
                    <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                        No dashboards found.
                    </div>
                )}
            </div>

            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Dashboard?</DialogTitle>
                        <DialogDescription>Are you sure you want to delete this dashboard?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={() => { if(deleteConfirmId) deleteDashboard(deleteConfirmId); setDeleteConfirmId(null); }}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export const Backoffice: React.FC = () => {
  const { t } = useTranslation();
  const { addSchema, updateSchema } = useAppStore();
  const { toast } = useToast();
  const [activeView, setActiveView] = useState('tables');
  const [editingSchema, setEditingSchema] = useState<TableSchema | null>(null);

  if (editingSchema) {
    return <SchemaManager 
      schema={editingSchema} 
      onSave={(s) => { 
        if (editingSchema.id) {
            updateSchema(s);
            toast({ title: "Schema Saved", description: "Changes updated successfully.", variant: "success" });
        } else {
            const newId = s.id || genId();
            const newSchema = { ...s, id: newId };
            addSchema(newSchema);
            setEditingSchema(newSchema);
            toast({ title: "Schema Created", description: "New table created.", variant: "success" });
        }
      }} 
      onCancel={() => setEditingSchema(null)} 
      onSelectSchema={(s) => {
          if (s) {
              setEditingSchema(s);
          } else {
              setEditingSchema({
                  id: '',
                  name: '',
                  geometryType: 'point',
                  color: '#3b82f6',
                  visibleInData: true,
                  visibleInMap: true,
                  isDefaultVisibleInMap: true,
                  fields: [],
                  planning: { enabled: false, titleField: '', startField: '' }
              });
          }
      }}
    />;
  }

  return (
    <div className="flex h-full bg-background">
      <div className="w-64 border-r bg-muted/10 flex flex-col p-4 space-y-6">
        <div>
          <h2 className="px-2 text-lg font-semibold tracking-tight mb-4">{t('cfg.title')}</h2>
          <div className="space-y-1">
            <NavItem id="tables" label={t('cfg.tables')} icon={Database} active={activeView === 'tables'} onClick={() => setActiveView('tables')} />
            <NavItem id="dashboards" label={t('cfg.dash')} icon={LayoutDashboard} active={activeView === 'dashboards'} onClick={() => setActiveView('dashboards')} />
            <NavItem id="users" label={t('cfg.users')} icon={Users} active={activeView === 'users'} onClick={() => setActiveView('users')} />
            <NavItem id="shortcuts" label={t('cfg.shortcuts')} icon={Zap} active={activeView === 'shortcuts'} onClick={() => setActiveView('shortcuts')} />
            <NavItem id="general" label={t('cfg.general')} icon={Settings} active={activeView === 'general'} onClick={() => setActiveView('general')} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {activeView === 'tables' && <TablesView setEditingSchema={setEditingSchema} />}
        {activeView === 'dashboards' && <DashboardConfigView />}
        {activeView === 'users' && <UsersSecurityView />}
        {activeView === 'shortcuts' && <ShortcutsConfigView />}
        {activeView === 'general' && <GeneralSettingsView />}
      </div>
    </div>
  );
};
