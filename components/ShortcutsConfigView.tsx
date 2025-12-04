
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Shortcut, ShortcutType } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Combobox } from './ui/combobox';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { ColorPicker } from './ColorPicker';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { SHORTCUT_ICONS, SHORTCUT_TYPES } from '../constants';
import { Zap, Star, MapPin, Layers, Search, AlertTriangle, Wrench, Truck, Plus, Trash2, Edit } from 'lucide-react';
import { getDirtyFields, cn } from '../lib/utils';

const genId = () => Math.random().toString(36).substr(2, 9);

// Helper Icon Renderer
const IconRenderer = ({ name, className }: { name: string, className?: string }) => {
  const icons: Record<string, any> = { Zap, Star, MapPin, Layers, Search, AlertTriangle, Tool: Wrench, Truck };
  const LucideIcon = icons[name] || Zap;
  return <LucideIcon className={className} />;
};

export const ShortcutsConfigView: React.FC = () => {
    const { shortcuts, addShortcut, updateShortcut, deleteShortcut, schemas, dashboards } = useAppStore();
    const { toast } = useToast();

    const [editingShortcut, setEditingShortcut] = useState<Shortcut | null>(null);
    const [initialShortcut, setInitialShortcut] = useState<Shortcut | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Unsaved Changes
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

    const handleCreate = () => {
        const newShortcut: Shortcut = {
            id: '',
            name: '',
            description: '',
            icon: 'Zap',
            color: '#3b82f6',
            type: 'map_preset',
            config: {}
        };
        setEditingShortcut(newShortcut);
        setInitialShortcut(newShortcut);
    };

    const handleEdit = (s: Shortcut) => {
        setEditingShortcut({ ...s, config: { ...s.config } }); // Deep copy config
        setInitialShortcut({ ...s, config: { ...s.config } });
    };

    const handleDelete = (id: string) => {
        setDeleteId(id);
        setIsDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (deleteId) {
            deleteShortcut(deleteId);
            setIsDeleteOpen(false);
            setDeleteId(null);
            toast({ title: "Deleted", description: "Shortcut removed." });
        }
    };

    const attemptClose = () => {
        const changes = getDirtyFields(initialShortcut, editingShortcut);
        if (changes.length > 0) {
            setUnsavedChanges(changes);
            setShowUnsavedDialog(true);
        } else {
            setEditingShortcut(null);
        }
    };

    const forceClose = () => {
        setEditingShortcut(null);
        setShowUnsavedDialog(false);
    };

    const handleSave = () => {
        if (!editingShortcut || !editingShortcut.name) {
            toast({ title: "Error", description: "Name is required.", variant: "destructive" });
            return;
        }

        if (editingShortcut.id) {
            updateShortcut(editingShortcut);
            toast({ title: "Updated", description: "Shortcut updated." });
        } else {
            addShortcut({ ...editingShortcut, id: genId() });
            toast({ title: "Created", description: "New shortcut created." });
        }
        setEditingShortcut(null);
    };

    const updateConfig = (key: string, value: any) => {
        if (!editingShortcut) return;
        setEditingShortcut({
            ...editingShortcut,
            config: { ...editingShortcut.config, [key]: value }
        });
    };

    // Render configuration fields based on type
    const renderConfigFields = () => {
        if (!editingShortcut) return null;

        switch (editingShortcut.type) {
            case 'map_preset':
                return (
                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                        <Label>Visible Layers</Label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                            {schemas.filter(s => s.geometryType !== 'none').map(s => (
                                <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="rounded border-gray-300 text-primary"
                                        checked={editingShortcut.config.layers?.includes(s.id) || false}
                                        onChange={(e) => {
                                            const current = editingShortcut.config.layers || [];
                                            const next = e.target.checked 
                                                ? [...current, s.id]
                                                : current.filter(id => id !== s.id);
                                            updateConfig('layers', next);
                                        }}
                                    />
                                    <span className="w-2 h-2 rounded-full" style={{background: s.color}} />
                                    {s.name}
                                </label>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Zoom Level</Label>
                                <Input 
                                    type="number" 
                                    value={editingShortcut.config.zoom || 13} 
                                    onChange={e => updateConfig('zoom', Number(e.target.value))} 
                                />
                            </div>
                            {/* Center coordinate input could be added here or captured from map */}
                        </div>
                    </div>
                );
            case 'data_view':
                return (
                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                        <div className="space-y-2">
                            <Label>Target Table</Label>
                            <Combobox 
                                options={schemas.map(s => ({ value: s.id, label: s.name }))}
                                value={editingShortcut.config.tableId}
                                onChange={val => updateConfig('tableId', val)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default Search Query</Label>
                            <Input 
                                value={editingShortcut.config.search || ''} 
                                onChange={e => updateConfig('search', e.target.value)} 
                                placeholder="e.g. 'Critical'"
                            />
                        </div>
                    </div>
                );
            case 'dashboard_view':
                return (
                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                        <div className="space-y-2">
                            <Label>Dashboard</Label>
                            <Combobox 
                                options={dashboards.map(d => ({ value: d.id, label: d.name }))}
                                value={editingShortcut.config.dashboardSchemaId}
                                onChange={val => updateConfig('dashboardSchemaId', val)}
                            />
                        </div>
                    </div>
                );
            case 'quick_add':
                return (
                    <div className="space-y-4 border p-4 rounded-md bg-muted/10">
                        <div className="space-y-2">
                            <Label>Target Table</Label>
                            <Combobox 
                                options={schemas.filter(s => s.geometryType !== 'none').map(s => ({ value: s.id, label: s.name }))}
                                value={editingShortcut.config.targetTableId}
                                onChange={val => updateConfig('targetTableId', val)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Default JSON Data</Label>
                            <Textarea 
                                className="font-mono text-xs"
                                value={JSON.stringify(editingShortcut.config.data || {}, null, 2)}
                                onChange={e => {
                                    try {
                                        const parsed = JSON.parse(e.target.value);
                                        updateConfig('data', parsed);
                                    } catch (err) {
                                        // Ignore parse errors while typing
                                    }
                                }}
                                placeholder="{ 'priority': 'High' }"
                            />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium flex items-center gap-2"><Zap className="w-5 h-5" /> Shortcuts Configuration</h3>
                    <p className="text-sm text-muted-foreground">Customize quick access buttons for common tasks.</p>
                </div>
                <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-2" /> Add Shortcut</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {shortcuts.map(s => (
                    <Card key={s.id} className="relative group hover:shadow-md transition-all">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-md flex items-center justify-center text-white shadow-sm" style={{ background: s.color }}>
                                    <IconRenderer name={s.icon} className="w-4 h-4" />
                                </div>
                                <div>
                                    <CardTitle className="text-base">{s.name}</CardTitle>
                                    <CardDescription className="text-xs">{SHORTCUT_TYPES.find(t => t.value === s.type)?.label}</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-2">{s.description || 'No description provided.'}</p>
                        </CardContent>
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur rounded p-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(s)}>
                                <Edit className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editingShortcut} onOpenChange={(open) => !open && attemptClose()}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingShortcut?.id ? 'Edit Shortcut' : 'New Shortcut'}</DialogTitle>
                    </DialogHeader>
                    {editingShortcut && (
                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input value={editingShortcut.name} onChange={e => setEditingShortcut({...editingShortcut, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Combobox 
                                        options={SHORTCUT_TYPES}
                                        value={editingShortcut.type}
                                        onChange={val => setEditingShortcut({...editingShortcut, type: val as ShortcutType, config: {}})} // Reset config on type change
                                    />
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Input value={editingShortcut.description || ''} onChange={e => setEditingShortcut({...editingShortcut, description: e.target.value})} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Icon</Label>
                                    <Combobox 
                                        options={SHORTCUT_ICONS}
                                        value={editingShortcut.icon}
                                        onChange={val => setEditingShortcut({...editingShortcut, icon: val})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Color</Label>
                                    <ColorPicker color={editingShortcut.color} onChange={c => setEditingShortcut({...editingShortcut, color: c})} />
                                </div>
                            </div>

                            <div className="border-t pt-4">
                                <h4 className="text-sm font-medium mb-3">Action Configuration</h4>
                                {renderConfigFields()}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={attemptClose}>Cancel</Button>
                        <Button onClick={handleSave}>Save Shortcut</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Unsaved Changes Dialog */}
            <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Unsaved Changes</DialogTitle>
                        <DialogDescription>You have unsaved changes. Do you want to discard them?</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={forceClose} className="text-destructive">Discard</Button>
                        <Button onClick={() => setShowUnsavedDialog(false)}>Continue Editing</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
