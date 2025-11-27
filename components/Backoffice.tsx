
import React, { useState, useEffect } from 'react';
import { 
  Settings, Database, Map as MapIcon, Users, LayoutDashboard, Calendar, 
  Plus, Trash2, Edit, X, ChevronRight, ChevronLeft, Check, Search, Zap, 
  List, AlignLeft, Image as ImageIcon
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store';
import { TableSchema, User, UserRole, Permission, FieldDefinition, Shortcut } from '../types';
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
  const { records, schemas } = useAppStore();
  const [activeTab, setActiveTab] = useState<'general'|'fields'|'data'|'map'|'planning'|'dashboard'>('general');
  
  const [editingSchema, setEditingSchema] = useState<TableSchema>(schema);
  const [overrideAlert, setOverrideAlert] = useState<{ show: boolean, type: 'data'|'dashboard' }>({ show: false, type: 'data' });
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
                    {id: 'dashboard', label: t('schema.dashboard'), icon: LayoutDashboard},
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

                    {activeTab === 'dashboard' && (
                        <Card>
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <CardTitle>{t('schema.dashboard')}</CardTitle>
                                    <Switch 
                                        checked={editingSchema.dashboard?.enabled} 
                                        onCheckedChange={c => setEditingSchema({...editingSchema, dashboard: c ? { enabled: true, widgets: [] } : { enabled: false, widgets: [] }})} 
                                    />
                                </div>
                            </CardHeader>
                            {editingSchema.dashboard?.enabled && (
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>{t('schema.dash_title')}</Label>
                                        <Input value={editingSchema.dashboard.title} onChange={e => setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, title: e.target.value}})} />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>{t('schema.default_dash')}</Label>
                                        <Switch 
                                            checked={editingSchema.dashboard.isDefault}
                                            onCheckedChange={c => {
                                                if(c) setOverrideAlert({ show: true, type: 'dashboard' });
                                                else setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, isDefault: false}});
                                            }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <Label>{t('schema.show_table')}</Label>
                                        <Switch checked={editingSchema.dashboard.showTable} onCheckedChange={c => setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, showTable: c}})} />
                                    </div>
                                    
                                    <div className="space-y-2 border-t pt-4">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold">Widgets</Label>
                                            <Button size="sm" variant="outline" onClick={() => setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, widgets: [...editingSchema.dashboard!.widgets, { id: genId(), type: 'bar', field: editingSchema.fields[0]?.name }]}})}>
                                                <Plus className="w-3 h-3 mr-1" /> {t('schema.add_widget')}
                                            </Button>
                                        </div>
                                        {editingSchema.dashboard.widgets.map((w, idx) => (
                                            <div key={w.id} className="flex gap-2 items-end bg-muted/20 p-2 rounded border">
                                                <div className="space-y-1 flex-1">
                                                    <Label className="text-xs">Type</Label>
                                                    <Combobox className="h-8 text-xs" options={[{value:'bar', label:'Bar Chart'}, {value:'pie', label:'Pie Chart'}, {value:'summary', label:'Summary Card'}]} value={w.type} onChange={v => {
                                                        const newW = [...editingSchema.dashboard!.widgets];
                                                        newW[idx].type = v as any;
                                                        setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, widgets: newW}});
                                                    }} />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <Label className="text-xs">Field</Label>
                                                    <Combobox className="h-8 text-xs" options={editingSchema.fields.map(f => ({value: f.name, label: f.label}))} value={w.field} onChange={v => {
                                                        const newW = [...editingSchema.dashboard!.widgets];
                                                        newW[idx].field = v;
                                                        setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, widgets: newW}});
                                                    }} />
                                                </div>
                                                <div className="space-y-1 flex-1">
                                                    <Label className="text-xs">Title</Label>
                                                    <Input className="h-8 text-xs" value={w.title} onChange={e => {
                                                        const newW = [...editingSchema.dashboard!.widgets];
                                                        newW[idx].title = e.target.value;
                                                        setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, widgets: newW}});
                                                    }} />
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                                                    const newW = editingSchema.dashboard!.widgets.filter((_, i) => i !== idx);
                                                    setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, widgets: newW}});
                                                }}>
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-t pt-4 mt-4">
                                        <Label className="mb-2 block">{t('schema.preview')}</Label>
                                        <div className="border rounded bg-slate-50 p-4 min-h-[200px]">
                                            <DashboardView activeSchema={editingSchema} records={records} showHeader={false} />
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
                        if (overrideAlert.type === 'dashboard') setEditingSchema({...editingSchema, dashboard: {...editingSchema.dashboard!, isDefault: true}});
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
          dashboard: { enabled: false, widgets: [] }
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
                 {schema.dashboard?.enabled && <span className="text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded border border-orange-200">Dashboard</span>}
                 {schema.dashboard?.isDefault && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded border border-orange-300 font-medium">Dash - Default</span>}
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

const UsersSecurityView = () => {
  const { users, roles, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<Partial<User>>({});

  const [roleSearch, setRoleSearch] = useState('');
  const [roleTypeFilter, setRoleTypeFilter] = useState('all');
  const [rolePage, setRolePage] = useState(1);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<UserRole | null>(null);
  const [roleFormData, setRoleFormData] = useState<Partial<UserRole>>({});

  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()));
  const userTotalPages = Math.ceil(filteredUsers.length / 6) || 1;
  const displayedUsers = filteredUsers.slice((userPage - 1) * 6, userPage * 6);

  const handleSaveUser = () => {
      if (!userFormData.username || !userFormData.email || !userFormData.roleId) return;
      
      if (editingUser) {
          const oldRole = roles.find(r => r.id === editingUser.roleId);
          const newRole = roles.find(r => r.id === userFormData.roleId);
          if (oldRole?.id === 'admin_role' && newRole?.id !== 'admin_role') {
              const adminCount = users.filter(u => u.roleId === 'admin_role').length;
              if (adminCount <= 1) {
                  toast({ title: "Action Denied", description: "Cannot remove the last administrator.", variant: "destructive" });
                  return;
              }
          }
          updateUser({ ...editingUser, ...userFormData } as User);
          toast({ title: t('common.success'), description: "User updated.", variant: "success" });
      } else {
          addUser({ id: genId(), createdAt: new Date().toISOString(), ...userFormData } as User);
          toast({ title: t('common.success'), description: "User created.", variant: "success" });
      }
      setIsUserModalOpen(false);
  };

  const handleDeleteUser = (id: string) => {
      const user = users.find(u => u.id === id);
      if (user?.roleId === 'admin_role') {
          const adminCount = users.filter(u => u.roleId === 'admin_role').length;
          if (adminCount <= 1) {
              toast({ title: "Action Denied", description: "Cannot delete the last administrator.", variant: "destructive" });
              return;
          }
      }
      deleteUser(id);
      toast({ title: t('common.success'), description: "User deleted.", variant: "info" });
  };

  const filteredRoles = roles.filter(r => {
      const matchesSearch = r.name.toLowerCase().includes(roleSearch.toLowerCase());
      const matchesType = roleTypeFilter === 'all' || (roleTypeFilter === 'system' ? r.isSystem : !r.isSystem);
      return matchesSearch && matchesType;
  });
  const roleTotalPages = Math.ceil(filteredRoles.length / 6) || 1;
  const displayedRoles = filteredRoles.slice((rolePage - 1) * 6, rolePage * 6);

  const handleSaveRole = () => {
      if (!roleFormData.name) return;
      if (editingRole) {
          updateRole({ ...editingRole, ...roleFormData } as UserRole);
          toast({ title: t('common.success'), description: "Role updated.", variant: "success" });
      } else {
          addRole({ id: genId(), permissions: [], ...roleFormData } as UserRole);
          toast({ title: t('common.success'), description: "Role created.", variant: "success" });
      }
      setIsRoleModalOpen(false);
  };

  return (
    <div className="space-y-6">
        <div className="flex space-x-4 border-b pb-2">
            <button onClick={() => setActiveTab('users')} className={cn("pb-2 font-medium text-sm transition-colors", activeTab === 'users' ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}>
                {t('users.tab_users')}
            </button>
            <button onClick={() => setActiveTab('roles')} className={cn("pb-2 font-medium text-sm transition-colors", activeTab === 'roles' ? "text-primary border-b-2 border-primary" : "text-muted-foreground")}>
                {t('users.tab_roles')}
            </button>
        </div>

        {activeTab === 'users' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search users..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
                    </div>
                    <Button onClick={() => { setEditingUser(null); setUserFormData({}); setIsUserModalOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> {t('users.add')}
                    </Button>
                </div>

                <div className="border rounded-md bg-card">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Username</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedUsers.map(user => {
                                const role = roles.find(r => r.id === user.roleId);
                                return (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.username}</TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell><span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border">{role?.name}</span></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" onClick={() => { setEditingUser(user); setUserFormData(user); setIsUserModalOpen(true); }}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDeleteUser(user.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
                
                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(1, p-1))} disabled={userPage === 1}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
                    <span className="text-sm self-center">Page {userPage} of {userTotalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.min(userTotalPages, p+1))} disabled={userPage === userTotalPages}><ChevronRight className="w-4 h-4" /></Button>
                </div>

                <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{editingUser ? t('users.edit') : t('users.new')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2"><Label>Username</Label><Input value={userFormData.username || ''} onChange={e => setUserFormData({...userFormData, username: e.target.value})} /></div>
                            <div className="space-y-2"><Label>Email</Label><Input value={userFormData.email || ''} onChange={e => setUserFormData({...userFormData, email: e.target.value})} /></div>
                            <div className="space-y-2"><Label>Role</Label><Combobox options={roles.map(r => ({label: r.name, value: r.id}))} value={userFormData.roleId} onChange={v => setUserFormData({...userFormData, roleId: v})} /></div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>{t('common.cancel')}</Button>
                            <Button onClick={handleSaveUser}>{t('common.save')}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )}

        {activeTab === 'roles' && (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <div className="relative w-48">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search roles..." value={roleSearch} onChange={e => setRoleSearch(e.target.value)} className="pl-9" />
                        </div>
                        <Combobox options={[{value:'all', label:'All Types'}, {value:'system', label:'System'}, {value:'custom', label:'Custom'}]} value={roleTypeFilter} onChange={setRoleTypeFilter} className="w-32" />
                    </div>
                    <Button onClick={() => { setEditingRole(null); setRoleFormData({ permissions: [] }); setIsRoleModalOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> {t('roles.create')}
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {displayedRoles.map(role => (
                        <Card key={role.id}>
                            <CardHeader className="pb-2">
                                <div className="flex justify-between">
                                    <CardTitle className="text-base">{role.name}</CardTitle>
                                    {role.isSystem && <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded border uppercase font-bold">System</span>}
                                </div>
                                <CardDescription>{role.description || 'No description'}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-xs text-muted-foreground mb-4">{role.permissions.length} Permissions assigned</div>
                                {!role.isSystem && (
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingRole(role); setRoleFormData(role); setIsRoleModalOpen(true); }}><Edit className="w-4 h-4" /></Button>
                                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteRole(role.id)}><Trash2 className="w-4 h-4" /></Button>
                                    </div>
                                )}
                                {role.isSystem && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => { setEditingRole(role); setRoleFormData(role); setIsRoleModalOpen(true); }}><Edit className="w-4 h-4" /></Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setRolePage(p => Math.max(1, p-1))} disabled={rolePage === 1}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
                    <span className="text-sm self-center">Page {rolePage} of {roleTotalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setRolePage(p => Math.min(roleTotalPages, p+1))} disabled={rolePage === roleTotalPages}><ChevronRight className="w-4 h-4" /></Button>
                </div>

                <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>{editingRole ? t('roles.edit') : t('roles.new')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>{t('roles.name')}</Label><Input value={roleFormData.name || ''} onChange={e => setRoleFormData({...roleFormData, name: e.target.value})} /></div>
                                <div className="space-y-2"><Label>Description</Label><Input value={roleFormData.description || ''} onChange={e => setRoleFormData({...roleFormData, description: e.target.value})} /></div>
                            </div>
                            <div className="space-y-2 border-t pt-2">
                                <Label className="mb-2 block">{t('roles.permissions')}</Label>
                                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                                    {PERMISSIONS_LIST.map(perm => (
                                        <label key={perm.value} className="flex items-start gap-2 p-2 border rounded hover:bg-slate-50 cursor-pointer">
                                            <Switch 
                                                checked={roleFormData.permissions?.includes(perm.value)}
                                                onCheckedChange={c => {
                                                    const current = new Set(roleFormData.permissions || []);
                                                    if (c) current.add(perm.value); else current.delete(perm.value);
                                                    setRoleFormData({...roleFormData, permissions: Array.from(current)});
                                                }}
                                            />
                                            <div>
                                                <div className="text-sm font-medium">{perm.label}</div>
                                                <div className="text-xs text-muted-foreground">{perm.description}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>{t('common.cancel')}</Button>
                            <Button onClick={handleSaveRole}>{t('common.save')}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        )}
    </div>
  );
};

const ShortcutsConfigView = () => {
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, schemas } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortcut, setEditingShortcut] = useState<Partial<Shortcut> | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  const filtered = shortcuts.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || s.type === typeFilter;
      return matchesSearch && matchesType;
  });
  const totalPages = Math.ceil(filtered.length / 6) || 1;
  const displayed = filtered.slice((page - 1) * 6, page * 6);

  const handleSave = () => {
      const newErrors: Record<string, string> = {};
      if (!editingShortcut?.name) newErrors.name = "Name is required";
      if (!editingShortcut?.type) newErrors.type = "Type is required";
      
      if (editingShortcut?.type === 'data_view' && !editingShortcut.config?.tableId) newErrors.config = "Target Table is required";
      if (editingShortcut?.type === 'quick_add' && !editingShortcut.config?.targetTableId) newErrors.config = "Target Table is required";
      if (editingShortcut?.type === 'dashboard_view' && !editingShortcut.config?.dashboardSchemaId) newErrors.config = "Dashboard is required";

      if (Object.keys(newErrors).length > 0) {
          setErrors(newErrors);
          return;
      }

      if (editingShortcut?.id) {
          updateShortcut(editingShortcut as Shortcut);
          toast({ title: t('common.success'), description: "Shortcut updated.", variant: "success" });
      } else {
          addShortcut({ id: genId(), icon: 'Zap', color: '#3b82f6', config: {}, ...editingShortcut } as Shortcut);
          toast({ title: t('common.success'), description: "Shortcut created.", variant: "success" });
      }
      setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div className="flex gap-2">
             <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search shortcuts..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
             </div>
             <Combobox options={[{value:'all', label:'All Types'}, ...SHORTCUT_TYPES]} value={typeFilter} onChange={setTypeFilter} className="w-48" />
          </div>
          <Button onClick={() => { setEditingShortcut(null); setErrors({}); setIsModalOpen(true); }}>
             <Plus className="w-4 h-4 mr-2" /> {t('shortcuts.add')}
          </Button>
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map(s => (
             <Card key={s.id} className="hover:shadow-md transition-all cursor-pointer relative group" onClick={() => { setEditingShortcut(s); setErrors({}); setIsModalOpen(true); }}>
                <CardHeader className="pb-2 flex flex-row items-center gap-3">
                   <div className="w-10 h-10 rounded flex items-center justify-center text-white shadow-sm" style={{backgroundColor: s.color}}>
                      <Zap className="w-5 h-5" /> 
                   </div>
                   <div>
                      <CardTitle className="text-base">{s.name}</CardTitle>
                      <CardDescription className="text-xs">{SHORTCUT_TYPES.find(t => t.value === s.type)?.label}</CardDescription>
                   </div>
                </CardHeader>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={(e) => { e.stopPropagation(); deleteShortcut(s.id); }}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
             </Card>
          ))}
       </div>

       <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
            <span className="text-sm self-center">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}><ChevronRight className="w-4 h-4" /></Button>
       </div>

       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
             <DialogHeader><DialogTitle>{editingShortcut?.id ? t('shortcuts.edit') : t('shortcuts.new')}</DialogTitle></DialogHeader>
             <div className="space-y-4 py-2">
                <div className="space-y-2">
                   <Label>{t('shortcuts.name')} <span className="text-red-500">*</span></Label>
                   <Input value={editingShortcut?.name || ''} onChange={e => setEditingShortcut({...editingShortcut, name: e.target.value})} className={cn(errors.name && "border-red-500")} />
                   {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                      <Label>{t('shortcuts.type')} <span className="text-red-500">*</span></Label>
                      <Combobox options={SHORTCUT_TYPES} value={editingShortcut?.type} onChange={v => setEditingShortcut({...editingShortcut, type: v as any})} className={cn(errors.type && "border-red-500")} />
                   </div>
                   <div className="space-y-2">
                      <Label>{t('shortcuts.color')}</Label>
                      <ColorPicker color={editingShortcut?.color || '#3b82f6'} onChange={c => setEditingShortcut({...editingShortcut, color: c})} />
                   </div>
                </div>
                <div className="space-y-2">
                   <Label>{t('shortcuts.icon')}</Label>
                   <Combobox options={SHORTCUT_ICONS} value={editingShortcut?.icon || 'Zap'} onChange={v => setEditingShortcut({...editingShortcut, icon: v})} />
                </div>

                <div className="border-t pt-4 space-y-4">
                   <Label className="text-xs font-bold uppercase text-muted-foreground">{t('shortcuts.config')}</Label>
                   
                   {editingShortcut?.type === 'map_preset' && (
                      <div className="space-y-2">
                         <Label>{t('shortcuts.map_preset')}</Label>
                         <div className="border rounded p-2 max-h-40 overflow-y-auto space-y-1">
                            {schemas.filter(s => s.geometryType !== 'none').map(s => (
                               <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 p-1">
                                  <input 
                                    type="checkbox" 
                                    checked={editingShortcut?.config?.layers?.includes(s.id)}
                                    onChange={e => {
                                       const current = new Set(editingShortcut?.config?.layers || []);
                                       if (e.target.checked) current.add(s.id); else current.delete(s.id);
                                       setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, layers: Array.from(current)}});
                                    }}
                                  />
                                  <div className="w-2 h-2 rounded-full" style={{background: s.color}} />
                                  {s.name}
                               </label>
                            ))}
                         </div>
                         <div className="grid grid-cols-2 gap-2 mt-2">
                             <div className="space-y-1"><Label className="text-xs">Zoom Level</Label><Input type="number" value={editingShortcut?.config?.zoom || ''} onChange={e => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, zoom: parseInt(e.target.value)}})} placeholder="13" /></div>
                         </div>
                      </div>
                   )}

                   {editingShortcut?.type === 'data_view' && (
                      <div className="space-y-2">
                         <Label>{t('shortcuts.data_view')} <span className="text-red-500">*</span></Label>
                         <Combobox options={schemas.filter(s => s.visibleInData).map(s => ({label: s.name, value: s.id}))} value={editingShortcut?.config?.tableId} onChange={v => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, tableId: v}})} />
                         {errors.config && <p className="text-xs text-red-500">{errors.config}</p>}
                         <Input placeholder="Search query (optional)" value={editingShortcut?.config?.search || ''} onChange={e => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, search: e.target.value}})} className="mt-2" />
                      </div>
                   )}

                   {editingShortcut?.type === 'quick_add' && (
                      <div className="space-y-2">
                         <Label>{t('shortcuts.quick_add')} <span className="text-red-500">*</span></Label>
                         <Combobox options={schemas.filter(s => s.geometryType !== 'none').map(s => ({label: s.name, value: s.id}))} value={editingShortcut?.config?.targetTableId} onChange={v => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, targetTableId: v}})} />
                         {errors.config && <p className="text-xs text-red-500">{errors.config}</p>}
                      </div>
                   )}

                   {editingShortcut?.type === 'map_search' && (
                      <div className="space-y-2">
                         <Label>{t('shortcuts.map_search')}</Label>
                         <Combobox options={schemas.filter(s => s.geometryType !== 'none').map(s => ({label: s.name, value: s.id}))} value={editingShortcut?.config?.filterLayerId} onChange={v => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, filterLayerId: v}})} />
                      </div>
                   )}

                   {editingShortcut?.type === 'dashboard_view' && (
                      <div className="space-y-2">
                         <Label>{t('shortcuts.dashboard_view')} <span className="text-red-500">*</span></Label>
                         <Combobox options={schemas.filter(s => s.dashboard?.enabled).map(s => ({label: s.name, value: s.id}))} value={editingShortcut?.config?.dashboardSchemaId} onChange={v => setEditingShortcut({...editingShortcut, config: {...editingShortcut?.config, dashboardSchemaId: v}})} />
                         {errors.config && <p className="text-xs text-red-500">{errors.config}</p>}
                      </div>
                   )}
                </div>
             </div>
             <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleSave}>{t('common.save')}</Button>
             </DialogFooter>
          </DialogContent>
       </Dialog>
    </div>
  );
};

