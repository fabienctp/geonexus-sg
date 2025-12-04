

import React, { useState } from 'react';
import { useAppStore } from '../store';
import { CalendarSchema } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { ChevronLeft, Plus, Trash2, Calendar, Check } from 'lucide-react';
import { Combobox } from './ui/combobox';
import { Label } from './ui/label';
import { useToast } from './ui/use-toast';
import { CALENDAR_VIEWS, TIME_ZONES } from '../constants';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { getDirtyFields } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';
import { ColorPicker } from './ColorPicker';

const genId = () => Math.random().toString(36).substr(2, 9);

export const CalendarEditor: React.FC = () => {
    const { calendars, schemas, addCalendar, updateCalendar, deleteCalendar } = useAppStore();
    const { toast } = useToast();
    const { t } = useTranslation();

    const [editingCal, setEditingCal] = useState<CalendarSchema | null>(null);
    const [initialCal, setInitialCal] = useState<CalendarSchema | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);

    // Pagination
    const [page, setPage] = useState(1);
    const ITEMS_PER_PAGE = 9;
    const totalPages = Math.ceil(calendars.length / ITEMS_PER_PAGE);
    const pageItems = calendars.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    // Unsaved Changes
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

    const handleCreate = () => {
        // Find highest order to increment
        const maxOrder = calendars.reduce((max, c) => Math.max(max, c.order || 0), -1);
        
        const newCal: CalendarSchema = {
            id: '',
            name: 'New Calendar',
            tableId: schemas.length > 0 ? schemas[0].id : '',
            titleField: '',
            startField: '',
            defaultView: 'dayGridMonth',
            timeZone: 'local',
            order: maxOrder + 1,
            color: '' // Default empty to use table color
        };
        setEditingCal(newCal);
        setInitialCal(newCal);
    };

    const handleEdit = (cal: CalendarSchema) => {
        setEditingCal({ ...cal });
        setInitialCal({ ...cal });
    };

    const attemptCancel = () => {
        const labelMap: Record<string, string> = {
            name: 'Calendar Name',
            tableId: 'Source Table',
            titleField: 'Title Field',
            startField: 'Start Field',
            endField: 'End Field',
            defaultView: 'Default View',
            timeZone: 'Time Zone',
            color: 'Calendar Color',
            order: 'Display Order'
        };

        const changes = getDirtyFields(initialCal, editingCal, labelMap);
        if (changes.length > 0) {
            setUnsavedChanges(changes);
            setShowUnsavedDialog(true);
        } else {
            setEditingCal(null);
        }
    };

    const forceCancel = () => {
        setEditingCal(null);
        setInitialCal(null);
        setShowUnsavedDialog(false);
    };

    const handleSave = () => {
        if (!editingCal || !editingCal.name || !editingCal.tableId || !editingCal.titleField || !editingCal.startField) {
            toast({ title: "Validation Error", description: "Name, Source Table, Title Field, and Start Date Field are required.", variant: "destructive" });
            return;
        }

        if (editingCal.id) {
            updateCalendar(editingCal);
            toast({ title: "Saved", description: "Calendar configuration updated.", variant: "success" });
        } else {
            const newCal = { ...editingCal, id: genId() };
            addCalendar(newCal);
            toast({ title: "Created", description: "New calendar created.", variant: "success" });
            setEditingCal(null);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteId(id);
        setIsDeleteOpen(true);
    };

    const confirmDelete = () => {
        if (deleteId) {
            deleteCalendar(deleteId);
            setIsDeleteOpen(false);
            setDeleteId(null);
            if (editingCal?.id === deleteId) setEditingCal(null);
            toast({ title: "Deleted", variant: "info" });
        }
    };

    if (editingCal) {
        const sourceSchema = schemas.find(s => s.id === editingCal.tableId);
        const fields = sourceSchema ? sourceSchema.fields : [];
        const dateFields = fields.filter(f => f.type === 'date' || f.type === 'datetime');
        const textFields = fields.filter(f => f.type === 'text' || f.type === 'select');

        // Determine effective color for preview
        const effectiveColor = editingCal.color || sourceSchema?.color || '#000000';

        return (
            <div className="flex flex-col h-full bg-background animate-in slide-in-from-right-4">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-4">
                        <Button variant="outline" size="sm" onClick={attemptCancel}>
                            <ChevronLeft className="w-4 h-4 mr-2" /> Back
                        </Button>
                        <h2 className="text-lg font-bold">{editingCal.id ? 'Edit Calendar' : 'New Calendar'}</h2>
                    </div>
                    <Button onClick={handleSave}>Save Calendar</Button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
                    <Card>
                        <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Calendar Name</Label>
                                <Input value={editingCal.name} onChange={e => setEditingCal({...editingCal, name: e.target.value})} />
                            </div>

                            <div className="space-y-2">
                                <Label>Source Table</Label>
                                <Combobox 
                                    options={schemas.map(s => ({ value: s.id, label: s.name, color: s.color }))}
                                    value={editingCal.tableId}
                                    onChange={val => setEditingCal({...editingCal, tableId: val, titleField: '', startField: '', endField: '', color: ''})} // Reset color to use new table default
                                />
                            </div>

                            <div className="border-t pt-4">
                                <Label className="text-sm font-semibold mb-3 block text-muted-foreground uppercase tracking-wider">Display Settings</Label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Color Override</Label>
                                        <div className="flex flex-col gap-1">
                                            <ColorPicker 
                                                color={effectiveColor} 
                                                onChange={c => setEditingCal({...editingCal, color: c})} 
                                            />
                                            <span className="text-[10px] text-muted-foreground">
                                                {!editingCal.color ? "Using Table Color (Default)" : "Custom Color Selected"}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Sidebar Order</Label>
                                        <Input 
                                            type="number" 
                                            value={editingCal.order || 0} 
                                            onChange={e => setEditingCal({...editingCal, order: parseInt(e.target.value) || 0})}
                                        />
                                    </div>
                                </div>
                            </div>

                            {sourceSchema && (
                                <div className="grid grid-cols-2 gap-4 border p-4 rounded-md bg-muted/10">
                                    <div className="space-y-2">
                                        <Label>Event Title Field</Label>
                                        <Combobox 
                                            options={textFields.map(f => ({ value: f.name, label: f.label }))}
                                            value={editingCal.titleField}
                                            onChange={val => setEditingCal({...editingCal, titleField: val})}
                                            placeholder="Select Field"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Start Date Field</Label>
                                        <Combobox 
                                            options={dateFields.map(f => ({ value: f.name, label: f.label }))}
                                            value={editingCal.startField}
                                            onChange={val => setEditingCal({...editingCal, startField: val})}
                                            placeholder="Select Field"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>End Date Field (Optional)</Label>
                                        <Combobox 
                                            options={[{ value: '', label: 'None' }, ...dateFields.map(f => ({ value: f.name, label: f.label }))]}
                                            value={editingCal.endField || ''}
                                            onChange={val => setEditingCal({...editingCal, endField: val})}
                                            placeholder="None"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Default View</Label>
                                    <Combobox 
                                        options={CALENDAR_VIEWS}
                                        value={editingCal.defaultView}
                                        onChange={val => setEditingCal({...editingCal, defaultView: val as any})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Time Zone</Label>
                                    <Combobox 
                                        options={TIME_ZONES}
                                        value={editingCal.timeZone || 'local'}
                                        onChange={val => setEditingCal({...editingCal, timeZone: val})}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
                
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2"><Calendar className="w-5 h-5" /> Calendars</h3>
                <Button onClick={handleCreate}><Plus className="w-4 h-4 mr-2" /> New Calendar</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageItems.map(cal => {
                    const schema = schemas.find(s => s.id === cal.tableId);
                    const displayColor = cal.color || schema?.color || '#ccc';
                    return (
                        <Card key={cal.id} className="hover:shadow-md transition-shadow cursor-pointer relative group" onClick={() => handleEdit(cal)}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">{cal.name}</CardTitle>
                                    <div className="w-3 h-3 rounded-full" style={{background: displayColor}} />
                                </div>
                                <CardDescription>
                                    {schema?.name || 'Unknown Source'}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Check className="w-3 h-3 text-green-500" />
                                        {cal.titleField} mapped
                                    </div>
                                    <div className="text-xs">Order: {cal.order ?? 0}</div>
                                </div>
                            </CardContent>
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(cal.id); }}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </Card>
                    );
                })}
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
                    <p>Are you sure you want to delete this calendar configuration?</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};