
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store';
import { Edit, Trash2, Plus, FileText, Search, Map as MapIcon, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, Download, FileSpreadsheet, FileJson, Image as ImageIcon, Table as TableIcon, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
import { Switch } from './ui/switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from './ui/dropdown-menu';
import { cn } from '../lib/utils';
import { useToast } from './ui/use-toast';
import { useTranslation } from '../hooks/useTranslation';
import { DataRecord, TableSchema } from '../types';
import html2canvas from 'html2canvas';

// Helper to generate ID
const genId = () => Math.random().toString(36).substr(2, 9);

export const DataTab: React.FC = () => {
  const { schemas, records, addRecord, deleteRecord, updateRecord, setActiveTab, setMapState, dataState, setDataState } = useAppStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  // Sidebar State
  const [tableSearch, setTableSearch] = useState('');
  const [groupsOpen, setGroupsOpen] = useState({ spatial: true, data: true });

  // Filter visible schemas
  const visibleSchemas = schemas.filter(s => s.visibleInData);
  
  // Use global state
  const selectedSchemaId = dataState.activeTableId || '';
  const searchTerm = dataState.searchQuery || '';
  
  const setSelectedSchemaId = (id: string) => {
     setDataState({ activeTableId: id, searchQuery: '' }); 
     // Reset local view state on table change
     setSortConfig(null);
     setColumnFilters({});
     setShowFilters(false);
     setCurrentPage(1);
  };
  const setSearchTerm = (term: string) => setDataState({ searchQuery: term });

  // Local view state for DataTab
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Edit/Create State
  const [editingRecord, setEditingRecord] = useState<DataRecord | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false); // Track if we are creating a new record
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Set default selected schema when visibleSchemas changes
  useEffect(() => {
    if (visibleSchemas.length > 0 && !visibleSchemas.find(s => s.id === selectedSchemaId)) {
      // Prioritize the default data view configuration
      const defaultSchema = visibleSchemas.find(s => s.isDefaultInData);
      setSelectedSchemaId(defaultSchema ? defaultSchema.id : visibleSchemas[0].id);
    }
  }, [visibleSchemas, selectedSchemaId]);

  const activeSchema = visibleSchemas.find(s => s.id === selectedSchemaId);
  
  // Logic: Sidebar Grouping & Filtering
  const { spatialTables, dataTables } = useMemo(() => {
      const filtered = visibleSchemas.filter(s => s.name.toLowerCase().includes(tableSearch.toLowerCase()));
      return {
          spatialTables: filtered.filter(s => s.geometryType !== 'none'),
          dataTables: filtered.filter(s => s.geometryType === 'none')
      };
  }, [visibleSchemas, tableSearch]);

  // Logic: Filtering & Sorting
  const filteredRecords = useMemo(() => {
    if (!activeSchema) return [];
    
    let result = records.filter(r => r.tableId === selectedSchemaId);

    // 1. Apply Column Filters
    if (showFilters) {
       result = result.filter(r => {
         return Object.entries(columnFilters).every(([key, filterVal]) => {
            if (!filterVal) return true;
            const val = String(r.data[key] || '').toLowerCase();
            return val.includes(String(filterVal).toLowerCase());
         });
       });
    }

    // 2. Apply Global Search
    if (searchTerm) {
      const term = String(searchTerm).toLowerCase();
      result = result.filter(r => 
        Object.values(r.data).some((val: any) => 
          String(val).toLowerCase().includes(term)
        )
      );
    }

    // 3. Apply Sort
    if (sortConfig) {
      result.sort((a, b) => {
        const valA = a.data[sortConfig.key];
        const valB = b.data[sortConfig.key];

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [activeSchema, records, selectedSchemaId, columnFilters, showFilters, searchTerm, sortConfig]);

  // Reset pagination when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredRecords.length, activeSchema?.id]);

  // Pagination Calculation
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const displayedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      deleteRecord(deleteConfirmId);
      toast({ title: t('data.record_deleted'), description: "The data entry has been removed.", variant: "info" });
      setDeleteConfirmId(null);
    }
  };

  const handleEdit = (record: DataRecord) => {
    setEditingRecord(record);
    setFormData({ ...record.data });
    setFormErrors({});
    setIsCreating(false);
    setIsEditModalOpen(true);
  };

  const handleAddNonSpatial = () => {
    if (!activeSchema) return;
    setEditingRecord(null);
    setFormData({});
    setFormErrors({});
    setIsCreating(true);
    setIsEditModalOpen(true);
  };

  const handleAddMap = () => {
    if (!activeSchema) return;
    setMapState({ activeLayerId: activeSchema.id, toolMode: 'add' });
    setActiveTab('map');
    toast({ title: t('data.map_activated'), description: "Click on the map to add the new feature.", variant: "info" });
  };

  const handleExportCSV = () => {
    if (!activeSchema || filteredRecords.length === 0) return;

    const headers = activeSchema.fields.map(f => f.label);
    const keys = activeSchema.fields.map(f => f.name);

    const csvRows = [
        headers.join(','),
        ...filteredRecords.map(record => {
            return keys.map(key => {
                const field = activeSchema.fields.find(f => f.name === key);
                let val = record.data[key];
                
                // Format value for readability
                if (field?.type === 'boolean') {
                    const isTrue = val === true || val === 'true';
                    val = isTrue ? (field.booleanLabels?.true || 'Yes') : (field.booleanLabels?.false || 'No');
                } else if (field?.type === 'select' && field.options) {
                    // Try to map value to label if exists, otherwise keep value
                    const opt = field.options.find(o => o.value === val);
                    if (opt) val = opt.label;
                }
                
                // Escape quotes and wrap in quotes
                const stringVal = String(val || '').replace(/"/g, '""');
                return `"${stringVal}"`;
            }).join(',');
        })
    ];

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSchema.name}_export.csv`;
    a.click();
    toast({ title: t('data.export_success'), description: "CSV downloaded.", variant: "success" });
  };

  const handleExportJSON = () => {
    if (!activeSchema || filteredRecords.length === 0) return;
    const exportData = filteredRecords.map(r => r.data);
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSchema.name}_export.json`;
    a.click();
    toast({ title: t('data.export_success'), description: "JSON downloaded.", variant: "success" });
  };

  const handleExportGeoJSON = () => {
    if (!activeSchema || filteredRecords.length === 0) return;
    
    const features = filteredRecords.map(r => ({
        type: "Feature",
        geometry: r.geometry,
        properties: {
            id: r.id,
            ...r.data
        }
    }));

    const featureCollection = {
        type: "FeatureCollection",
        features: features
    };

    const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSchema.name}_export.geojson`;
    a.click();
    toast({ title: t('data.export_success'), description: "GeoJSON downloaded.", variant: "success" });
  };

  const handleExportPNG = async () => {
    if (!tableContainerRef.current) return;
    try {
        const canvas = await html2canvas(tableContainerRef.current, {
            backgroundColor: '#ffffff',
            scale: 2
        });
        const link = document.createElement('a');
        link.download = `${activeSchema?.name || 'data'}_screenshot.png`;
        link.href = canvas.toDataURL();
        link.click();
        toast({ title: t('data.export_success'), description: "Image downloaded.", variant: "success" });
    } catch (e) {
        console.error(e);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSchema) return;

    const errors: Record<string, string> = {};
    activeSchema.fields.forEach(field => {
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

    if (isCreating) {
        // Create new record
        const newRecord: DataRecord = {
            id: genId(),
            tableId: activeSchema.id,
            geometry: null, // Non-spatial entry
            data: formData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        addRecord(newRecord);
        toast({ title: t('data.record_added'), description: "New data entry created.", variant: "success" });
    } else if (editingRecord) {
        // Update existing
        updateRecord({
          ...editingRecord,
          data: formData,
          updatedAt: new Date().toISOString()
        });
        toast({ title: t('data.record_updated'), description: "Changes saved successfully.", variant: "success" });
    }
    
    setIsEditModalOpen(false);
    setEditingRecord(null);
    setIsCreating(false);
  };

  if (visibleSchemas.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
        <FileText className="w-12 h-12 opacity-20" />
        <p>{t('data.noTables')}</p>
        <p className="text-sm">{t('data.go_config')}</p>
      </div>
    );
  }

  // Helper for Sidebar List Item
  const TableListItem = ({ schema }: { schema: TableSchema }) => (
    <button
        key={schema.id}
        onClick={() => setSelectedSchemaId(schema.id)}
        className={cn(
        "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 group",
        selectedSchemaId === schema.id 
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent"
        )}
    >
        <div className="w-2 h-2 rounded-full shrink-0" style={{background: schema.color}}></div>
        <span className="truncate flex-1">{schema.name}</span>
        <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
            selectedSchemaId === schema.id ? "bg-background/50 border-primary/20" : "bg-muted border-border group-hover:bg-background"
        )}>
           {records.filter(r => r.tableId === schema.id).length}
        </span>
    </button>
  );

  return (
    <div className="flex h-full bg-background">
      {/* Sidebar - Tables List */}
      <div className="w-72 border-r bg-muted/10 flex flex-col shrink-0">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-semibold tracking-tight">{t('data.tables')}</h2>
          <div className="relative">
             <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
             <Input 
                className="h-8 pl-8 text-xs bg-background" 
                placeholder="Filter tables..." 
                value={tableSearch} 
                onChange={e => setTableSearch(e.target.value)} 
             />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Spatial Group */}
            {spatialTables.length > 0 && (
                <div className="space-y-1">
                    <button 
                        onClick={() => setGroupsOpen(prev => ({...prev, spatial: !prev.spatial}))}
                        className="w-full flex items-center justify-between px-2 text-xs font-bold text-muted-foreground uppercase hover:text-foreground transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            <MapIcon className="w-3.5 h-3.5" />
                            Spatial Tables
                        </div>
                        {groupsOpen.spatial ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    
                    {groupsOpen.spatial && (
                        <div className="space-y-1 mt-1 pl-1">
                            {spatialTables.map(schema => TableListItem({ schema }))}
                        </div>
                    )}
                </div>
            )}

            {/* Data Group */}
            {dataTables.length > 0 && (
                <div className="space-y-1">
                    <button 
                        onClick={() => setGroupsOpen(prev => ({...prev, data: !prev.data}))}
                        className="w-full flex items-center justify-between px-2 text-xs font-bold text-muted-foreground uppercase hover:text-foreground transition-colors"
                    >
                        <div className="flex items-center gap-1.5">
                            <TableIcon className="w-3.5 h-3.5" />
                            Data Tables
                        </div>
                        {groupsOpen.data ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>
                    
                    {groupsOpen.data && (
                        <div className="space-y-1 mt-1 pl-1">
                            {dataTables.map(schema => TableListItem({ schema }))}
                        </div>
                    )}
                </div>
            )}

            {spatialTables.length === 0 && dataTables.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-4 italic">
                    No tables match "{tableSearch}"
                </div>
            )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {activeSchema ? (
          <>
            <div className="p-6 border-b flex justify-between items-center bg-card">
               <div>
                 <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                   {activeSchema.name}
                   <span className="w-3 h-3 rounded-full ring-2 ring-offset-2 ring-offset-background" style={{background: activeSchema.color}}></span>
                 </h1>
                 <p className="text-muted-foreground text-sm mt-1">
                   {activeSchema.geometryType !== 'none' ? t('data.spatial') : t('data.alphanumeric')}
                 </p>
               </div>
               <div className="flex gap-3">
                 <div className="relative w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      type="search" 
                      placeholder={t('data.search')}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                 </div>
                 
                 {/* Filters Toggle */}
                 <Button 
                   variant={showFilters ? "secondary" : "outline"}
                   onClick={() => setShowFilters(!showFilters)}
                   title={t('data.toggle_filters')}
                 >
                   <Filter className={cn("w-4 h-4 mr-2", showFilters && "text-primary")} />
                   {t('data.filters')}
                 </Button>

                 {/* Export Dropdown */}
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                            <Download className="w-4 h-4 mr-2" /> {t('data.export')} <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleExportCSV}>
                            <FileSpreadsheet className="w-4 h-4 mr-2" /> {t('data.export_csv')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleExportJSON}>
                            <FileJson className="w-4 h-4 mr-2" /> {t('data.export_json')}
                        </DropdownMenuItem>
                        {activeSchema.geometryType !== 'none' && (
                            <DropdownMenuItem onClick={handleExportGeoJSON}>
                                <Globe className="w-4 h-4 mr-2" /> {t('data.export_geojson')}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={handleExportPNG}>
                            <ImageIcon className="w-4 h-4 mr-2" /> {t('data.export_png')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                 </DropdownMenu>

                 {/* Add Button Logic */}
                 {activeSchema.geometryType !== 'none' ? (
                    activeSchema.allowNonSpatialEntry ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button>
                                    <Plus className="w-4 h-4 mr-2" /> {t('data.add')} <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleAddMap}>
                                    <MapIcon className="w-4 h-4 mr-2" /> {t('data.add_map')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleAddNonSpatial}>
                                    <FileText className="w-4 h-4 mr-2" /> {t('data.add_data')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <Button onClick={handleAddMap}>
                            <MapIcon className="w-4 h-4 mr-2" /> {t('data.add')}
                        </Button>
                    )
                 ) : (
                    <Button onClick={handleAddNonSpatial}>
                        <Plus className="w-4 h-4 mr-2" /> {t('data.add')}
                    </Button>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="rounded-md border bg-card flex flex-col h-full" ref={tableContainerRef}>
                <div className="flex-1 overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        {activeSchema.fields.map(field => (
                          <TableHead 
                            key={field.id}
                            className={cn(
                              field.sortable !== false ? "cursor-pointer hover:bg-muted/50 transition-colors select-none" : ""
                            )}
                            onClick={() => field.sortable !== false && handleSort(field.name)}
                          >
                            <div className="flex items-center gap-2">
                              {field.label}
                              {field.sortable !== false && (
                                 sortConfig?.key === field.name ? (
                                   sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />
                                 ) : (
                                   <ArrowUpDown className="w-3 h-3 opacity-30" />
                                 )
                              )}
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-right w-[100px]">Actions</TableHead>
                      </TableRow>
                      
                      {/* Filter Row */}
                      {showFilters && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          {activeSchema.fields.map(field => (
                             <TableCell key={field.id} className="p-2">
                               {field.filterable !== false ? (
                                 <Input 
                                   className="h-7 text-xs bg-background" 
                                   placeholder={`Filter ${field.label}...`}
                                   value={columnFilters[field.name] || ''}
                                   onChange={(e) => setColumnFilters(prev => ({...prev, [field.name]: e.target.value}))}
                                 />
                               ) : null}
                             </TableCell>
                          ))}
                          <TableCell className="text-right p-2">
                             <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setColumnFilters({})}>
                               {t('data.clear')}
                             </Button>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {displayedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={activeSchema.fields.length + 1} className="h-24 text-center text-muted-foreground">
                            <div className="flex flex-col items-center gap-2">
                               <FileText className="w-8 h-8 opacity-20" />
                               {t('data.noRecords')}
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        displayedRecords.map(record => (
                          <TableRow key={record.id}>
                            {activeSchema.fields.map(field => {
                              const val = record.data[field.name];
                              let displayVal: React.ReactNode = String(val || '-');
                              
                              if (field.type === 'select' && field.options) {
                                 const opt = field.options.find(o => o.value === val);
                                 if (opt?.color) {
                                   displayVal = (
                                     <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{backgroundColor: `${opt.color}20`, color: opt.color, border: `1px solid ${opt.color}40`}}>
                                       <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{backgroundColor: opt.color}} />
                                       {String(val)}
                                     </span>
                                   );
                                 }
                              } else if (field.type === 'boolean') {
                                  const isTrue = val === true || val === 'true';
                                  displayVal = (
                                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", isTrue ? "bg-green-100 text-green-700 border border-green-200" : "bg-slate-100 text-slate-600 border border-slate-200")}>
                                      {isTrue ? (field.booleanLabels?.true || 'Yes') : (field.booleanLabels?.false || 'No')}
                                    </span>
                                  );
                              }
                              return (
                                <TableCell key={field.id} className="font-medium">
                                  {displayVal}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(record)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 h-8 w-8">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(record.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Pagination */}
                <div className="border-t p-4 flex items-center justify-between bg-card">
                   <div className="text-sm text-muted-foreground">
                      {t('data.showing')} {Math.min(filteredRecords.length, (currentPage - 1) * itemsPerPage + 1)} {t('data.to')} {Math.min(filteredRecords.length, currentPage * itemsPerPage)} {t('data.of')} {filteredRecords.length} {t('data.records')}
                   </div>
                   <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                         <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm font-medium">Page {currentPage} {t('data.of').replace('of', '/')} {totalPages}</span>
                      <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                         <ChevronRight className="w-4 h-4" />
                      </Button>
                   </div>
                </div>
              </div>
            </div>
            
            {/* Edit/Create Modal */}
            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
               <DialogContent>
                  <DialogHeader>
                     <DialogTitle>{isCreating ? t('data.create') : t('data.edit')}</DialogTitle>
                     <DialogDescription>
                        {isCreating ? t('data.create_desc') : t('data.edit_desc')}
                     </DialogDescription>
                  </DialogHeader>
                  <form id="data-edit-form" onSubmit={handleSaveEdit} className="space-y-4 py-2">
                     {activeSchema.fields.map(field => (
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
                  <DialogFooter>
                     <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>{t('common.cancel')}</Button>
                     <Button type="submit" form="data-edit-form">{isCreating ? t('common.add') : t('data.save')}</Button>
                  </DialogFooter>
               </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
               <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-destructive">
                       <AlertTriangle className="w-5 h-5" /> {t('data.delete_title')}
                    </DialogTitle>
                    <DialogDescription>
                       {t('data.delete_desc')}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                     <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
                     <Button variant="destructive" onClick={confirmDelete}>{t('map.confirm_delete')}</Button>
                  </DialogFooter>
               </DialogContent>
            </Dialog>

          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {t('data.select')}
          </div>
        )}
      </div>
    </div>
  );
};
