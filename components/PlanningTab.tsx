
import React, { useMemo, useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAppStore } from '../store';
import { Calendar, Check, Eye, EyeOff, Plus, X, Clock, Edit, Trash2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
import { Calendar as NavCalendar } from './ui/calendar';
import { Switch } from './ui/switch';
import { DataRecord, TableSchema } from '../types';
import { useToast } from './ui/use-toast';

// Helper to generate ID
const genId = () => Math.random().toString(36).substr(2, 9);

export const PlanningTab: React.FC = () => {
  const { schemas, records, addRecord, updateRecord, deleteRecord } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();
  const calendarRef = useRef<FullCalendar>(null);

  // Get all schemas enabled for planning
  const planningSchemas = useMemo(() => 
    schemas.filter(s => s.planning?.enabled), 
  [schemas]);

  // State to track which calendars are visible
  const [visibleSchemaIds, setVisibleSchemaIds] = useState<Set<string>>(new Set());
  
  // Navigation State
  const [currentNavDate, setCurrentNavDate] = useState<Date | undefined>(new Date());

  // Ref to track which schemas we have already initialized to prevent re-enabling hidden ones on update
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Creation/Editing State
  const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [targetSchemaId, setTargetSchemaId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedRange, setSelectedRange] = useState<{start: Date, end: Date | undefined, allDay: boolean} | null>(null);

  // Detail View State
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Smart Initialization of Visibility
  useEffect(() => {
    const newIds = new Set<string>();
    let hasNew = false;

    planningSchemas.forEach(s => {
      if (!seenIdsRef.current.has(s.id)) {
        newIds.add(s.id);
        seenIdsRef.current.add(s.id);
        hasNew = true;
      }
    });

    if (hasNew) {
      setVisibleSchemaIds(prev => {
        const next = new Set(prev);
        newIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [planningSchemas]);

  // Apply default view and timezone from the primary visible schema
  useEffect(() => {
    if (calendarRef.current && visibleSchemaIds.size > 0) {
      const api = calendarRef.current.getApi();
      // Find the first visible schema to determine the view
      const primarySchemaId = Array.from(visibleSchemaIds)[0];
      const primarySchema = schemas.find(s => s.id === primarySchemaId);
      
      if (primarySchema && primarySchema.planning) {
        const defaultView = primarySchema.planning.defaultView || 'dayGridMonth';
        if (api.view.type !== defaultView) {
           api.changeView(defaultView);
        }
      }
    }
  }, [visibleSchemaIds, schemas]);

  // Get dominant timezone (from first visible schema or 'local')
  const dominantTimeZone = useMemo(() => {
     const primarySchemaId = Array.from(visibleSchemaIds)[0];
     const primarySchema = schemas.find(s => s.id === primarySchemaId);
     return primarySchema?.planning?.timeZone || 'local';
  }, [visibleSchemaIds, schemas]);

  const toggleVisibility = (id: string) => {
    const next = new Set(visibleSchemaIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleSchemaIds(next);
  };

  const events = useMemo(() => {
    return records.flatMap(record => {
      if (!visibleSchemaIds.has(record.tableId)) return [];

      const schema = schemas.find(s => s.id === record.tableId);
      if (!schema || !schema.planning?.enabled) return [];
      
      const { titleField, startField, endField } = schema.planning;

      if (!record.data[startField]) return [];

      const title = record.data[titleField] ? String(record.data[titleField]) : 'Untitled';

      return [{
        id: record.id,
        title: `${title}`,
        start: record.data[startField],
        end: endField ? record.data[endField] : undefined,
        backgroundColor: schema.color,
        borderColor: schema.color,
        textColor: '#ffffff',
        extendedProps: {
          fullData: record.data,
          schemaName: schema.name,
          schemaColor: schema.color,
          tableId: record.tableId
        }
      }];
    });
  }, [schemas, records, visibleSchemaIds]);

  // --- Handlers ---

  const handleDateNavigate = (date: Date | undefined) => {
    if (date && calendarRef.current) {
        calendarRef.current.getApi().gotoDate(date);
        setCurrentNavDate(date);
    }
  };

  const handleDateSelect = (selectInfo: any) => {
    const range = {
        start: selectInfo.start,
        end: selectInfo.end,
        allDay: selectInfo.allDay
    };
    setSelectedRange(range);
    setEditingEventId(null);

    const activeOptions = planningSchemas.filter(s => visibleSchemaIds.has(s.id));
    
    if (planningSchemas.length === 1) {
        prepareCreateForm(planningSchemas[0].id, range);
    } else if (activeOptions.length === 1) {
        prepareCreateForm(activeOptions[0].id, range);
    } else {
        setIsSelectModalOpen(true);
    }
  };

  const handleManualAdd = () => {
    const today = { start: new Date(), end: undefined, allDay: true };
    setSelectedRange(today);
    setEditingEventId(null);

    if (planningSchemas.length === 1) {
        prepareCreateForm(planningSchemas[0].id, today);
    } else {
        setIsSelectModalOpen(true);
    }
  };

  const prepareCreateForm = (schemaId: string, range: {start: Date, end: Date | undefined, allDay: boolean}) => {
    const schema = schemas.find(s => s.id === schemaId);
    if (!schema || !schema.planning) return;

    // Auto-enable visibility if adding to a hidden calendar
    if (!visibleSchemaIds.has(schemaId)) {
       toggleVisibility(schemaId);
       toast({ title: "Calendar Enabled", description: `${schema.name} is now visible.`, variant: "info" });
    }

    setTargetSchemaId(schemaId);
    setFormErrors({});
    
    const newFormData: any = {};
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    newFormData[schema.planning.startField] = formatDate(range.start);
    
    if (schema.planning.endField && range.end) {
        let endDate = range.end;
        if (range.allDay) {
             // Subtract 1 day for display if it's all day selection
             const d = new Date(range.end);
             d.setDate(d.getDate() - 1);
             endDate = d;
             // Fix: if end became before start (single day click), reset to start
             if (endDate < range.start) endDate = range.start;
        }
        newFormData[schema.planning.endField] = formatDate(endDate);
    }

    setFormData(newFormData);
    setIsSelectModalOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleEditEvent = () => {
    if (!selectedEvent) return;
    
    setTargetSchemaId(selectedEvent.tableId);
    setFormData({ ...selectedEvent.fullData });
    setEditingEventId(selectedEvent.id);
    setFormErrors({});
    
    setIsDetailModalOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    if (confirm("Are you sure you want to delete this event?")) {
      deleteRecord(selectedEvent.id);
      toast({ title: "Event Deleted", description: "Removed from calendar.", variant: "info" });
      setIsDetailModalOpen(false);
      setSelectedEvent(null);
    }
  };

  const handleSaveEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSchemaId) return;

    const schema = schemas.find(s => s.id === targetSchemaId);
    if (schema) {
      const errors: Record<string, string> = {};
      schema.fields.forEach(field => {
        if (field.required) {
          const val = formData[field.name];
          if (val === undefined || val === null || val === '') {
            errors[field.name] = `${field.label} is required`;
          }
        }
      });

      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    }

    if (editingEventId) {
      const existingRecord = records.find(r => r.id === editingEventId);
      if (existingRecord) {
        updateRecord({
          ...existingRecord,
          data: formData,
          updatedAt: new Date().toISOString()
        });
        toast({ title: "Event Updated", description: "Calendar updated successfully.", variant: "success" });
      }
    } else {
      const newRecord: DataRecord = {
          id: genId(),
          tableId: targetSchemaId,
          geometry: null,
          data: formData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
      };
      addRecord(newRecord);
      toast({ title: "Event Created", description: "Added to calendar.", variant: "success" });
    }
    
    setIsCreateModalOpen(false);
    setFormData({});
    setTargetSchemaId(null);
    setEditingEventId(null);
    setFormErrors({});
  };

  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps;
    setSelectedEvent({
        id: info.event.id,
        title: info.event.title,
        start: info.event.start,
        end: info.event.end,
        ...props
    });
    setIsDetailModalOpen(true);
  };

  // Target Schema for Form Rendering
  const targetSchema = schemas.find(s => s.id === targetSchemaId);

  if (planningSchemas.length === 0) {
    return (
       <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
        <Calendar className="w-12 h-12 opacity-20" />
        <p>{t('plan.noPlan')}</p>
        <p className="text-sm">Go to Configuration &gt; Planning to enable tables or create a new event calendar.</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-background flex overflow-hidden">
       {/* Sidebar for Calendars */}
       <div className="w-[320px] border-r bg-muted/10 flex flex-col shrink-0">
          
          {/* Inline Navigation Calendar */}
          <div className="p-4 border-b bg-background flex justify-center">
              <NavCalendar 
                mode="single"
                selected={currentNavDate}
                onSelect={handleDateNavigate}
                className="rounded-md border shadow-sm bg-card w-full"
              />
          </div>

          <div className="p-4 border-b space-y-3">
            <h2 className="font-semibold tracking-tight flex items-center gap-2">
              <Calendar className="w-4 h-4" /> Calendars
            </h2>
            <Button className="w-full justify-start" size="sm" onClick={handleManualAdd}>
              <Plus className="w-4 h-4 mr-2" /> Add Event
            </Button>
          </div>
          <div className="p-3 space-y-1 overflow-y-auto flex-1">
            {planningSchemas.map(schema => {
              const isVisible = visibleSchemaIds.has(schema.id);
              return (
                <button
                  key={schema.id}
                  onClick={() => toggleVisibility(schema.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all",
                    isVisible 
                      ? "bg-background shadow-sm border border-border text-foreground" 
                      : "text-muted-foreground hover:bg-muted/50 opacity-70"
                  )}
                >
                  <div 
                    className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border transition-colors",
                      isVisible ? "border-transparent" : "border-muted-foreground/40"
                    )}
                    style={{ backgroundColor: isVisible ? schema.color : 'transparent' }}
                  >
                    {isVisible && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className="flex-1 text-left truncate">{schema.name}</span>
                  {isVisible ? <Eye className="w-3 h-3 opacity-50" /> : <EyeOff className="w-3 h-3 opacity-50" />}
                </button>
              );
            })}
          </div>
          <div className="p-4 text-xs text-muted-foreground border-t bg-muted/20">
             <p>Select a calendar to toggle visibility.</p>
          </div>
       </div>

       {/* Main Calendar Area */}
       <div className="flex-1 relative p-4 bg-white dark:bg-background">
         <style>{`
            .fc { height: 100%; }
            .fc-toolbar-title { font-size: 1.5rem !important; }
            .fc-event { cursor: pointer; border: none; box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05); }
         `}</style>
         <FullCalendar
           ref={calendarRef}
           plugins={[ dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin ]}
           initialView="dayGridMonth"
           timeZone={dominantTimeZone}
           headerToolbar={{
             left: 'prev,next today',
             center: 'title',
             right: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
           }}
           selectable={true}
           selectMirror={true}
           select={handleDateSelect}
           events={events}
           eventClick={handleEventClick}
           height="100%"
           dayMaxEvents={true}
           navLinks={true}
           nowIndicator={true}
         />
       </div>

       {/* --- Dialogs (Select Calendar, Create/Edit Event, Event Details) are same as before --- */}
       <Dialog open={isSelectModalOpen} onOpenChange={setIsSelectModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
             <DialogHeader>
               <DialogTitle>Select Calendar</DialogTitle>
               <DialogDescription>Choose which calendar to add this event to.</DialogDescription>
             </DialogHeader>
             <div className="grid gap-2 py-4 max-h-[60vh] overflow-y-auto">
                {planningSchemas.map(schema => (
                   <button
                     key={schema.id}
                     onClick={() => selectedRange && prepareCreateForm(schema.id, selectedRange)}
                     className="flex items-center gap-3 p-3 rounded-md border hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                   >
                      <div className="w-4 h-4 rounded-full" style={{background: schema.color}} />
                      <div className="flex-1 font-medium">
                        {schema.name}
                        {!visibleSchemaIds.has(schema.id) && <span className="text-xs text-muted-foreground ml-2">(Hidden)</span>}
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground" />
                   </button>
                ))}
             </div>
          </DialogContent>
       </Dialog>

       <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
         <DialogContent>
            <DialogHeader>
               <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{background: targetSchema?.color}} />
                  <DialogTitle>
                    {editingEventId 
                      ? `Edit ${targetSchema?.name || 'Event'}` 
                      : targetSchema ? `New ${targetSchema.name} Event` : 'New Event'}
                  </DialogTitle>
               </div>
            </DialogHeader>
            
            {targetSchema && (
               <form id="calendar-form" onSubmit={handleSaveEvent} className="space-y-4 py-2">
                  {targetSchema.fields.map(field => (
                     <div key={field.id} className="space-y-2">
                        <Label>
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                        
                        {field.type === 'select' ? (
                           <Combobox 
                              options={field.options?.map(o => ({ value: o.value, label: o.label, color: o.color })) || []}
                              value={formData[field.name] || ''}
                              onChange={val => setFormData({...formData, [field.name]: val})}
                              className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
                           />
                        ) : field.type === 'boolean' ? (
                           <div className="flex items-center space-x-2">
                              <Switch 
                                checked={formData[field.name] === 'true' || formData[field.name] === true}
                                onCheckedChange={(checked) => setFormData({...formData, [field.name]: checked})}
                              />
                              <Label className="font-normal text-sm text-muted-foreground">
                                {(formData[field.name] === 'true' || formData[field.name] === true) ? (field.booleanLabels?.true || 'Yes') : (field.booleanLabels?.false || 'No')}
                              </Label>
                           </div>
                        ) : field.type === 'date' ? (
                           <DatePicker
                              value={formData[field.name] ? new Date(formData[field.name]) : undefined}
                              onChange={(date) => setFormData({...formData, [field.name]: date ? date.toISOString().split('T')[0] : ''})}
                              className={cn(formErrors[field.name] && "border-red-500")}
                           />
                        ) : (
                           <Input 
                              type={field.type === 'number' ? 'number' : 'text'}
                              required={field.required}
                              value={formData[field.name] || ''}
                              onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                              className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
                           />
                        )}
                        {formErrors[field.name] && <p className="text-[10px] text-red-500 font-medium">{formErrors[field.name]}</p>}
                     </div>
                  ))}
               </form>
            )}

            <DialogFooter>
               <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
               <Button type="submit" form="calendar-form">{editingEventId ? 'Update Event' : 'Create Event'}</Button>
            </DialogFooter>
         </DialogContent>
       </Dialog>

       <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent>
             {selectedEvent && (
                <>
                  <DialogHeader>
                     <div className="flex items-center gap-2 mb-1">
                        <div className="w-3 h-3 rounded-full" style={{background: selectedEvent.schemaColor}} />
                        <DialogTitle>{selectedEvent.title}</DialogTitle>
                     </div>
                     <DialogDescription>
                        {selectedEvent.schemaName}
                     </DialogDescription>
                  </DialogHeader>
                  
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                     <div className="flex gap-3 p-3 bg-muted/30 rounded-md border">
                        <Clock className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="space-y-1">
                           <div className="font-medium">
                              {selectedEvent.start?.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                           </div>
                           {selectedEvent.end && (
                              <div className="text-sm text-muted-foreground">
                                 to {selectedEvent.end.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                              </div>
                           )}
                        </div>
                     </div>

                     <div className="space-y-0">
                        {Object.entries(selectedEvent.fullData).map(([key, val]) => {
                           const schema = schemas.find(s => s.id === selectedEvent.tableId);
                           const fieldDef = schema?.fields.find(f => f.name === key);
                           let displayVal: React.ReactNode = String(val || '-');
                           
                           if (fieldDef?.type === 'select' && fieldDef.options) {
                              const opt = fieldDef.options.find(o => o.value === val);
                              if (opt?.color) {
                                displayVal = (
                                  <span className="inline-flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: opt.color}} />
                                    {String(val)}
                                  </span>
                                );
                              }
                           } else if (fieldDef?.type === 'boolean') {
                              const isTrue = val === true || val === 'true';
                              displayVal = isTrue ? (fieldDef.booleanLabels?.true || 'Yes') : (fieldDef.booleanLabels?.false || 'No');
                           }

                           return (
                             <div key={key} className="grid grid-cols-3 items-center gap-4 border-b py-3 last:border-0">
                                <Label className="text-muted-foreground capitalize font-normal">{key.replace(/_/g, ' ')}</Label>
                                <div className="col-span-2 font-medium break-words text-sm">
                                   {displayVal}
                                </div>
                             </div>
                           );
                        })}
                     </div>
                  </div>

                  <DialogFooter className="flex justify-between sm:justify-between gap-2">
                     <Button variant="destructive" onClick={handleDeleteEvent}>
                        <Trash2 className="w-4 h-4 mr-2" /> Delete
                     </Button>
                     <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
                        <Button onClick={handleEditEvent}>
                           <Edit className="w-4 h-4 mr-2" /> Edit
                        </Button>
                     </div>
                  </DialogFooter>
                </>
             )}
          </DialogContent>
       </Dialog>
    </div>
  );
};
