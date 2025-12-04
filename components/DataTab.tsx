
import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { DataRecord, TableSchema } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
import { Switch } from './ui/switch';
import { Select } from './ui/select';
import { useToast } from './ui/use-toast';
import { cn, getDirtyFields } from '../lib/utils';
import { 
  Plus, Search, Edit, Trash2, MapPin, Filter, 
  ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutList, Map as MapIcon, Database, SlidersHorizontal, X,
  ChevronsLeft, ChevronsRight
} from 'lucide-react';

const genId = () => Math.random().toString(36).substr(2, 9);

export const DataTab: React.FC = () => {
  const { schemas, records, mapState, dataState, setDataState, addRecord, updateRecord, deleteRecord, setMapState, setActiveTab, hasPermission } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  const [localSearch, setLocalSearch] = useState(dataState.searchQuery || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);

  const canEdit = hasPermission('edit_data');

  // Table Features State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Editing State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [initialFormData, setInitialFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Unsaved Changes
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

  // Active Schema Logic
  // Default to first available if none selected
  const activeSchemaId = dataState.activeTableId || (schemas.length > 0 ? schemas[0].id : null);
  const activeSchema = schemas.find(s => s.id === activeSchemaId);

  // Group Schemas for Sidebar
  const spatialSchemas = schemas.filter(s => s.geometryType !== 'none');
  const alphanumericSchemas = schemas.filter(s => s.geometryType === 'none');
  
  // Update local search when global state changes
  React.useEffect(() => {
     setLocalSearch(dataState.searchQuery);
  }, [dataState.searchQuery]);

  // Handle Table Selection
  const handleTableChange = (id: string) => {
     setDataState({ activeTableId: id, searchQuery: '' });
     setLocalSearch('');
     setColumnFilters({});
     setSortConfig(null);
     setCurrentPage(1);
  };

  // --- Filtering & Sorting Logic ---
  const processedRecords = useMemo(() => {
     if (!activeSchema) return [];
     
     // 1. Filter by Table
     let result = records.filter(r => r.tableId === activeSchema.id);
     
     // 2. Global Search
     if (localSearch) {
        const lower = localSearch.toLowerCase();
        result = result.filter(r => 
           Object.values(r.data).some(v => String(v).toLowerCase().includes(lower))
        );
     }

     // 3. Column Filters
     if (showFilters) {
         Object.entries(columnFilters).forEach(([key, filterValue]) => {
             if (!filterValue) return;
             const lowerFilter = String(filterValue).toLowerCase();
             result = result.filter(r => {
                 const val = r.data[key];
                 return String(val || '').toLowerCase().includes(lowerFilter);
             });
         });
     }

     // 4. Sorting
     if (sortConfig) {
         result.sort((a, b) => {
             const valA = a.data[sortConfig.key];
             const valB = b.data[sortConfig.key];
             
             // Handle Dates
             if (activeSchema.fields.find(f => f.name === sortConfig.key)?.type === 'date') {
                 const dateA = new Date(valA || 0).getTime();
                 const dateB = new Date(valB || 0).getTime();
                 return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
             }

             // Handle Numbers
             if (typeof valA === 'number' && typeof valB === 'number') {
                 return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
             }

             // Default String Comparison
             const strA = String(valA || '').toLowerCase();
             const strB = String(valB || '').toLowerCase();
             if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
             if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
             return 0;
         });
     }

     return result;
  }, [records, activeSchema, localSearch, columnFilters, sortConfig, showFilters]);

  // Pagination
  const totalPages = Math.ceil(processedRecords.length / itemsPerPage);
  const currentRecords = processedRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Adjust current page if out of bounds (e.g. after filtering)
  React.useEffect(() => {
      if (currentPage > totalPages && totalPages > 0) {
          setCurrentPage(totalPages);
      }
  }, [totalPages, currentPage]);

  // Sorting Handler
  const handleSort = (key: string) => {
      setSortConfig(current => {
          if (current?.key === key) {
              return current.direction === 'asc' ? { key, direction: 'desc' } : null;
          }
          return { key, direction: 'asc' };
      });
  };

  // CRUD Handlers
  const handleEditClick = (record: DataRecord) => {
     setEditingRecordId(record.id);
     setFormData({ ...record.data });
     setInitialFormData({ ...record.data });
     setFormErrors({});
     setIsEditModalOpen(true);
  };

  const handleCreateClick = () => {
     setEditingRecordId(null);
     setFormData({});
     setInitialFormData({});
     setFormErrors({});
     setIsEditModalOpen(true);
  };

  const attemptCloseModal = () => {
     const labelMap: Record<string, string> = {};
     activeSchema?.fields.forEach(f => labelMap[f.name] = f.label);

     const changes = getDirtyFields(initialFormData, formData, labelMap);
     if (changes.length > 0) {
         setUnsavedChanges(changes);
         setShowUnsavedDialog(true);
     } else {
         forceCloseModal();
     }
  };

  const forceCloseModal = () => {
     setIsEditModalOpen(false);
     setFormData({});
     setInitialFormData({});
     setFormErrors({});
     setEditingRecordId(null);
     setShowUnsavedDialog(false);
  };

  const handleFormDataChange = (field: string, value: any) => {
     setFormData(prev => ({ ...prev, [field]: value }));
     if (formErrors[field]) {
        setFormErrors(prev => ({ ...prev, [field]: '' }));
     }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
     e.preventDefault();
     if (!activeSchema) return;

     const errors: Record<string, string> = {};
     activeSchema.fields.forEach(f => {
        if (f.required) {
           const val = formData[f.name];
           if (val === undefined || val === null || val === '') {
              errors[f.name] = `${f.label} is required`;
           }
        }
     });

     if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
     }

     if (editingRecordId) {
        const original = records.find(r => r.id === editingRecordId);
        if (original) {
           updateRecord({
              ...original,
              data: formData,
              updatedAt: new Date().toISOString()
           });
           toast({ title: t('data.record_updated'), variant: 'success' });
        }
     } else {
        const newRec: DataRecord = {
           id: genId(),
           tableId: activeSchema.id,
           geometry: null,
           data: formData,
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString()
        };
        addRecord(newRec);
        toast({ title: t('data.record_added'), variant: 'success' });
     }
     forceCloseModal();
  };

  const handleDeleteClick = (id: string) => {
      setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
      if (deleteConfirmId) {
          deleteRecord(deleteConfirmId);
          toast({ title: t('data.record_deleted'), variant: 'info' });
          setDeleteConfirmId(null);
      }
  };

  const locateOnMap = (record: DataRecord) => {
      if (!record.geometry) {
          toast({ title: "No Geometry", description: "This record has no map location.", variant: "destructive" });
          return;
      }
      setActiveTab('map');
      
      let center: [number, number] | undefined;
      if (record.geometry.type === 'Point') {
          center = [record.geometry.coordinates[0], record.geometry.coordinates[1]];
      } else if (record.geometry.coordinates && record.geometry.coordinates.length > 0) {
          const first = record.geometry.coordinates[0];
          center = Array.isArray(first) ? [first[0], first[1]] : undefined;
      }

      setMapState({
          activeLayerId: record.tableId,
          center: center,
          zoom: 16,
          visibleLayers: Array.from(new Set([...mapState.visibleLayers, record.tableId]))
      });
  };

  // Helper to render pagination numbers
  const renderPaginationNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    // Logic to show a sliding window of pages
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    // Adjust start if we're near the end
    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    // Always show first page if we are far from it
    if (startPage > 1) {
        pages.push(
            <Button key={1} variant="outline" size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(1)}>1</Button>
        );
        if (startPage > 2) {
            pages.push(<span key="start-ellipsis" className="flex items-center justify-center w-8 text-muted-foreground text-xs">...</span>);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        pages.push(
            <Button
                key={i}
                variant={currentPage === i ? "default" : "outline"}
                size="sm"
                className="w-8 h-8 p-0"
                onClick={() => setCurrentPage(i)}
            >
                {i}
            </Button>
        );
    }

    // Always show last page if we are far from it
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            pages.push(<span key="end-ellipsis" className="flex items-center justify-center w-8 text-muted-foreground text-xs">...</span>);
        }
        pages.push(
            <Button key={totalPages} variant="outline" size="sm" className="w-8 h-8 p-0" onClick={() => setCurrentPage(totalPages)}>{totalPages}</Button>
        );
    }

    return pages;
  };

  const isCreating = !editingRecordId;

  return (
    <div className="flex h-full bg-background overflow-hidden">
        {/* SIDEBAR: Table List */}
        <div className="w-64 border-r bg-muted/10 flex flex-col flex-shrink-0">
            <div className="p-4 border-b bg-background/50 backdrop-blur">
                <h2 className="font-semibold text-lg tracking-tight flex items-center gap-2">
                    <Database className="w-5 h-5 text-primary" />
                    Data Explorer
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-6">
                {spatialSchemas.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                           {t('data.spatial')}
                        </h3>
                        <div className="space-y-1">
                            {spatialSchemas.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleTableChange(s.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all group relative",
                                        activeSchemaId === s.id 
                                            ? "bg-primary/10 text-primary font-medium" 
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <div className={cn("w-1 h-8 absolute left-0 top-1/2 -translate-y-1/2 bg-primary rounded-r-full transition-transform", activeSchemaId === s.id ? "scale-y-100" : "scale-y-0")} />
                                    <span className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm" style={{background: s.color}} />
                                    <span className="truncate">{s.name}</span>
                                    {activeSchemaId === s.id && <MapIcon className="w-3 h-3 ml-auto opacity-50" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {alphanumericSchemas.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-2">
                           {t('data.alphanumeric')}
                        </h3>
                        <div className="space-y-1">
                            {alphanumericSchemas.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => handleTableChange(s.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all group relative",
                                        activeSchemaId === s.id 
                                            ? "bg-primary/10 text-primary font-medium" 
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <div className={cn("w-1 h-8 absolute left-0 top-1/2 -translate-y-1/2 bg-primary rounded-r-full transition-transform", activeSchemaId === s.id ? "scale-y-100" : "scale-y-0")} />
                                    <LayoutList className="w-4 h-4" />
                                    <span className="truncate">{s.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                
                {schemas.length === 0 && (
                    <div className="text-center p-4 text-sm text-muted-foreground">
                        {t('data.noTables')}
                        <Button variant="link" className="mt-2 h-auto p-0" onClick={() => setActiveTab('settings')}>
                           {t('data.go_config')}
                        </Button>
                    </div>
                )}
            </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
            {activeSchema ? (
                <>
                    {/* Toolbar */}
                    <div className="h-16 border-b bg-background flex items-center justify-between px-6 shrink-0 gap-4">
                        <div className="flex flex-col">
                             <h1 className="text-lg font-semibold flex items-center gap-2">
                                 {activeSchema.name}
                                 <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                    {processedRecords.length} {t('data.records')}
                                 </span>
                             </h1>
                             <p className="text-xs text-muted-foreground truncate max-w-[300px]">{activeSchema.description}</p>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Toggle Column Filters */}
                            <Button 
                                variant={showFilters ? 'secondary' : 'outline'} 
                                size="sm" 
                                onClick={() => setShowFilters(!showFilters)}
                                className={cn(showFilters && "bg-blue-50 text-blue-600 border-blue-200")}
                            >
                                <Filter className="w-4 h-4 mr-2" />
                                {t('data.filters')}
                            </Button>

                            {/* Global Search */}
                            <div className="relative w-64">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder={t('data.search')}
                                    value={localSearch}
                                    onChange={e => { setLocalSearch(e.target.value); setCurrentPage(1); }}
                                    className="pl-9 h-9"
                                />
                            </div>

                            {/* Add Button */}
                            {canEdit && (
                                <Button onClick={handleCreateClick} size="sm" className="ml-2">
                                    <Plus className="w-4 h-4 mr-2" /> {t('common.add')}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="flex-1 overflow-auto p-6 flex flex-col">
                        <div className="bg-background rounded-md border shadow-sm overflow-hidden flex-1">
                            <Table>
                                <TableHeader className="bg-muted/30">
                                    <TableRow>
                                        <TableHead className="w-[60px] text-center">#</TableHead>
                                        {activeSchema.fields.map(f => (
                                            <TableHead key={f.id} className="min-w-[150px]">
                                                <button 
                                                    className={cn(
                                                        "flex items-center gap-1 font-semibold text-xs uppercase tracking-wider hover:text-primary transition-colors",
                                                        sortConfig?.key === f.name ? "text-primary" : "text-muted-foreground"
                                                    )}
                                                    onClick={() => f.sortable !== false && handleSort(f.name)}
                                                >
                                                    {f.label}
                                                    {sortConfig?.key === f.name ? (
                                                        sortConfig.direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                                                    ) : (
                                                        f.sortable !== false && <ArrowUpDown className="w-3 h-3 opacity-30" />
                                                    )}
                                                </button>
                                            </TableHead>
                                        ))}
                                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                                    </TableRow>
                                    
                                    {/* Column Filters Row */}
                                    {showFilters && (
                                        <TableRow className="bg-blue-50/50 hover:bg-blue-50/50">
                                            <TableHead></TableHead>
                                            {activeSchema.fields.map(f => (
                                                <TableHead key={f.id} className="py-2">
                                                    {f.filterable !== false && (
                                                        <div className="relative">
                                                            <Input 
                                                                className="h-7 text-xs pr-6" 
                                                                placeholder={`Filter ${f.label}...`}
                                                                value={columnFilters[f.name] || ''}
                                                                onChange={e => {
                                                                    setColumnFilters(prev => ({ ...prev, [f.name]: e.target.value }));
                                                                    setCurrentPage(1);
                                                                }}
                                                            />
                                                            {columnFilters[f.name] && (
                                                                <button 
                                                                    className="absolute right-1 top-1.5 text-muted-foreground hover:text-destructive"
                                                                    onClick={() => setColumnFilters(prev => ({ ...prev, [f.name]: '' }))}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </TableHead>
                                            ))}
                                            <TableHead></TableHead>
                                        </TableRow>
                                    )}
                                </TableHeader>
                                <TableBody>
                                    {currentRecords.map((record, idx) => (
                                        <TableRow key={record.id} className="group hover:bg-muted/30">
                                            <TableCell className="text-center text-xs text-muted-foreground bg-muted/5 font-mono">
                                                {(currentPage - 1) * itemsPerPage + idx + 1}
                                            </TableCell>
                                            {activeSchema.fields.map(f => {
                                                const val = record.data[f.name];
                                                let display = val;
                                                if (f.type === 'select') {
                                                    const opt = f.options?.find(o => o.value === val);
                                                    if (opt?.color) {
                                                        display = (
                                                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border bg-white" style={{borderColor: opt.color + '40'}}>
                                                                <span className="w-1.5 h-1.5 rounded-full" style={{background: opt.color}} />
                                                                {val}
                                                            </span>
                                                        );
                                                    }
                                                } else if (f.type === 'boolean') {
                                                    display = val ? (
                                                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs font-medium border border-green-100">{f.booleanLabels?.true || 'Yes'}</span>
                                                    ) : (
                                                        <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded text-xs font-medium border border-slate-200">{f.booleanLabels?.false || 'No'}</span>
                                                    );
                                                }
                                                return (
                                                    <TableCell key={f.id} className="py-3 text-sm max-w-[200px] truncate" title={String(val)}>
                                                        {display}
                                                    </TableCell>
                                                );
                                            })}
                                            <TableCell className="text-right py-2">
                                                <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                    {record.geometry && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => locateOnMap(record)} title="Locate on Map">
                                                            <MapPin className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                    {canEdit && (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 hover:text-slate-900" onClick={() => handleEditClick(record)} title="Edit">
                                                                <Edit className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDeleteClick(record.id)} title="Delete">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {currentRecords.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={activeSchema.fields.length + 2} className="h-48 text-center">
                                                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                                    <SlidersHorizontal className="w-8 h-8 opacity-20" />
                                                    <p>{t('data.noRecords')}</p>
                                                    {(localSearch || Object.keys(columnFilters).some(k => columnFilters[k])) && (
                                                        <Button variant="link" size="sm" onClick={() => { setLocalSearch(''); setColumnFilters({}); }}>Clear Filters</Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Pagination */}
                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                            <div className="flex items-center gap-4">
                                <div className="text-xs text-muted-foreground">
                                    {t('data.showing')} {(currentPage - 1) * itemsPerPage + 1} {t('data.to')} {Math.min(currentPage * itemsPerPage, processedRecords.length)} {t('data.of')} {processedRecords.length}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Rows per page</span>
                                    <Select 
                                        className="h-8 w-[70px] text-xs" 
                                        value={String(itemsPerPage)} 
                                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                    >
                                        <option value="10">10</option>
                                        <option value="15">15</option>
                                        <option value="25">25</option>
                                        <option value="50">50</option>
                                        <option value="100">100</option>
                                    </Select>
                                </div>
                            </div>
                            
                            {totalPages > 1 && (
                                <div className="flex gap-2 items-center">
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="h-8 w-8 p-0" title="First Page">
                                        <ChevronsLeft className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage === 1} className="h-8 w-8 p-0" title="Previous Page">
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    
                                    <div className="flex items-center gap-1 mx-2">
                                        {renderPaginationNumbers()}
                                    </div>

                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p+1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0" title="Next Page">
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="h-8 w-8 p-0" title="Last Page">
                                        <ChevronsRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
                    <Database className="w-16 h-16 opacity-10 mb-4" />
                    <p className="text-lg font-medium">{t('data.select')}</p>
                </div>
            )}
        </div>

        {/* Edit/Create Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => !open && attemptCloseModal()}>
          <DialogContent className="sm:max-w-[500px]">
             <DialogHeader>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary/10 text-primary">
                        {isCreating ? <Plus className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                    </div>
                    <div>
                        <DialogTitle>{isCreating ? t('data.create') : t('data.edit')}</DialogTitle>
                        <DialogDescription>
                        {isCreating ? t('data.create_desc') : t('data.edit_desc')}
                        </DialogDescription>
                    </div>
                </div>
             </DialogHeader>
             {activeSchema && (
                 <form id="data-edit-form" onSubmit={handleSaveEdit} className="space-y-4 py-2 max-h-[60vh] overflow-y-auto px-1">
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
                                onChange={val => handleFormDataChange(field.name, val)}
                                className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
                            />
                        ) : field.type === 'boolean' ? (
                            <div className="flex items-center space-x-2 border p-3 rounded-md bg-muted/20">
                            <Switch 
                                checked={formData[field.name] === 'true' || formData[field.name] === true}
                                onCheckedChange={(checked) => handleFormDataChange(field.name, checked)}
                            />
                            <Label className="font-normal text-sm cursor-pointer" onClick={() => handleFormDataChange(field.name, !formData[field.name])}>
                                {(formData[field.name] === 'true' || formData[field.name] === true) ? (field.booleanLabels?.true || 'Yes') : (field.booleanLabels?.false || 'No')}
                            </Label>
                            </div>
                        ) : field.type === 'date' ? (
                            <DatePicker
                                value={formData[field.name] ? new Date(formData[field.name]) : undefined}
                                onChange={(date) => handleFormDataChange(field.name, date ? date.toISOString().split('T')[0] : '')}
                                className={cn(formErrors[field.name] && "border-red-500")}
                            />
                        ) : field.type === 'datetime' ? (
                            <Input
                                type="datetime-local"
                                required={field.required}
                                value={formData[field.name] ? String(formData[field.name]).slice(0, 16) : ''}
                                onChange={e => handleFormDataChange(field.name, e.target.value)}
                                className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
                            />
                        ) : (
                            <Input 
                                type={field.type === 'number' ? 'number' : 'text'}
                                required={field.required}
                                value={formData[field.name] || ''}
                                onChange={e => handleFormDataChange(field.name, e.target.value)}
                                className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
                            />
                        )}
                        {formErrors[field.name] && <p className="text-[10px] text-red-500 font-medium animate-in slide-in-from-top-1">{formErrors[field.name]}</p>}
                    </div>
                    ))}
                 </form>
             )}
             <DialogFooter>
                <Button variant="outline" onClick={attemptCloseModal}>{t('common.cancel')}</Button>
                <Button type="submit" form="data-edit-form">{isCreating ? t('common.add') : t('data.save')}</Button>
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
                    <Button variant="outline" onClick={forceCloseModal} className="text-destructive hover:text-destructive">{t('common.discard')}</Button>
                    <Button onClick={() => setShowUnsavedDialog(false)}>{t('common.continue_editing')}</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

       {/* Delete Confirmation */}
       <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
          <DialogContent>
              <DialogHeader>
                  <DialogTitle>{t('data.delete_title')}</DialogTitle>
                  <DialogDescription>{t('data.delete_desc')}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>{t('common.cancel')}</Button>
                  <Button variant="destructive" onClick={confirmDelete}>{t('common.delete')}</Button>
              </DialogFooter>
          </DialogContent>
       </Dialog>
    </div>
  );
};
