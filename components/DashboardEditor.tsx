
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { DashboardSchema, DashboardWidget, DashboardFilter } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ChevronLeft, Plus, Trash2, LayoutDashboard, Settings, Filter, Eye } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Combobox } from './ui/combobox';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { getDirtyFields, cn } from '../lib/utils';
import { DashboardView } from './DashboardTab';

const genId = () => Math.random().toString(36).substr(2, 9);

export const DashboardEditor: React.FC = () => {
    const { dashboards, schemas, records, addDashboard, updateDashboard, deleteDashboard } = useAppStore();
    const { toast } = useToast();
    const { t } = useTranslation();

    const [editingDash, setEditingDash] = useState<DashboardSchema | null>(null);
    const [initialDash, setInitialDash] = useState<DashboardSchema | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 9;
    const totalPages = Math.ceil(dashboards.length / ITEMS_PER_PAGE);
    const pageItems = dashboards.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // Widget/Filter Editing State
    const [isWidgetModalOpen, setIsWidgetModalOpen] = useState(false);
    const [editingWidget, setEditingWidget] = useState<Partial<DashboardWidget>>({});

    // Unsaved Changes
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

    const handleCreate = () => {
        const newDash = {
            id: '',
            name: 'New Dashboard',
            tableId: schemas.length > 0 ? schemas[0].id : '',
            isDefault: false,
            showTable: true,
            widgets: [],
            filters: [],
            filterLogic: 'and' as const,
            createdAt: new Date().toISOString()
        };
        setEditingDash(newDash);
        setInitialDash(newDash);
    };

    const handleEdit = (dash: DashboardSchema) => {
        setEditingDash({ ...dash });
        setInitialDash({ ...dash });
    };

    const attemptCancel = () => {
        const labelMap: Record<string, string> = {
            name: 'Dashboard Name',
            tableId: 'Source Table',
            isDefault: 'Default Status',
            showTable: 'Show Table',
            widgets: 'Widgets',
            filters: 'Filters',
            filterLogic: 'Filter Logic'
        };

        const changes = getDirtyFields(initialDash, editingDash, labelMap);
        if (changes.length > 0) {
            setUnsavedChanges(changes);
            setShowUnsavedDialog(true);
        } else {
            setEditingDash(null);
        }
    };

    const forceCancel = () => {
        setEditingDash(null);
        setInitialDash(null);
        setShowUnsavedDialog(false);
    };

    const handleSave = () => {
        if (!editingDash || !editingDash.name || !editingDash.tableId) {
            toast({ title: "Error", description: "Name and Source Table are required.", variant: "destructive" });
            return;
        }

        if (editingDash.id) {
            updateDashboard(editingDash);
            toast({ title: "Saved", description: "Dashboard updated.", variant: "success" });
        } else {
            const newDash = { ...editingDash, id: genId() };
            addDashboard(newDash);
            toast({ title: "Created", description: "New dashboard created.", variant: "success" });
            setEditingDash(null); // Go back to list
        }
    };

    const handleDelete = (id: string) => {
        setDeleteId(id);
        setIsDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (deleteId) {
            deleteDashboard(deleteId);
            setIsDeleteOpen(false);
            setDeleteId(null);
            if (editingDash?.id === deleteId) setEditingDash(null);
            toast({ title: "Deleted", variant: "info" });
        }
    };

    // Sub-editors
    const addWidget = () => {
        setEditingWidget({ id: genId(), type: 'bar', field: '', title: '' });
        setIsWidgetModalOpen(true);
    };

    const saveWidget = () => {
        if (!editingWidget.field || !editingDash) return;
        
        const newWidget = editingWidget as DashboardWidget;
        setEditingDash(prev => ({
             ...prev!,
             widgets: [...prev!.widgets, newWidget]
        }));
        setIsWidgetModalOpen(false);
    };

    const removeWidget = (id: string) => {
        setEditingDash(prev => ({ ...prev!, widgets: prev!.widgets.filter(w => w.id !== id) }));
    };

    const addFilter = () => {
        if (!editingDash) return;
        const newFilter: DashboardFilter = {
            id: genId(),
            field: '',
            operator: 'equals',
            value: ''
        };
        setEditingDash(prev => ({ ...prev!, filters: [...prev!.filters, newFilter] }));
    };

    const updateFilter = (idx: number, key: keyof DashboardFilter, val: string) => {
        if (!editingDash) return;
        const newFilters = [...editingDash.filters];
        newFilters[idx] = { ...newFilters[idx], [key]: val };
        setEditingDash(prev => ({ ...prev!, filters: newFilters }));
    };

    const removeFilter = (idx: number) => {
        if (!editingDash) return;
        setEditingDash(prev => ({ ...prev!, filters: prev!.filters.filter((_, i) => i !== idx) }));
    };


    if (editingDash) {
        const sourceSchema = schemas.find(s => s.id === editingDash.tableId);
        const fields = sourceSchema ? sourceSchema.fields : [];

        return (
            <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={attemptCancel}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <h2 className="text-lg font-bold">{editingDash.id ? 'Edit Dashboard' : 'New Dashboard'}</h2>
                    </div>
                    <Button onClick={handleSave}>Save Dashboard</Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
                    <Card>
                        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Dashboard Name</Label>
                                    <Input value={editingDash.name} onChange={e => setEditingDash({...editingDash, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Source Table</Label>
                                    <Combobox 
                                        options={schemas.map(s => ({ value: s.id, label: s.name, color: s.color }))}
                                        value={editingDash.tableId}
                                        onChange={val => setEditingDash({...editingDash, tableId: val, widgets: [], filters: []})} // Reset widgets on table change
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between border rounded p-3 bg-muted/20">
                                <Label>Show Data Grid</Label>
                                <Switch checked={editingDash.showTable} onCheckedChange={c => setEditingDash({...editingDash, showTable: c})} />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Widgets Section */}
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-base">Widgets</CardTitle>
                                <Button size="sm" variant="outline" onClick={addWidget} disabled={!sourceSchema}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {editingDash.widgets.map((w) => (
                                    <div key={w.id} className="flex items-center justify-between p-2 border rounded bg-card text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="uppercase text-[10px] font-bold bg-primary/10 text-primary px-1.5 rounded">{w.type}</span>
                                            <span>{w.title || w.field}</span>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeWidget(w.id)}>
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                                {editingDash.widgets.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No widgets added.</p>}
                            </CardContent>
                        </Card>

                        {/* Filters Section */}
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <div className="flex items-center gap-4">
                                    <CardTitle className="text-base">Global Filters</CardTitle>
                                    {editingDash.filters.length > 1 && (
                                        <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md">
                                            <span className="text-[10px] text-muted-foreground font-medium px-1 uppercase">Logic:</span>
                                            <button
                                                onClick={() => setEditingDash({...editingDash, filterLogic: 'and'})}
                                                className={cn(
                                                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all",
                                                    (editingDash.filterLogic || 'and') === 'and' 
                                                        ? "bg-white text-primary shadow-sm" 
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                AND
                                            </button>
                                            <button
                                                onClick={() => setEditingDash({...editingDash, filterLogic: 'or'})}
                                                className={cn(
                                                    "px-2 py-0.5 text-[10px] font-bold rounded transition-all",
                                                    editingDash.filterLogic === 'or' 
                                                        ? "bg-white text-primary shadow-sm" 
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                OR
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <Button size="sm" variant="outline" onClick={addFilter} disabled={!sourceSchema}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {editingDash.filters.map((f, idx) => {
                                    const fieldDef = fields.find(field => field.name === f.field);
                                    
                                    return (
                                        <div key={f.id} className="flex flex-col gap-2 p-2 border rounded bg-card text-sm relative group">
                                             <div className="flex gap-2">
                                                 <div className="flex-1 min-w-[120px]">
                                                    <Combobox 
                                                        options={fields.map(field => ({ value: field.name, label: field.label }))}
                                                        value={f.field}
                                                        onChange={val => updateFilter(idx, 'field', val)}
                                                        placeholder="Field"
                                                        className="h-9"
                                                    />
                                                 </div>
                                                 <div className="w-[100px]">
                                                    <Combobox 
                                                        options={[
                                                            {value: 'equals', label: '='},
                                                            {value: 'neq', label: '!='},
                                                            {value: 'contains', label: 'Has'},
                                                            {value: 'gt', label: '>'},
                                                            {value: 'lt', label: '<'}
                                                        ]}
                                                        value={f.operator}
                                                        onChange={val => updateFilter(idx, 'operator', val as any)}
                                                        placeholder="Op"
                                                        className="h-9"
                                                    />
                                                 </div>
                                             </div>
                                             
                                             {/* Adaptive Value Input */}
                                             <div className="flex-1">
                                                 {fieldDef?.type === 'select' ? (
                                                     <Combobox 
                                                         options={fieldDef.options?.map(o => ({ value: o.value, label: o.label, color: o.color })) || []}
                                                         value={f.value}
                                                         onChange={val => updateFilter(idx, 'value', val)}
                                                         placeholder="Select value"
                                                         className="h-9"
                                                     />
                                                 ) : fieldDef?.type === 'boolean' ? (
                                                     <div className="flex items-center gap-3 h-9 px-3 border rounded bg-background">
                                                         <Switch 
                                                             checked={f.value === 'true'} 
                                                             onCheckedChange={(c) => updateFilter(idx, 'value', String(c))}
                                                             className="scale-75"
                                                         />
                                                         <span className="text-xs text-muted-foreground font-medium">
                                                             {f.value === 'true' ? (fieldDef.booleanLabels?.true || 'Yes') : (fieldDef.booleanLabels?.false || 'No')}
                                                         </span>
                                                     </div>
                                                 ) : fieldDef?.type === 'date' ? (
                                                     <Input 
                                                        type="date"
                                                        className="h-9 text-xs" 
                                                        value={f.value}
                                                        onChange={e => updateFilter(idx, 'value', e.target.value)}
                                                     />
                                                 ) : (
                                                     <Input 
                                                        className="h-9 text-xs" 
                                                        placeholder="Value..." 
                                                        value={f.value}
                                                        onChange={e => updateFilter(idx, 'value', e.target.value)}
                                                     />
                                                 )}
                                             </div>

                                             <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive absolute -top-2 -right-2 bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeFilter(idx)}>
                                                <Trash2 className="w-3 h-3" />
                                             </Button>
                                        </div>
                                    );
                                })}
                                {editingDash.filters.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No active filters.</p>}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Preview Section */}
                    {sourceSchema && (
                        <Card className="mt-6 border-dashed border-2 bg-muted/10">
                            <CardHeader className="pb-2 border-b border-dashed">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                                    <Eye className="w-4 h-4" /> Live Preview
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6">
                                <DashboardView 
                                    activeSchema={sourceSchema}
                                    records={records}
                                    dashboardConfig={{
                                        title: editingDash.name,
                                        widgets: editingDash.widgets,
                                        filters: editingDash.filters,
                                        filterLogic: editingDash.filterLogic,
                                        showTable: editingDash.showTable
                                    }}
                                    showHeader={false}
                                />
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Widget Modal */}
                <Dialog open={isWidgetModalOpen} onOpenChange={setIsWidgetModalOpen}>
                    <DialogContent>
                        <DialogHeader><DialogTitle>Add Widget</DialogTitle></DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input value={editingWidget.title || ''} onChange={e => setEditingWidget({...editingWidget, title: e.target.value})} placeholder="Chart Title" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Combobox 
                                        options={[
                                            {value: 'bar', label: 'Bar Chart'},
                                            {value: 'pie', label: 'Pie Chart'}
                                        ]}
                                        value={editingWidget.type || 'bar'}
                                        onChange={val => setEditingWidget({...editingWidget, type: val as any})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Field</Label>
                                    <Combobox 
                                        options={fields.filter(f => f.type === 'select' || f.type === 'boolean' || f.type === 'text').map(f => ({ value: f.name, label: f.label }))}
                                        value={editingWidget.field || ''}
                                        onChange={val => setEditingWidget({...editingWidget, field: val})}
                                        placeholder="Select Field"
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsWidgetModalOpen(false)}>Cancel</Button>
                            <Button onClick={saveWidget}>Add</Button>
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
                                <Button variant="outline" onClick={forceCancel} className="text-destructive hover:text-destructive">{t('common.discard')}</Button>
                                <Button onClick={() => setShowUnsavedDialog(false)}>{t('common.continue_editing')}</Button>
                            </DialogFooter>
                        </DialogContent>
                </Dialog>
            </div>
        );
    }

    // List View
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2"><LayoutDashboard className="w-5 h-5" /> Dashboards</h3>
                <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-2" /> New Dashboard</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageItems.map(dash => (
                    <Card key={dash.id} className="hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => handleEdit(dash)}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">{dash.name}</CardTitle>
                            <CardDescription>
                                {schemas.find(s => s.id === dash.tableId)?.name || 'Unknown Table'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex gap-2">
                                <div className="bg-muted px-2 py-1 rounded text-xs flex items-center gap-1">
                                    <LayoutDashboard className="w-3 h-3" /> {dash.widgets.length} Widgets
                                </div>
                                {dash.filters.length > 0 && (
                                    <div className="bg-muted px-2 py-1 rounded text-xs flex items-center gap-1">
                                        <Filter className="w-3 h-3" /> {dash.filters.length} Filters
                                    </div>
                                )}
                            </div>
                        </CardContent>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(dash.id); }}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
            
            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}>Prev</Button>
                    <span className="text-sm flex items-center">{page} / {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}>Next</Button>
                </div>
            )}
            
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Confirm Delete</DialogTitle></DialogHeader>
                    <p>Are you sure you want to delete this dashboard?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
