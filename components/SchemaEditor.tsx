
import React, { useState } from 'react';
import { TableSchema, FieldDefinition, FieldType } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Combobox } from './ui/combobox';
import { Switch } from './ui/switch';
import { ColorPicker } from './ColorPicker';
import { useTranslation } from '../hooks/useTranslation';
import { ChevronLeft, Plus, Trash2, GripVertical, Settings2, X } from 'lucide-react';
import { FIELD_TYPES, GEO_TYPES, DIALOG_SIZE_PRESETS } from '../constants';
import { cn, getDirtyFields } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';

interface SchemaEditorProps {
  schema: TableSchema;
  onSave: (schema: TableSchema) => void;
  onCancel: () => void;
  onSelectSchema?: (schema: TableSchema | null) => void;
}

const genId = () => Math.random().toString(36).substr(2, 9);

export const SchemaEditor: React.FC<SchemaEditorProps> = ({ schema, onSave, onCancel }) => {
  const { t } = useTranslation();
  const [localSchema, setLocalSchema] = useState<TableSchema>({ ...schema });
  const [initialSchema] = useState<TableSchema>({ ...schema }); // Keep a copy
  const [activeTab, setActiveTab] = useState<'basic' | 'fields' | 'view'>('basic');

  // Field Editing State
  const [editingField, setEditingField] = useState<FieldDefinition | null>(null);
  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false);

  // Unsaved Changes Dialog State
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

  const handleBasicChange = (key: keyof TableSchema, value: any) => {
    setLocalSchema(prev => ({ ...prev, [key]: value }));
  };

  const attemptCancel = () => {
    const labelMap: Record<string, string> = {
        name: 'Table Name',
        description: 'Description',
        geometryType: 'Geometry Type',
        color: 'Color',
        fields: 'Fields Configuration',
        visibleInData: 'Visible In Data',
        visibleInMap: 'Visible In Map',
        isDefaultVisibleInMap: 'Default Visibility',
        mapDisplayMode: 'Map Display Mode',
        hoverFields: 'Hover Fields',
        dialogConfig: 'Dialog Settings'
    };
    
    // We compare relevant properties
    const changes = getDirtyFields(initialSchema, localSchema, labelMap);
    
    if (changes.length > 0) {
        setUnsavedChanges(changes);
        setShowUnsavedDialog(true);
    } else {
        onCancel();
    }
  };

  const handleAddField = () => {
    setEditingField({
      id: genId(),
      name: '',
      label: '',
      type: 'text',
      required: false,
      sortable: true,
      filterable: true
    });
    setIsFieldModalOpen(true);
  };

  const handleEditField = (field: FieldDefinition) => {
    setEditingField({ ...field });
    setIsFieldModalOpen(true);
  };

  const handleDeleteField = (id: string) => {
    setLocalSchema(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== id)
    }));
  };

  const saveField = () => {
    if (!editingField || !editingField.name) return;
    
    // Auto-generate ID if missing
    if (!editingField.id) editingField.id = genId();

    setLocalSchema(prev => {
      const exists = prev.fields.find(f => f.id === editingField.id);
      if (exists) {
        return {
          ...prev,
          fields: prev.fields.map(f => f.id === editingField.id ? editingField : f)
        };
      } else {
        return {
          ...prev,
          fields: [...prev.fields, editingField]
        };
      }
    });
    setIsFieldModalOpen(false);
    setEditingField(null);
  };

  const handleOptionChange = (idx: number, key: 'label' | 'value' | 'color', val: string) => {
      if (!editingField || !editingField.options) return;
      const newOptions = [...editingField.options];
      newOptions[idx] = { ...newOptions[idx], [key]: val };
      setEditingField({ ...editingField, options: newOptions });
  };

  const addOption = () => {
      if (!editingField) return;
      const newOpt = { label: 'New Option', value: 'new_option', color: '#cccccc' };
      setEditingField({ ...editingField, options: [...(editingField.options || []), newOpt] });
  };

  const removeOption = (idx: number) => {
      if (!editingField || !editingField.options) return;
      setEditingField({ ...editingField, options: editingField.options.filter((_, i) => i !== idx) });
  };

  const toggleHoverField = (fieldName: string) => {
      const current = localSchema.hoverFields || [];
      const updated = current.includes(fieldName) 
        ? current.filter(f => f !== fieldName)
        : [...current, fieldName];
      handleBasicChange('hoverFields', updated);
  };

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-muted/20">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={attemptCancel}>
            <ChevronLeft className="w-4 h-4 mr-1" /> {t('common.back')}
          </Button>
          <div className="flex flex-col">
            <h2 className="text-lg font-bold">{localSchema.id ? t('common.edit') : t('common.create')} Table</h2>
            <p className="text-xs text-muted-foreground">{localSchema.name || 'Untitled Schema'}</p>
          </div>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={attemptCancel}>{t('common.cancel')}</Button>
            <Button onClick={() => onSave(localSchema)} disabled={!localSchema.name}>{t('common.save')}</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
         {/* Sidebar Tabs */}
         <div className="w-48 border-r bg-muted/10 p-2 space-y-1">
             <button 
                onClick={() => setActiveTab('basic')}
                className={cn("w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors", activeTab === 'basic' ? "bg-white shadow text-primary" : "text-muted-foreground hover:bg-muted")}
             >
                {t('schema.basic_info')}
             </button>
             <button 
                onClick={() => setActiveTab('fields')}
                className={cn("w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors", activeTab === 'fields' ? "bg-white shadow text-primary" : "text-muted-foreground hover:bg-muted")}
             >
                {t('schema.fields')}
             </button>
             <button 
                onClick={() => setActiveTab('view')}
                className={cn("w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors", activeTab === 'view' ? "bg-white shadow text-primary" : "text-muted-foreground hover:bg-muted")}
             >
                Display Settings
             </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* BASIC TAB */}
                {activeTab === 'basic' && (
                    <Card>
                        <CardHeader><CardTitle>General Information</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>{t('schema.table_name')}</Label>
                                    <Input value={localSchema.name} onChange={e => handleBasicChange('name', e.target.value)} placeholder="e.g. Assets" />
                                </div>
                                <div className="space-y-2">
                                    <Label>{t('schema.geo_type')}</Label>
                                    <Combobox 
                                        options={GEO_TYPES}
                                        value={localSchema.geometryType} 
                                        onChange={val => handleBasicChange('geometryType', val)}
                                        disabled={!!localSchema.id && localSchema.geometryType === 'mixed'}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>{t('schema.description')}</Label>
                                <Input value={localSchema.description || ''} onChange={e => handleBasicChange('description', e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>{t('schema.color')}</Label>
                                <ColorPicker color={localSchema.color} onChange={c => handleBasicChange('color', c)} />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* FIELDS TAB */}
                {activeTab === 'fields' && (
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle>Fields Definition</CardTitle>
                            <Button size="sm" onClick={handleAddField}><Plus className="w-4 h-4 mr-2" /> Add Field</Button>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {localSchema.fields.map((field, idx) => (
                                    <div key={field.id} className="flex items-center justify-between p-3 border rounded-md bg-card hover:bg-accent/50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="text-muted-foreground bg-muted p-1.5 rounded"><Settings2 className="w-4 h-4" /></div>
                                            <div>
                                                <div className="font-medium flex items-center gap-2">
                                                    {field.label} 
                                                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">{field.name}</span>
                                                </div>
                                                <div className="text-xs text-muted-foreground capitalize flex flex-wrap gap-2 items-center mt-1">
                                                    <span className="bg-secondary px-1.5 rounded border">{field.type}</span>
                                                    {field.required && <span className="text-destructive font-bold text-[10px] uppercase">Required</span>}
                                                    {(field.sortable === undefined || field.sortable) && <span className="text-blue-500 font-medium text-[10px] uppercase">Sort</span>}
                                                    {(field.filterable === undefined || field.filterable) && <span className="text-green-500 font-medium text-[10px] uppercase">Filter</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" onClick={() => handleEditField(field)}>Edit</Button>
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleDeleteField(field.id)}><Trash2 className="w-4 h-4" /></Button>
                                        </div>
                                    </div>
                                ))}
                                {localSchema.fields.length === 0 && (
                                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-md">
                                        No fields defined. Click "Add Field" to start.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* VIEW TAB */}
                {activeTab === 'view' && (
                    <Card>
                        <CardHeader><CardTitle>View Configuration</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between border-b pb-4">
                                <div className="space-y-0.5">
                                    <Label>Data Tab Visibility</Label>
                                    <p className="text-xs text-muted-foreground">Show this table in the Data tab.</p>
                                </div>
                                <Switch checked={localSchema.visibleInData} onCheckedChange={c => handleBasicChange('visibleInData', c)} />
                            </div>
                            
                            {localSchema.geometryType !== 'none' && (
                                <>
                                    <div className="flex items-center justify-between border-b pb-4">
                                        <div className="space-y-0.5">
                                            <Label>Map Layer Visibility</Label>
                                            <p className="text-xs text-muted-foreground">Show on map by default.</p>
                                        </div>
                                        <Switch checked={localSchema.isDefaultVisibleInMap} onCheckedChange={c => handleBasicChange('isDefaultVisibleInMap', c)} />
                                    </div>

                                    {/* Hover Fields Selection */}
                                    <div className="space-y-2 border-b pb-4">
                                        <div className="space-y-0.5">
                                            <Label>Hover Fields (Tooltip)</Label>
                                            <p className="text-xs text-muted-foreground">Select fields to display when hovering over features.</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded p-2 bg-muted/10">
                                            {localSchema.fields.map(f => (
                                                <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted p-1 rounded">
                                                    <input 
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                        checked={(localSchema.hoverFields || []).includes(f.name)}
                                                        onChange={() => toggleHoverField(f.name)}
                                                    />
                                                    {f.label}
                                                </label>
                                            ))}
                                            {localSchema.fields.length === 0 && <span className="text-xs text-muted-foreground italic">No fields available</span>}
                                        </div>
                                    </div>

                                    {/* Interaction Mode */}
                                    <div className="space-y-4 border-b pb-4">
                                        <div className="space-y-2">
                                            <Label>Interaction Mode (On Click)</Label>
                                            <div className="flex gap-4">
                                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-md hover:bg-muted/50 transition-colors w-full">
                                                    <input 
                                                        type="radio" 
                                                        name="mapDisplayMode" 
                                                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                                        checked={localSchema.mapDisplayMode === 'tooltip'} 
                                                        onChange={() => handleBasicChange('mapDisplayMode', 'tooltip')}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">Standard Popup</span>
                                                        <span className="text-xs text-muted-foreground">Small bubble attached to map location.</span>
                                                    </div>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-md hover:bg-muted/50 transition-colors w-full">
                                                    <input 
                                                        type="radio" 
                                                        name="mapDisplayMode" 
                                                        className="h-4 w-4 border-gray-300 text-primary focus:ring-primary"
                                                        checked={localSchema.mapDisplayMode === 'dialog'} 
                                                        onChange={() => handleBasicChange('mapDisplayMode', 'dialog')}
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-sm font-medium">Modal Dialog</span>
                                                        <span className="text-xs text-muted-foreground">Centered window with detailed view.</span>
                                                    </div>
                                                </label>
                                            </div>
                                        </div>

                                        {/* Dialog Configuration Sub-panel */}
                                        {localSchema.mapDisplayMode === 'dialog' && (
                                            <div className="p-4 bg-muted/20 rounded-md border animate-in slide-in-from-top-2">
                                                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                                                    <Settings2 className="w-3 h-3" /> Dialog Configuration
                                                </h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <Label>Size Preset</Label>
                                                        <Combobox 
                                                            options={DIALOG_SIZE_PRESETS}
                                                            value={localSchema.dialogConfig?.size || 'medium'}
                                                            onChange={(val: any) => setLocalSchema(prev => ({
                                                                ...prev,
                                                                dialogConfig: { ...prev.dialogConfig, size: val }
                                                            }))}
                                                        />
                                                    </div>
                                                    {localSchema.dialogConfig?.size === 'custom' && (
                                                        <div className="flex gap-2">
                                                            <div className="space-y-2">
                                                                <Label>Width</Label>
                                                                <Input 
                                                                    placeholder="e.g. 600px" 
                                                                    value={localSchema.dialogConfig?.width || ''} 
                                                                    onChange={e => setLocalSchema(prev => ({
                                                                        ...prev,
                                                                        dialogConfig: { ...prev.dialogConfig, width: e.target.value }
                                                                    }))}
                                                                />
                                                            </div>
                                                            <div className="space-y-2">
                                                                <Label>Height</Label>
                                                                <Input 
                                                                    placeholder="e.g. 80vh" 
                                                                    value={localSchema.dialogConfig?.height || ''} 
                                                                    onChange={e => setLocalSchema(prev => ({
                                                                        ...prev,
                                                                        dialogConfig: { ...prev.dialogConfig, height: e.target.value }
                                                                    }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

            </div>
         </div>
      </div>

      {/* Field Editor Dialog */}
      <Dialog open={isFieldModalOpen} onOpenChange={setIsFieldModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle>{editingField?.id ? 'Edit Field' : 'New Field'}</DialogTitle>
            </DialogHeader>
            {editingField && (
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Label <span className="text-red-500">*</span></Label>
                            <Input value={editingField.label} onChange={e => setEditingField({...editingField, label: e.target.value})} placeholder="Display Name" />
                        </div>
                        <div className="space-y-2">
                            <Label>Internal Name <span className="text-red-500">*</span></Label>
                            <Input 
                                value={editingField.name} 
                                onChange={e => setEditingField({...editingField, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_')})} 
                                placeholder="column_name" 
                            />
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label>Data Type</Label>
                        <Combobox 
                            options={FIELD_TYPES}
                            value={editingField.type} 
                            onChange={(val) => setEditingField({...editingField, type: val as FieldType})}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col items-center justify-center bg-muted/30 p-2 rounded border gap-2">
                            <Label className="cursor-pointer text-xs font-medium" htmlFor="req-switch">Required</Label>
                            <Switch id="req-switch" checked={editingField.required} onCheckedChange={c => setEditingField({...editingField, required: c})} />
                        </div>
                        <div className="flex flex-col items-center justify-center bg-muted/30 p-2 rounded border gap-2">
                            <Label className="cursor-pointer text-xs font-medium" htmlFor="sort-switch">Sortable</Label>
                            <Switch id="sort-switch" checked={editingField.sortable ?? true} onCheckedChange={c => setEditingField({...editingField, sortable: c})} />
                        </div>
                        <div className="flex flex-col items-center justify-center bg-muted/30 p-2 rounded border gap-2">
                            <Label className="cursor-pointer text-xs font-medium" htmlFor="filter-switch">Filterable</Label>
                            <Switch id="filter-switch" checked={editingField.filterable ?? true} onCheckedChange={c => setEditingField({...editingField, filterable: c})} />
                        </div>
                    </div>

                    {/* Options Editor for Select Type */}
                    {editingField.type === 'select' && (
                        <div className="space-y-2 border p-3 rounded-md bg-slate-50 dark:bg-slate-900">
                            <div className="flex justify-between items-center mb-2">
                                <Label className="text-xs uppercase font-bold text-muted-foreground">Dropdown Options</Label>
                                <Button size="sm" variant="outline" onClick={addOption} className="h-6 text-xs">Add Option</Button>
                            </div>
                            <div className="space-y-2">
                                {editingField.options?.map((opt, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input 
                                            value={opt.label} 
                                            onChange={e => handleOptionChange(idx, 'label', e.target.value)} 
                                            placeholder="Label" 
                                            className="h-8 text-sm"
                                        />
                                        <Input 
                                            value={opt.value} 
                                            onChange={e => handleOptionChange(idx, 'value', e.target.value)} 
                                            placeholder="Value" 
                                            className="h-8 text-sm font-mono"
                                        />
                                        <input 
                                            type="color" 
                                            value={opt.color} 
                                            onChange={e => handleOptionChange(idx, 'color', e.target.value)}
                                            className="h-8 w-8 p-0 border rounded cursor-pointer"
                                        />
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeOption(idx)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                                {(!editingField.options || editingField.options.length === 0) && (
                                    <div className="text-xs text-center text-muted-foreground py-2">No options defined.</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsFieldModalOpen(false)}>Cancel</Button>
                <Button onClick={saveField} disabled={!editingField?.name || !editingField?.label}>Save Field</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Unsaved Changes Dialog */}
       <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('common.unsaved_changes')}</DialogTitle>
                    <DialogDescription>{t('common.unsaved_desc')}</DialogDescription>
                </DialogHeader>
                <div className="py-2">
                    <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {unsavedChanges.map(field => (
                            <li key={field}>{field}</li>
                        ))}
                    </ul>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onCancel} className="text-destructive hover:text-destructive">{t('common.discard')}</Button>
                    <Button onClick={() => setShowUnsavedDialog(false)}>{t('common.continue_editing')}</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>
    </div>
  );
};