const GeneralSettingsView = () => {
  const { preferences, updatePreferences } = useAppStore();
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{t('gen.appearance')}</CardTitle>
          <CardDescription>{t('gen.appearance.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>{t('gen.theme')}</Label>
            <div className="flex gap-4">
              {['light', 'dark', 'system'].map((theme) => (
                <div key={theme} className="flex items-center space-x-2">
                  <input 
                    type="radio" 
                    id={`theme-${theme}`} 
                    name="theme" 
                    checked={preferences.theme === theme} 
                    onChange={() => updatePreferences({ theme: theme as any })}
                    className="w-4 h-4 text-primary border-gray-300 focus:ring-primary"
                  />
                  <Label htmlFor={`theme-${theme}`} className="capitalize cursor-pointer">
                    {t(`gen.theme.${theme}`)}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('gen.primary')}</Label>
            <div className="flex gap-4 items-center">
              <ColorPicker color={preferences.primaryColor} onChange={(c) => updatePreferences({ primaryColor: c })} />
              <span className="text-sm text-muted-foreground">Hex: {preferences.primaryColor}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('gen.localization')}</CardTitle>
          <CardDescription>{t('gen.localization.desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 w-64">
            <Label>{t('gen.lang')}</Label>
            <Combobox 
              options={LANGUAGES} 
              value={preferences.language} 
              onChange={(val) => updatePreferences({ language: val })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const NavItem = ({ id, label, icon: Icon, active, onClick }: any) => (
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
                  planning: { enabled: false, titleField: '', startField: '' },
                  dashboard: { enabled: false, widgets: [] }
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
            <NavItem id="users" label={t('cfg.users')} icon={Users} active={activeView === 'users'} onClick={() => setActiveView('users')} />
            <NavItem id="shortcuts" label={t('cfg.shortcuts')} icon={Zap} active={activeView === 'shortcuts'} onClick={() => setActiveView('shortcuts')} />
            <NavItem id="general" label={t('cfg.general')} icon={Settings} active={activeView === 'general'} onClick={() => setActiveView('general')} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {activeView === 'tables' && <TablesView setEditingSchema={setEditingSchema} />}
        {activeView === 'users' && <UsersSecurityView />}
        {activeView === 'shortcuts' && <ShortcutsConfigView />}
        {activeView === 'general' && <GeneralSettingsView />}
      </div>
    </div>
  );
};
