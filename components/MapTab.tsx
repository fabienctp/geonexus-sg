

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
// CSS is loaded via index.html
import { useAppStore } from '../store';
import { DataRecord } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { 
  MousePointer2, Plus, Move, Ruler, Filter, Printer, 
  Trash2, X, Map as MapIcon, Layers, Search, ChevronDown, ChevronUp,
  CircleDot, Hexagon, Spline, Undo2, Redo2, Save, Target, PenLine,
  FileDown, ChevronRight, AlertTriangle, Globe, GripVertical, Maximize2
} from 'lucide-react';
import { cn, getDirtyFields } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useToast } from './ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Combobox } from './ui/combobox';
import { DatePicker } from './ui/date-picker';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Fix Leaflet marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface HistoryAction {
  recordId: string;
  previousGeometry: any;
  newGeometry: any;
}

// Spherical Area Calculation (Shoelace formula adapted for sphere)
const calculatePolygonArea = (latLngs: L.LatLng[]) => {
  const earthRadius = 6378137; // meters
  let area = 0;
  if (latLngs.length > 2) {
    for (let i = 0; i < latLngs.length; i++) {
      const p1 = latLngs[i];
      const p2 = latLngs[(i + 1) % latLngs.length];
      area += (p2.lng - p1.lng) * (Math.PI / 180) * 
              (2 + Math.sin(p1.lat * Math.PI / 180) + Math.sin(p2.lat * Math.PI / 180));
    }
    area = Math.abs(area * earthRadius * earthRadius / 2.0);
  }
  return area;
};

const formatArea = (areaSqMeters: number) => {
    if (areaSqMeters >= 1000000) {
        return `${(areaSqMeters / 1000000).toFixed(2)} km²`;
    } else if (areaSqMeters >= 10000) {
        return `${(areaSqMeters / 10000).toFixed(2)} ha`;
    } else {
        return `${areaSqMeters.toFixed(0)} m²`;
    }
};

export const MapTab: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const isMapReady = useRef(false);
  
  // Base Layer Management
  const baseLayersRef = useRef<Record<string, L.TileLayer>>({});
  
  const layerGroups = useRef<Record<string, L.LayerGroup>>({});
  const measureLayer = useRef<L.LayerGroup | null>(null);
  const drawingLayer = useRef<L.LayerGroup | null>(null); // Layer for active drawing
  const filterLayer = useRef<L.Rectangle | null>(null);
  const printLayer = useRef<L.Rectangle | null>(null); // Layer for print viewfinder
  const printDragMarker = useRef<L.Marker | null>(null); // Reference to the drag handle
  
  const { 
    mapState, setMapState, schemas, records, addRecord, updateRecord, deleteRecord, hasPermission, mapConfig
  } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  const canEdit = hasPermission('edit_map');

  // Local state for tools
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [totalArea, setTotalArea] = useState(0);
  const [measureType, setMeasureType] = useState<'line' | 'polygon'>('line');
  const [measureTemp, setMeasureTemp] = useState<L.LatLng | null>(null); // Cursor for measure rubber-banding
  
  // Use ref for drag start to avoid stale state in mousemove events
  const dragStartRef = useRef<L.LatLng | null>(null);
  
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(mapState.activeLayerId);
  
  // Drawing State (Line/Polygon)
  const [drawingPoints, setDrawingPoints] = useState<L.LatLng[]>([]);
  const [drawingRedoStack, setDrawingRedoStack] = useState<L.LatLng[]>([]);
  // Ref to track drawing points synchronously for event handlers
  const drawingPointsRef = useRef<L.LatLng[]>([]); 
  
  const [drawingTemp, setDrawingTemp] = useState<L.LatLng | null>(null); // Cursor position for rubber banding
  const [activeGeoType, setActiveGeoType] = useState<'point'|'line'|'polygon'>('point');

  // Edit History State
  const [undoStack, setUndoStack] = useState<HistoryAction[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryAction[]>([]);

  // Feature Creation/Edit Modal State
  const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [initialFormData, setInitialFormData] = useState<Record<string, any>>({}); // For tracking changes
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null); // Track if we are editing

  // View Record Modal State (for mapDisplayMode='dialog')
  const [viewingRecord, setViewingRecord] = useState<DataRecord | null>(null);

  // Dirty State Handling
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Search Results State (Spatial Filter)
  const [searchResults, setSearchResults] = useState<DataRecord[]>([]);

  // Print State
  const [printConfig, setPrintConfig] = useState({
    title: 'GeoNexus Map Export',
    description: '',
    includeLegend: true,
    isExporting: false
  });

  // UI State
  const [isLayersOpen, setIsLayersOpen] = useState(true);
  const [expandedLayers, setExpandedLayers] = useState<Record<string, boolean>>({}); // For layer accordion
  const [expandedBaseLayers, setExpandedBaseLayers] = useState(true); // New state for base layers
  const [searchQuery, setSearchQuery] = useState('');

  // Drag State for Sidebar Reordering
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [hoveredDragHandleId, setHoveredDragHandleId] = useState<string | null>(null);

  // Computed sorted schemas based on mapState.layerOrder
  const sortedSchemas = useMemo(() => {
    // If layerOrder is not set or empty, initialize it with current schemas
    if (!mapState.layerOrder || mapState.layerOrder.length === 0) {
      return schemas;
    }

    // Sort schemas based on index in layerOrder
    const sorted = [...schemas].sort((a, b) => {
      const idxA = mapState.layerOrder.indexOf(a.id);
      const idxB = mapState.layerOrder.indexOf(b.id);
      // New layers (not in order array yet) go to top (index -1 in strict indexOf logic, handled here)
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return -1; // A is new, put before B
      if (idxB === -1) return 1;  // B is new, put before A
      return idxA - idxB;
    });
    return sorted;
  }, [schemas, mapState.layerOrder]);

  // Ensure layerOrder is synced if new layers are added
  useEffect(() => {
     const currentIds = schemas.map(s => s.id);
     const storedIds = mapState.layerOrder || [];
     
     // Find IDs that are in schemas but not in stored order (newly added)
     const newIds = currentIds.filter(id => !storedIds.includes(id));
     
     if (newIds.length > 0) {
         // Prepend new layers to the top of the list
         setMapState({ layerOrder: [...newIds, ...storedIds] });
     }
  }, [schemas.length]);

  // Sync active schema state & determine geo type
  useEffect(() => {
    setActiveSchemaId(mapState.activeLayerId);
    if (mapState.activeLayerId) {
        const schema = schemas.find(s => s.id === mapState.activeLayerId);
        if (schema) {
            // Default based on schema type
            if (schema.geometryType === 'mixed') {
                // If it was already mixed, keep current selection, else default to point
                // For simplicity, we just don't force it if it's already set to something valid
            } else if (schema.geometryType !== 'none') {
                setActiveGeoType(schema.geometryType as any);
            }
        }
    }
  }, [mapState.activeLayerId, schemas]);

  // --- Map Initialization ---
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
       zoomControl: false,
       attributionControl: false,
       doubleClickZoom: false, // Disable default dblclick zoom for drawing flow
       preferCanvas: true // Force canvas renderer to ensure features are captured in PDF export
    }).setView(
      mapState.center || [48.8566, 2.3522], 
      mapState.zoom || 13
    );
    
    // Add controls
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    mapInstance.current = map;
    isMapReady.current = true;
    
    measureLayer.current = L.layerGroup().addTo(map);
    drawingLayer.current = L.layerGroup().addTo(map);

    // Force size update to fix any gray area issues on init
    setTimeout(() => {
        map.invalidateSize();
    }, 200);

    // Map Move/Zoom Events
    map.on('moveend', () => {
      const center = map.getCenter();
      setMapState({
        center: [center.lat, center.lng],
        zoom: map.getZoom()
      });
    });

    // --- Interactive Map Events ---
    map.on('click', (e: L.LeafletMouseEvent) => {
       const { toolMode, activeLayerId } = stateRef.current.mapState;
       const { measurePoints, activeGeoType } = stateRef.current;

       // ADD TOOL
       if (toolMode === 'add') {
          if (!activeLayerId) {
             toast({ title: "No Layer Selected", description: "Please select a target layer from the Layers panel to add features.", variant: "destructive" });
             return;
          }

          // Point Mode: Immediate Add -> Open Dialog
          if (activeGeoType === 'point') {
              const geometry = { type: 'Point', coordinates: [e.latlng.lat, e.latlng.lng] };
              handleInitiateFeatureCreation(geometry);
          } 
          // Line/Polygon Mode: Add Vertex
          else {
              const newPoint = e.latlng;
              const nextPoints = [...drawingPointsRef.current, newPoint];
              
              // Update Ref synchronously
              drawingPointsRef.current = nextPoints;
              // Update State for rendering
              setDrawingPoints(nextPoints);
              // Clear redo stack on new action
              setDrawingRedoStack([]);
          }
       }

       // MEASURE TOOL
       if (toolMode === 'measure') {
          const newPoints = [...measurePoints, e.latlng];
          setMeasurePoints(newPoints);
          
          // Calculate distance (Line Mode)
          if (newPoints.length > 1) {
             let d = 0;
             for(let i = 0; i < newPoints.length - 1; i++) {
                d += newPoints[i].distanceTo(newPoints[i+1]);
             }
             setTotalDistance(d);
          }

          // Calculate area (Polygon Mode)
          if (stateRef.current.measureType === 'polygon' && newPoints.length > 2) {
              const area = calculatePolygonArea(newPoints);
              setTotalArea(area);
          }
       }
    });

    // Drawing Rubber Banding & Filter Box
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
       // Check stateRef for current values
       if (stateRef.current.mapState.toolMode === 'add' && stateRef.current.activeGeoType !== 'point' && drawingPointsRef.current.length > 0) {
           setDrawingTemp(e.latlng);
       } else {
           setDrawingTemp(null);
       }

       if (stateRef.current.mapState.toolMode === 'measure' && stateRef.current.measurePoints.length > 0) {
           setMeasureTemp(e.latlng);
       } else {
           setMeasureTemp(null);
       }

       // Filter Tool Box
       // Use ref for start point to get immediate feedback
       const start = dragStartRef.current;
       if (stateRef.current.mapState.toolMode === 'filter' && start) {
          const bounds = L.latLngBounds(start, e.latlng);
          if (filterLayer.current) {
             filterLayer.current.setBounds(bounds);
          } else {
             filterLayer.current = L.rectangle(bounds, { color: '#3b82f6', weight: 1, fillOpacity: 0.2 }).addTo(map);
          }
       }
    });

    // Double Click to Finish Drawing
    map.on('dblclick', (e: L.LeafletMouseEvent) => {
        const { toolMode } = stateRef.current.mapState;
        const { activeGeoType } = stateRef.current;
        
        if (toolMode === 'add' && activeGeoType !== 'point') {
            L.DomEvent.stopPropagation(e); // Prevent zoom
            commitDrawing();
        } else {
            // Manual zoom if not adding (since we disabled default dblclick zoom)
            map.setZoom(map.getZoom() + 1);
        }
    });

    // FILTER TOOL (Box Select)
    map.on('mousedown', (e: L.LeafletMouseEvent) => {
       if (stateRef.current.mapState.toolMode === 'filter') {
          map.dragging.disable();
          dragStartRef.current = e.latlng;
          // Clear previous results on new start
          setSearchResults([]);
       }
    });

    map.on('mouseup', (e: L.LeafletMouseEvent) => {
       if (stateRef.current.mapState.toolMode === 'filter' && dragStartRef.current) {
          map.dragging.enable();
          dragStartRef.current = null;
          
          // Calculate contained features
          if (filterLayer.current) {
             const bounds = filterLayer.current.getBounds();
             
             // Use records from ref to avoid stale closure
             const currentRecords = stateRef.current.records;
             const visibleLayers = stateRef.current.mapState.visibleLayers;
             
             const found = currentRecords.filter(r => {
                 // Only count visible layers
                 if (!visibleLayers.includes(r.tableId)) return false;

                 if (!r.geometry) return false;
                 
                 // Containment Logic
                 if (r.geometry.type === 'Point') {
                    const latlng = L.latLng(r.geometry.coordinates[0], r.geometry.coordinates[1]);
                    return bounds.contains(latlng);
                 } else {
                     // For lines/polys, check if at least one point is inside or check bounds intersection
                     // Simple check: check if the first point is inside
                     const coords = r.geometry.coordinates;
                     const latlng = L.latLng(coords[0][0], coords[0][1]);
                     return bounds.contains(latlng);
                 }
             });
             
             if (found.length > 0) {
                 setSearchResults(found);
                 toast({ 
                     title: "Spatial Search", 
                     description: `Found ${found.length} features. See results panel.`, 
                     variant: "success" 
                 });
             } else {
                 setSearchResults([]);
                 toast({ 
                     title: "No Results", 
                     description: "No visible features found in selected area.", 
                     variant: "default" 
                 });
                 // Clear rectangle if nothing found
                 if (mapInstance.current) {
                     try { mapInstance.current.removeLayer(filterLayer.current); } catch(e) {}
                     filterLayer.current = null;
                 }
             }
          }
       }
    });

    return () => {
      map.remove();
      mapInstance.current = null;
      isMapReady.current = false;
    };
  }, []);

  // Handle Base Layer Changes (Multiple Layers + Opacity + Ordering)
  useEffect(() => {
      if (!isMapReady.current || !mapInstance.current || !mapConfig?.tileLayers) return;
      
      const map = mapInstance.current;
      const visibleIds = mapState.visibleBaseLayers || [];
      
      // 1. Identify layers to Remove (Present in Ref but not in visibleIds)
      Object.keys(baseLayersRef.current).forEach(id => {
          if (!visibleIds.includes(id)) {
              if (baseLayersRef.current[id]) {
                  map.removeLayer(baseLayersRef.current[id]);
                  delete baseLayersRef.current[id];
              }
          }
      });

      // 2. Add or Update layers in Order
      // Leaflet rendering order: Higher zIndex is on top.
      // visibleIds is ordered: index 0 (bottom) -> index N (top)
      visibleIds.forEach((id, index) => {
          const config = mapConfig.tileLayers.find(l => l.id === id);
          if (!config) return;

          let layer = baseLayersRef.current[id];
          
          if (!layer) {
              // Create Layer
              layer = L.tileLayer(config.url, {
                  attribution: config.attribution,
                  maxZoom: config.maxZoom || 19,
                  subdomains: config.subdomains || 'abc'
              });
              layer.addTo(map);
              baseLayersRef.current[id] = layer;
          }

          // Update Opacity
          const opacity = mapState.baseLayerOpacity?.[id] ?? 1.0;
          layer.setOpacity(opacity);

          // Update Z-Index
          // Using standard TileLayer zIndex doesn't strictly work like overlay panes in all cases,
          // but L.TileLayer supports `setZIndex`. We use a range (e.g. 0-100) to keep them below features.
          layer.setZIndex(index); 
      });

  }, [mapState.visibleBaseLayers, mapState.baseLayerOpacity, mapConfig, isMapReady.current]);


  // Handle opening the modal (Create)
  const handleInitiateFeatureCreation = (geometry: any) => {
      setPendingGeometry(geometry);
      setEditingRecordId(null);
      // Initialize with defaults if any
      const defaults = mapState.featureDefaults || {};
      setFormData(defaults); 
      setInitialFormData(defaults);
      setFormErrors({});
      setIsFeatureModalOpen(true);

      // Reset drawing state immediately to clean up map
      setDrawingPoints([]);
      drawingPointsRef.current = [];
      setDrawingRedoStack([]);
      setDrawingTemp(null);
  };

  // Handle opening the modal (Edit)
  const handleEditFeature = (record: DataRecord) => {
      if (!canEdit) return;
      setActiveSchemaId(record.tableId);
      setPendingGeometry(record.geometry);
      setEditingRecordId(record.id);
      setFormData(record.data);
      setInitialFormData(record.data);
      setFormErrors({});
      setIsFeatureModalOpen(true);
      setViewingRecord(null); // Close view modal if transitioning to edit
  };

  const handleCloseModal = () => {
    const activeSchema = schemas.find(s => s.id === activeSchemaId);
    // Create label map
    const labelMap: Record<string, string> = {};
    activeSchema?.fields.forEach(f => labelMap[f.name] = f.label);

    const changes = getDirtyFields(initialFormData, formData, labelMap);
    if (changes.length > 0) {
        setUnsavedChanges(changes);
        setShowUnsavedDialog(true);
    } else {
        closeModalForce();
    }
  };

  const closeModalForce = () => {
      setIsFeatureModalOpen(false);
      setPendingGeometry(null);
      setEditingRecordId(null);
      setFormData({});
      setInitialFormData({});
      setShowUnsavedDialog(false);
  };

  const handleSaveFeature = (e: React.FormEvent) => {
      e.preventDefault();
      if (!activeSchemaId || !pendingGeometry) return;
      
      const schema = schemas.find(s => s.id === activeSchemaId);
      if (!schema) return;

      // Validation logic
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

      if (editingRecordId) {
          // Update existing
          const originalRecord = records.find(r => r.id === editingRecordId);
          if (originalRecord) {
              updateRecord({
                  ...originalRecord,
                  geometry: pendingGeometry, // Usually geometry isn't changed in this modal, but kept for consistency
                  data: formData,
                  updatedAt: new Date().toISOString()
              });
              toast({ title: t('map.feature_updated'), description: "Changes saved successfully.", variant: "success" });
          }
      } else {
          // Create new
          const newRecord: DataRecord = {
             id: Math.random().toString(36).substr(2, 9),
             tableId: activeSchemaId,
             geometry: pendingGeometry,
             data: formData,
             createdAt: new Date().toISOString(),
             updatedAt: new Date().toISOString()
          };
          addRecord(newRecord);
          const typeLabel = pendingGeometry.type === 'Point' ? 'Point' : (pendingGeometry.type === 'LineString' ? 'Path' : 'Area');
          toast({ title: t('map.feature_added'), description: `${typeLabel} added to map.`, variant: "success" });
      }

      closeModalForce();
  };

  const handleConfirmDelete = () => {
      if (deleteConfirmId) {
          deleteRecord(deleteConfirmId);
          toast({ title: "Feature Deleted", description: "The map feature has been removed.", variant: "info" });
          setDeleteConfirmId(null);
          // Close viewing modal if the deleted record was being viewed
          if (viewingRecord?.id === deleteConfirmId) {
              setViewingRecord(null);
          }
      }
  };

  // Ref to hold latest state for event handlers
  // CRITICAL: Includes 'records' to avoid stale closure in mouseup handler
  const stateRef = useRef({ mapState, measurePoints, activeGeoType, records, measureType });
  useEffect(() => {
    stateRef.current = { mapState, measurePoints, activeGeoType, records, measureType };
  }, [mapState, measurePoints, activeGeoType, records, measureType]);

  // Helper: Commit Drawing
  const commitDrawing = useCallback(() => {
     const { activeLayerId } = stateRef.current.mapState;
     // Use ref to get the most up-to-date points, avoiding state race conditions
     let points = [...drawingPointsRef.current];
     const type = stateRef.current.activeGeoType;

     if (!activeLayerId || points.length === 0) return;

     // Deduplicate last point if created by double-click (Leaflet fires click, click, dblclick)
     if (points.length > 1) {
         const last = points[points.length - 1];
         const prev = points[points.length - 2];
         // Simple equality check
         if (last.lat === prev.lat && last.lng === prev.lng) {
             points.pop();
         }
     }

     let geometry: any = null;

     if (type === 'line' && points.length >= 2) {
         geometry = {
             type: 'LineString',
             coordinates: points.map(p => [p.lat, p.lng])
         };
     } else if (type === 'polygon' && points.length >= 3) {
         geometry = {
             type: 'Polygon',
             coordinates: points.map(p => [p.lat, p.lng])
         };
     }

     if (geometry) {
        handleInitiateFeatureCreation(geometry);
     } else {
        toast({ title: "Incomplete", description: `Need more points to create a ${type}.`, variant: "destructive" });
     }
  }, [toast]);

  // --- History Handlers (Move Tool) ---
  const addToHistory = (recordId: string, oldGeo: any, newGeo: any) => {
    setUndoStack(prev => [...prev, { recordId, previousGeometry: oldGeo, newGeometry: newGeo }]);
    setRedoStack([]); // Clear redo stack on new action
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const action = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    
    // Find record to revert
    const record = records.find(r => r.id === action.recordId);
    if (record) {
      updateRecord({ ...record, geometry: action.previousGeometry, updatedAt: new Date().toISOString() });
      setUndoStack(newUndo);
      setRedoStack(prev => [...prev, action]);
    }
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const action = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    const record = records.find(r => r.id === action.recordId);
    if (record) {
      updateRecord({ ...record, geometry: action.newGeometry, updatedAt: new Date().toISOString() });
      setRedoStack(newRedo);
      setUndoStack(prev => [...prev, action]);
    }
  };

  const handleHistorySave = () => {
    // In a real app, this might trigger an API call.
    // Here we just clear the history to simulate a "commit"
    setUndoStack([]);
    setRedoStack([]);
    toast({ title: "Changes Saved", description: "All geometry edits have been committed.", variant: "success" });
  };

  // --- Drawing Undo/Redo Handlers ---
  const handleDrawingUndo = () => {
      const points = [...drawingPoints];
      if (points.length === 0) return;
      const lastPoint = points.pop();
      if (lastPoint) {
          setDrawingRedoStack(prev => [...prev, lastPoint]);
          setDrawingPoints(points);
          drawingPointsRef.current = points;
      }
  };

  const handleDrawingRedo = () => {
      const stack = [...drawingRedoStack];
      if (stack.length === 0) return;
      const nextPoint = stack.pop();
      if (nextPoint) {
          const points = [...drawingPoints, nextPoint];
          setDrawingPoints(points);
          drawingPointsRef.current = points;
          setDrawingRedoStack(stack);
      }
  };

  // --- Sidebar Drag & Drop Handlers (Schemas) ---
  const handleDragStart = (e: React.DragEvent, id: string) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      return;
    }
    setDraggedLayerId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.setData('type', 'feature');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedLayerId || draggedLayerId === targetId) return;
    
    // Distinguish between feature layer drag and base layer drag if needed
    // For now assuming we don't drag base layers into feature lists and vice versa
    const type = e.dataTransfer.getData('type');
    if (type !== 'feature') return;

    const currentOrder = mapState.layerOrder && mapState.layerOrder.length > 0 
        ? [...mapState.layerOrder] 
        : schemas.map(s => s.id);

    if (!currentOrder.includes(draggedLayerId)) currentOrder.push(draggedLayerId);
    if (!currentOrder.includes(targetId)) currentOrder.push(targetId);

    const oldIndex = currentOrder.indexOf(draggedLayerId);
    const newIndex = currentOrder.indexOf(targetId);

    currentOrder.splice(oldIndex, 1);
    currentOrder.splice(newIndex, 0, draggedLayerId);

    setMapState({ layerOrder: currentOrder });
    setDraggedLayerId(null);
  };

  // --- Base Layer Reordering Handlers ---
  const handleBaseLayerDragStart = (e: React.DragEvent, id: string) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') {
        e.preventDefault();
        return;
      }
      setDraggedLayerId(id);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.setData('type', 'base');
  };

  const handleBaseLayerDrop = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedLayerId || draggedLayerId === targetId) return;
      const type = e.dataTransfer.getData('type');
      if (type !== 'base') return;

      const currentOrder = [...(mapState.visibleBaseLayers || [])];
      
      const oldIndex = currentOrder.indexOf(draggedLayerId);
      const newIndex = currentOrder.indexOf(targetId);
      
      if (oldIndex === -1 || newIndex === -1) return;

      // Reorder
      currentOrder.splice(oldIndex, 1);
      currentOrder.splice(newIndex, 0, draggedLayerId);

      setMapState({ visibleBaseLayers: currentOrder });
      setDraggedLayerId(null);
  };

  // --- Locate Feature (FlyTo) ---
  const handleLocateFeature = (record: DataRecord) => {
      if (!mapInstance.current || !record.geometry) return;
      
      let target: L.LatLngExpression;
      
      if (record.geometry.type === 'Point') {
          target = [record.geometry.coordinates[0], record.geometry.coordinates[1]];
          mapInstance.current.flyTo(target, 18);
      } else {
          // For Line/Poly, calculate bounds
          const coords = record.geometry.coordinates;
          const bounds = L.latLngBounds(coords.map((c: any) => [c[0], c[1]]));
          mapInstance.current.fitBounds(bounds, { padding: [50, 50] });
      }
  };

  const toggleSubLayer = (schemaId: string, value: string) => {
    const currentHidden = mapState.hiddenSubLayers?.[schemaId] || [];
    const newHidden = currentHidden.includes(value)
        ? currentHidden.filter(v => v !== value) // Unhide
        : [...currentHidden, value]; // Hide

    setMapState({
        hiddenSubLayers: {
            ...mapState.hiddenSubLayers,
            [schemaId]: newHidden
        }
    });
  };

  const handleOpacityChange = (schemaId: string, value: string) => {
      setMapState({
          layerOpacity: {
              ...mapState.layerOpacity,
              [schemaId]: parseFloat(value)
          }
      });
  };

  const handleBaseLayerOpacityChange = (layerId: string, value: string) => {
      setMapState({
          baseLayerOpacity: {
              ...mapState.baseLayerOpacity,
              [layerId]: parseFloat(value)
          }
      });
  };

  const toggleLayerExpand = (id: string) => {
      setExpandedLayers(prev => ({...prev, [id]: !prev[id]}));
  };

  const handleBaseLayerToggle = (id: string, checked: boolean) => {
      const current = mapState.visibleBaseLayers || [];
      if (checked) {
          if (!current.includes(id)) {
              setMapState({ visibleBaseLayers: [...current, id] });
          }
      } else {
          setMapState({ visibleBaseLayers: current.filter(l => l !== id) });
      }
  };

  // --- Cursor Management (Imperative) ---
  useEffect(() => {
     if (!mapInstance.current) return;
     const container = mapInstance.current.getContainer();
     const mode = mapState.toolMode;

     // Reset custom cursors
     container.style.cursor = '';
     
     if (mode === 'add' || mode === 'measure' || mode === 'filter') {
        container.style.cursor = 'crosshair';
     } else if (mode === 'move') {
        container.style.cursor = 'move';
     } else if (mode === 'print') {
        container.style.cursor = 'move'; // Hint that box is draggable
     }
  }, [mapState.toolMode]);

  // --- Print Box Initialization (Effect) ---
  useEffect(() => {
     if (!mapInstance.current) return;
     const map = mapInstance.current;
     
     // Clean up existing print box if any
     if (printLayer.current) {
        try { map.removeLayer(printLayer.current); } catch(e) {}
        printLayer.current = null;
     }
     if (printDragMarker.current) {
        try { map.removeLayer(printDragMarker.current); } catch(e) {}
        printDragMarker.current = null;
     }

     if (mapState.toolMode === 'print') {
        const center = map.getCenter();
        const mapSize = map.getSize();
        
        // Calculate an A4 Landscape box (1.414 ratio)
        // Let's make it cover about 60% of the map height
        const boxHeightPx = mapSize.y * 0.6;
        const boxWidthPx = boxHeightPx * 1.414; // A4 Ratio

        // Convert pixel dimensions to LatLng bounds centered on map
        const pointCenter = map.latLngToContainerPoint(center);
        const southWest = map.containerPointToLatLng(L.point(pointCenter.x - boxWidthPx/2, pointCenter.y + boxHeightPx/2));
        const northEast = map.containerPointToLatLng(L.point(pointCenter.x + boxWidthPx/2, pointCenter.y - boxHeightPx/2));
        const bounds = L.latLngBounds(southWest, northEast);

        printLayer.current = L.rectangle(bounds, {
            color: '#6366f1', // Indigo-500
            weight: 2,
            dashArray: '10, 10',
            fillColor: '#6366f1',
            fillOpacity: 0.1,
            className: 'print-box-layer' // Helper for potential CSS
        }).addTo(map);

        const centerMarker = L.marker(center, {
             draggable: true,
             icon: L.divIcon({
                 className: 'bg-transparent',
                 html: `<div class="print-control-marker flex items-center justify-center w-8 h-8 bg-indigo-500/50 rounded-full border-2 border-white shadow-sm cursor-move"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline></svg></div>`,
                 iconSize: [32, 32],
                 iconAnchor: [16, 16]
             }),
             zIndexOffset: 1000
        }).addTo(map);
        printDragMarker.current = centerMarker;

        centerMarker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            // Re-calc bounds based on pixels to maintain size at current zoom
            const pC = map.latLngToContainerPoint(newPos);
            const sw = map.containerPointToLatLng(L.point(pC.x - boxWidthPx/2, pC.y + boxHeightPx/2));
            const ne = map.containerPointToLatLng(L.point(pC.x + boxWidthPx/2, pC.y - boxHeightPx/2));
            printLayer.current?.setBounds(L.latLngBounds(sw, ne));
        });

        return () => {
             if (printDragMarker.current) try { map.removeLayer(printDragMarker.current); } catch(e) {}
             if (printLayer.current) try { map.removeLayer(printLayer.current); } catch(e) {}
        };
     }
  }, [mapState.toolMode]);

  // --- Drawing Layer Rendering (Active Line/Poly construction) ---
  useEffect(() => {
      if (!drawingLayer.current) return;
      drawingLayer.current.clearLayers();

      const points = drawingPoints;
      const color = '#3b82f6'; // Drawing color

      if (points.length > 0) {
          // Render Vertices
          points.forEach(p => {
              L.circleMarker(p, { 
                  radius: 4, 
                  color: color, 
                  fillColor: 'white', 
                  fillOpacity: 1, 
                  weight: 2,
                  interactive: false // Important: Allows clicks to pass through to map for dblclick
              }).addTo(drawingLayer.current!);
          });

          // Render Solid Line for established segments
          if (points.length > 1) {
              L.polyline(points, { 
                  color: color, 
                  weight: 3, 
                  interactive: false 
              }).addTo(drawingLayer.current!);
          }

          // Render Dashed Line to Cursor (Rubber Banding)
          if (drawingTemp) {
              const lastPoint = points[points.length - 1];
              const rubberBand = [lastPoint, drawingTemp];
              
              const dashArray = activeGeoType === 'polygon' && points.length > 2 ? '5, 5' : '5, 10';
              L.polyline(rubberBand, { 
                  color: color, 
                  weight: 2, 
                  dashArray: '5, 10', 
                  opacity: 0.7,
                  interactive: false
              }).addTo(drawingLayer.current!);

              // For Polygon, visualize closing the loop
              if (activeGeoType === 'polygon' && points.length >= 2) {
                  L.polyline([drawingTemp, points[0]], { 
                      color: color, 
                      weight: 1, 
                      dashArray: '2, 4', 
                      opacity: 0.5,
                      interactive: false
                  }).addTo(drawingLayer.current!);
              }
          }
      }
  }, [drawingPoints, drawingTemp, activeGeoType]);


  // --- Feature Rendering ---
  useEffect(() => {
    if (!mapInstance.current) return;
    const map = mapInstance.current;
    const isMoveMode = mapState.toolMode === 'move';

    // RENDER ORDER:
    // In Leaflet, typically the last added layer sits on TOP.
    // In our sidebar, the TOP item (index 0) is expected to be visually on TOP.
    // So if sortedSchemas is [A, B, C] (A is top), we want A on top.
    // If we add A, then B, then C -> C is on top. This is wrong.
    // So we need to add C, then B, then A.
    // Thus, we reverse the sorted schemas list for iteration.
    const schemasToRender = [...sortedSchemas].reverse();

    schemasToRender.forEach(schema => {
      if (schema.geometryType === 'none') return;
      const isVisible = mapState.visibleLayers.includes(schema.id);
      
      let group = layerGroups.current[schema.id];
      if (!group) {
        group = L.layerGroup().addTo(map);
        layerGroups.current[schema.id] = group;
      }
      
      // Clear before re-adding (simplest way to handle updates/reordering)
      group.clearLayers();
      
      // If we are reordering (drag/drop), we need to ensure the group element itself
      // is moved to the top of the pane stack if needed.
      // Leaflet LayerGroups don't have z-index, but the order they are added to map matters.
      // Since we iterate in reverse order here, the loop ensures that 'group' for schema A (top of sidebar)
      // is processed last. However, if 'group' was ALREADY on the map, processing it last doesn't mean
      // it moves to top unless we remove and re-add it, or use bringToFront().
      // Re-adding the group to map ensures correct stacking order for vectors.
      group.removeFrom(map);
      group.addTo(map);

      if (!isVisible) return;

      const schemaRecords = records.filter(r => r.tableId === schema.id && r.geometry);
      const layerOpacity = mapState.layerOpacity?.[schema.id] ?? 1.0;

      schemaRecords.forEach(record => {
         if (!record.geometry) return;
         const { type, coordinates } = record.geometry;

         // Check if this specific feature is hidden via sub-layer configuration
         if (schema.subLayerConfig?.enabled && schema.subLayerConfig.field) {
             const val = record.data[schema.subLayerConfig.field];
             const hiddenValues = mapState.hiddenSubLayers?.[schema.id] || [];
             if (hiddenValues.includes(String(val))) {
                 return; // Skip rendering this feature
             }
         }

         // Determine color based on rules or schema default
         let color = schema.color;
         if (schema.subLayerConfig?.enabled && schema.subLayerConfig.field) {
            const val = record.data[schema.subLayerConfig.field];
            const rule = schema.subLayerConfig.rules.find(r => r.value === val);
            if (rule) color = rule.color;
         }

         let layer: L.Layer;

         if (type === 'Point') {
            const [lat, lng] = coordinates as [number, number];
            
            // Custom Icon vs Circle Marker
            if (schema.markerImage) {
                const icon = L.icon({
                    iconUrl: schema.markerImage,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32],
                    className: isMoveMode ? 'cursor-move' : ''
                });
                layer = L.marker([lat, lng], { icon, draggable: isMoveMode, opacity: layerOpacity });
            } else {
                layer = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: layerOpacity,
                    fillOpacity: layerOpacity * 0.8
                });
                
                if (isMoveMode) {
                     const divIcon = L.divIcon({
                         className: 'bg-transparent border-0',
                         html: `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;cursor:move;box-shadow:0 2px 4px rgba(0,0,0,0.3);opacity:${layerOpacity}"></div>`,
                         iconSize: [16, 16],
                         iconAnchor: [8, 8]
                     });
                     layer = L.marker([lat, lng], { icon: divIcon, draggable: true });
                }
            }

            // Drag Handler
            if (isMoveMode) {
                let startGeo: any = null;
                // Capture initial state
                (layer as L.Marker).on('dragstart', () => {
                    startGeo = JSON.parse(JSON.stringify(record.geometry));
                });
                
                (layer as L.Marker).on('dragend', (e) => {
                    const marker = e.target;
                    const position = marker.getLatLng();
                    const newGeo = { ...record.geometry!, coordinates: [position.lat, position.lng] };
                    
                    if (startGeo) {
                        addToHistory(record.id, startGeo, newGeo);
                    }

                    updateRecord({
                        ...record,
                        geometry: newGeo,
                        updatedAt: new Date().toISOString()
                    });
                });
            }

         } else if (type === 'LineString' || type === 'Polygon') {
             // Shared logic for Lines and Polygons
             const points = coordinates as [number, number][]; // Assuming simple structure

             if (type === 'LineString') {
                 layer = L.polyline(points, { color, weight: 4, opacity: layerOpacity });
             } else {
                 layer = L.polygon(points, { color, opacity: layerOpacity, fillOpacity: layerOpacity * 0.4 });
             }

             // Move Logic: Add Edit Handles
             if (isMoveMode) {
                 // 1. Vertex Handles (for both Line and Poly)
                 points.forEach((pt, idx) => {
                     const vertexIcon = L.divIcon({
                         className: 'bg-transparent border-0',
                         html: `<div style="width: 10px; height: 10px; background: white; border: 2px solid ${color}; border-radius: 50%; cursor: crosshair; box-shadow: 0 1px 2px rgba(0,0,0,0.3);"></div>`,
                         iconSize: [10, 10],
                         iconAnchor: [5, 5]
                     });
                     
                     const vMarker = L.marker(pt, { icon: vertexIcon, draggable: true, zIndexOffset: 1000 }).addTo(group);
                     let startGeo: any = null;

                     vMarker.on('dragstart', () => {
                        startGeo = JSON.parse(JSON.stringify(record.geometry));
                     });
                     
                     vMarker.on('dragend', (e) => {
                         const newLat = e.target.getLatLng().lat;
                         const newLng = e.target.getLatLng().lng;
                         const newCoords = [...points];
                         newCoords[idx] = [newLat, newLng];
                         const newGeo = { ...record.geometry!, coordinates: newCoords };

                         if (startGeo) {
                             addToHistory(record.id, startGeo, newGeo);
                         }
                         
                         updateRecord({
                            ...record,
                            geometry: newGeo,
                            updatedAt: new Date().toISOString()
                         });
                     });
                 });

                 // 2. Center Handle (Polygon only)
                 if (type === 'Polygon') {
                     const bounds = L.latLngBounds(points.map(p => L.latLng(p[0], p[1])));
                     const center = bounds.getCenter();
                     
                     const centerIcon = L.divIcon({
                         className: 'bg-transparent border-0',
                         html: `<div style="width: 20px; height: 20px; background: white; border: 2px solid ${color}; border-radius: 4px; cursor: move; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.3);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"></polyline><polyline points="9 5 12 2 15 5"></polyline><polyline points="15 19 12 22 9 19"></polyline><polyline points="19 9 22 12 19 15"></polyline><circle cx="12" cy="12" r="1"></circle></svg></div>`,
                         iconSize: [20, 20],
                         iconAnchor: [10, 10]
                     });

                     const cMarker = L.marker(center, { icon: centerIcon, draggable: true, zIndexOffset: 1001 }).addTo(group);
                     let startPos: L.LatLng | null = null;
                     let startGeo: any = null;
                     
                     cMarker.on('dragstart', (e) => { 
                         startPos = e.target.getLatLng(); 
                         startGeo = JSON.parse(JSON.stringify(record.geometry));
                     });

                     cMarker.on('dragend', (e) => {
                         const endPos = e.target.getLatLng();
                         if (startPos) {
                             const latDiff = endPos.lat - startPos.lat;
                             const lngDiff = endPos.lng - startPos.lng;
                             const newCoords = points.map(p => [p[0] + latDiff, p[1] + lngDiff]);
                             const newGeo = { ...record.geometry!, coordinates: newCoords };

                             if (startGeo) {
                                 addToHistory(record.id, startGeo, newGeo);
                             }

                             updateRecord({
                                ...record,
                                geometry: newGeo,
                                updatedAt: new Date().toISOString()
                             });
                         }
                     });
                 }
             }
         } else {
             return; 
         }

         // --- Interaction (Popups/Tooltips) ---
         // Only enable standard interaction if NOT in move mode
         if (!isMoveMode) {
             layer.on('mouseover', (e: L.LeafletMouseEvent) => {
                const target = e.target;
                if (target.setStyle) target.setStyle({ fillOpacity: 0.9, weight: (target.options.weight || 2) + 2 });
                if (target.setOpacity) target.setOpacity(0.8);
             });
             layer.on('mouseout', (e: L.LeafletMouseEvent) => {
                const target = e.target;
                const baseWeight = record.geometry?.type === 'LineString' ? 4 : 2;
                if (target.setStyle) target.setStyle({ fillOpacity: (record.geometry?.type === 'Polygon' ? 0.4 : 0.8) * layerOpacity, weight: baseWeight });
                if (target.setOpacity) target.setOpacity(layerOpacity);
             });

             // Apply Hover Fields (Tooltip) based on configuration
             if (schema.hoverFields?.length) {
                const content = schema.hoverFields.map(field => {
                    const val = record.data[field];
                    return val ? `<b>${schema.fields.find(f=>f.name===field)?.label}:</b> ${val}` : '';
                }).filter(Boolean).join('<br>');
                if (content) layer.bindTooltip(content, { direction: 'top', offset: [0, -10], className: 'font-sans text-xs px-2 py-1 shadow-sm border-0 whitespace-nowrap' });
             } else {
                 // Fallback to name/first text field if no specific hover fields configured but tooltip is desired?
                 // Current behavior: if hoverFields is empty, no tooltip.
             }
             
             // Check display mode
             if (schema.mapDisplayMode === 'dialog') {
                 // MODAL DIALOG MODE
                 layer.on('click', (e) => {
                     L.DomEvent.stopPropagation(e);
                     setViewingRecord(record);
                 });
             } else {
                 // POPUP MODE (Default)
                 let actionButtons = '';
                 if (canEdit) {
                     actionButtons = `
                       <div class="flex justify-end gap-2 pt-2 border-t border-gray-100">
                           <button class="btn-edit-feature flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Edit">
                               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                               Edit
                           </button>
                           <button class="btn-delete-feature flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                               <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
                               Delete
                           </button>
                       </div>
                     `;
                 }

                 const popupContent = `
                    <div class="font-sans min-w-[200px]">
                       <div class="flex items-center justify-between border-b pb-2 mb-2" style="border-color: ${color}40">
                           <h3 class="font-bold text-sm" style="color:${color}">${schema.name}</h3>
                       </div>
                       <div class="space-y-1.5 text-xs mb-3">
                          ${schema.fields.map(f => {
                             const val = record.data[f.name];
                             if (val === undefined || val === '') return '';
                             return `<div class="grid grid-cols-[min-content_1fr] gap-2 items-baseline">
                                <span class="text-gray-500 whitespace-nowrap font-medium">${f.label}:</span> 
                                <span class="text-slate-800 break-words">${val}</span>
                             </div>`;
                          }).join('')}
                       </div>
                       ${actionButtons}
                    </div>
                 `;
                 layer.bindPopup(popupContent, { className: 'rounded-lg shadow-xl' });

                 layer.on('popupopen', (e: L.PopupEvent) => {
                     const container = e.popup.getElement();
                     if (!container) return;
                     
                     const editBtn = container.querySelector('.btn-edit-feature');
                     if (editBtn) {
                         editBtn.addEventListener('click', (ev) => {
                             ev.stopPropagation(); 
                             handleEditFeature(record);
                             e.popup.close();
                         });
                     }
                     
                     const delBtn = container.querySelector('.btn-delete-feature');
                     if (delBtn) {
                         delBtn.addEventListener('click', (ev) => {
                             ev.stopPropagation();
                             setDeleteConfirmId(record.id);
                             e.popup.close();
                         });
                     }
                 });
             }
         }

         layer.addTo(group);
      });
    });

  }, [sortedSchemas, records, mapState.visibleLayers, mapState.hiddenSubLayers, mapState.toolMode, mapState.layerOpacity, canEdit]);

  // --- Measure Layer Rendering ---
  useEffect(() => {
     if (!measureLayer.current) return;
     measureLayer.current.clearLayers();
     
     if (measurePoints.length > 0) {
        // Draw Points
        measurePoints.forEach((pt, idx) => {
            L.circleMarker(pt, { radius: 5, color: 'black', fillColor: 'yellow', fillOpacity: 1, interactive: false }).addTo(measureLayer.current!);
        });
        
        // Draw Line
        if (measureType === 'line' && measurePoints.length > 1) {
            L.polyline(measurePoints, { color: 'black', weight: 3, dashArray: '5, 10', interactive: false }).addTo(measureLayer.current!);
            
            // Label distance at last point
            const lastPt = measurePoints[measurePoints.length - 1];
            const distLabel = totalDistance > 1000 
               ? `${(totalDistance/1000).toFixed(2)} km` 
               : `${totalDistance.toFixed(0)} m`;
               
            L.marker(lastPt, {
                icon: L.divIcon({
                    className: 'bg-yellow-300 px-2 py-1 rounded border border-black font-bold text-xs whitespace-nowrap shadow-md',
                    html: distLabel,
                    iconAnchor: [-10, 15]
                }),
                interactive: false
            }).addTo(measureLayer.current!);
        }

        // Draw Polygon
        if (measureType === 'polygon' && measurePoints.length > 1) {
            const poly = L.polygon(measurePoints, { 
                color: 'black', 
                weight: 2, 
                dashArray: '5, 10', 
                fillColor: 'yellow', 
                fillOpacity: 0.3,
                interactive: false
            }).addTo(measureLayer.current!);

            // Rubber-banding for closing the loop (Line from last point to cursor is handled in mousemove, 
            // but we also want to show the closing segment from cursor to start point)
            if (measureTemp) {
                const firstPt = measurePoints[0];
                const lastPt = measurePoints[measurePoints.length - 1];
                
                // Line from last point to cursor
                L.polyline([lastPt, measureTemp], { color: 'black', weight: 2, dashArray: '5, 10', interactive: false }).addTo(measureLayer.current!);
                // Line from cursor to first point (Close loop)
                L.polyline([measureTemp, firstPt], { color: 'black', weight: 1, dashArray: '2, 5', opacity: 0.5, interactive: false }).addTo(measureLayer.current!);
            }

            if (measurePoints.length > 2) {
                // Show Area Label at center or last point
                // Calculate center roughly
                const bounds = poly.getBounds();
                const center = bounds.getCenter();
                
                L.marker(center, {
                    icon: L.divIcon({
                        className: 'bg-yellow-300 px-2 py-1 rounded border border-black font-bold text-xs whitespace-nowrap shadow-md',
                        html: formatArea(totalArea),
                        iconAnchor: [20, 10]
                    }),
                    interactive: false
                }).addTo(measureLayer.current!);
            }
        } else if (measureType === 'line' && measureTemp && measurePoints.length > 0) {
            // Line rubber-banding
            const lastPt = measurePoints[measurePoints.length - 1];
            L.polyline([lastPt, measureTemp], { color: 'black', weight: 2, dashArray: '5, 10', opacity: 0.7, interactive: false }).addTo(measureLayer.current!);
            
            // Real-time distance label on cursor
            const currentDist = lastPt.distanceTo(measureTemp);
            const total = totalDistance + currentDist;
            const distLabel = total > 1000 
               ? `${(total/1000).toFixed(2)} km` 
               : `${total.toFixed(0)} m`;
            
            const segmentLabel = currentDist > 1000 
                ? `+ ${(currentDist/1000).toFixed(2)} km` 
                : `+ ${currentDist.toFixed(0)} m`;

            L.marker(measureTemp, {
                icon: L.divIcon({
                    className: 'bg-white/90 backdrop-blur px-2 py-1 rounded border border-slate-300 text-[10px] shadow-sm whitespace-nowrap',
                    html: `<b>${distLabel}</b><br/><span class="text-gray-500">${segmentLabel}</span>`,
                    iconAnchor: [-10, 20]
                }),
                interactive: false
            }).addTo(measureLayer.current!);
        }
     }
  }, [measurePoints, totalDistance, totalArea, measureType, measureTemp]);

  const handleExportPDF = async () => {
    if (!mapContainer.current || !mapInstance.current) return;
    setPrintConfig(prev => ({ ...prev, isExporting: true }));
    
    // Hide print box artifacts before capture
    if (printLayer.current) {
        printLayer.current.setStyle({ stroke: false, fill: false });
    }
    if (printDragMarker.current) {
        printDragMarker.current.setOpacity(0);
    }

    // Prepare UI for capture: hide all controls
    const container = document.querySelector('.leaflet-container') as HTMLElement;
    if (container) {
      container.classList.add('printing-active');
    }
    const controls = document.querySelectorAll('.leaflet-control-container, .print-control-marker');
    controls.forEach(c => (c as HTMLElement).style.display = 'none');

    try {
        // Wait a brief moment for styles to settle
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 1. Capture FULL map container at high resolution
        const scale = 3; 
        const width = mapContainer.current.offsetWidth;
        const height = mapContainer.current.offsetHeight;
        
        const canvas = await html2canvas(mapContainer.current, {
            useCORS: true,
            allowTaint: false, // Must be false for toDataURL to work properly
            scale: scale,
            width: width,
            height: height,
            scrollX: 0,
            scrollY: 0,
            logging: false,
            backgroundColor: '#ffffff'
        });

        let imgData = canvas.toDataURL('image/jpeg', 0.95);
        let imgWidth = canvas.width;
        let imgHeight = canvas.height;

        // 2. Manual Crop if Print Box Exists
        if (printLayer.current) {
             const bounds = printLayer.current.getBounds();
             const nw = mapInstance.current.latLngToContainerPoint(bounds.getNorthWest());
             const se = mapInstance.current.latLngToContainerPoint(bounds.getSouthEast());
             
             // Calculate dimensions in CSS pixels (relative to map container)
             const cssW = se.x - nw.x;
             const cssH = se.y - nw.y;

             // Scale to canvas pixels
             const sX = nw.x * scale;
             const sY = nw.y * scale;
             const sW = cssW * scale;
             const sH = cssH * scale;

             // Create a new canvas to hold the cropped image
             const cropCanvas = document.createElement('canvas');
             cropCanvas.width = sW;
             cropCanvas.height = sH;
             const ctx = cropCanvas.getContext('2d');
             
             if (ctx) {
                 // Fill white background first
                 ctx.fillStyle = '#ffffff';
                 ctx.fillRect(0, 0, sW, sH);
                 
                 // Draw the slice from the main canvas
                 ctx.drawImage(
                     canvas, 
                     sX, sY, sW, sH, // Source rect
                     0, 0, sW, sH    // Dest rect
                 );
                 
                 imgData = cropCanvas.toDataURL('image/jpeg', 0.95);
                 imgWidth = sW;
                 imgHeight = sH;
             }
        }
        
        const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape
        const pageWidth = 297;
        const pageHeight = 210;
        const margin = 10;
        
        // --- PDF Header ---
        pdf.setFillColor(248, 250, 252);
        pdf.rect(0, 0, pageWidth, 25, 'F');
        
        pdf.setFontSize(22);
        pdf.setTextColor(15, 23, 42);
        pdf.text(printConfig.title || 'GeoNexus Map', margin, 18);
        
        pdf.setFontSize(10);
        pdf.setTextColor(100, 116, 139);
        pdf.text('Generated: ' + new Date().toLocaleString(), pageWidth - margin, 18, { align: 'right' });
        
        // --- Map Image Placement ---
        const headerHeight = 25;
        const footerHeight = printConfig.description ? 30 : 10;
        const availableHeight = pageHeight - headerHeight - footerHeight - margin;
        const availableWidth = pageWidth - (margin * 2);

        // Calculate aspect ratios
        const imgRatio = imgWidth / imgHeight;
        const slotRatio = availableWidth / availableHeight;
        
        let renderW, renderH;
        
        // Fit image into available space (Contain)
        if (imgRatio > slotRatio) {
            // Image is wider than slot -> Constrain by width
            renderW = availableWidth;
            renderH = availableWidth / imgRatio;
        } else {
            // Image is taller than slot -> Constrain by height
            renderH = availableHeight;
            renderW = availableHeight * imgRatio;
        }

        pdf.addImage(imgData, 'JPEG', margin, headerHeight + 5, renderW, renderH);
        
        // --- Description Footer ---
        if (printConfig.description) {
            const descY = headerHeight + 5 + availableHeight + 8;
            pdf.setFontSize(12);
            pdf.setTextColor(15, 23, 42);
            pdf.text("Description", margin, descY);
            
            pdf.setFontSize(10);
            pdf.setTextColor(51, 65, 85);
            const splitText = pdf.splitTextToSize(printConfig.description, pageWidth - (margin * 2));
            pdf.text(splitText, margin, descY + 6);
        }
        
        // Branding
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184);
        pdf.text("Created with GeoNexus GIS", pageWidth / 2, pageHeight - 5, { align: 'center' });

        pdf.save(`${printConfig.title.replace(/\s+/g, '_')}.pdf`);
        toast({ title: "Export Complete", description: "PDF has been downloaded.", variant: "success" });

    } catch (error) {
        console.error("PDF Export failed", error);
        toast({ title: "Export Failed", description: "Could not generate PDF.", variant: "destructive" });
    } finally {
        // Restore UI
        if (container) {
          container.classList.remove('printing-active');
        }
        controls.forEach(c => (c as HTMLElement).style.display = '');
        
        // Restore print box visibility
        if (printLayer.current) {
            printLayer.current.setStyle({ stroke: true, fill: true });
        }
        if (printDragMarker.current) {
            printDragMarker.current.setOpacity(1);
        }
        
        setPrintConfig(prev => ({ ...prev, isExporting: false }));
    }
  };

  const setTool = (mode: typeof mapState.toolMode) => {
      setMapState({ toolMode: mode });
      // Reset tools
      setMeasurePoints([]);
      setTotalDistance(0);
      setTotalArea(0);
      setDrawingPoints([]);
      drawingPointsRef.current = [];
      setDrawingRedoStack([]);
      setDrawingTemp(null);
      dragStartRef.current = null;
      
      // Clear history when switching tools
      if (mode !== 'move') {
        setUndoStack([]);
        setRedoStack([]);
      }

      // Clear filter state if moving away from filter
      if (mode !== 'filter') {
          setSearchResults([]);
          if (filterLayer.current && mapInstance.current) {
             try { mapInstance.current.removeLayer(filterLayer.current); } catch(e) {}
             filterLayer.current = null;
          }
      }
      
      // Clean up print box if moving away from print
      if (mode !== 'print') {
          if (printLayer.current && mapInstance.current) {
             try { mapInstance.current.removeLayer(printLayer.current); } catch(e) {}
             printLayer.current = null;
          }
          if (printDragMarker.current && mapInstance.current) {
             try { mapInstance.current.removeLayer(printDragMarker.current); } catch(e) {}
             printDragMarker.current = null;
          }
      }

      if (mapInstance.current) {
          mapInstance.current.dragging.enable();
      }
  };

  const handleCancelDrawing = () => {
      setDrawingPoints([]);
      drawingPointsRef.current = [];
      setDrawingRedoStack([]);
      setDrawingTemp(null);
  };
  
  const handleSearch = (e: React.FormEvent) => {
      e.preventDefault();
      // Simple search in visible records
      const found = records.find(r => 
          mapState.visibleLayers.includes(r.tableId) && 
          Object.values(r.data).some(v => String(v).toLowerCase().includes(searchQuery.toLowerCase()))
      );
      if (found && found.geometry && mapInstance.current) {
          const center = L.latLng(found.geometry.coordinates[0], found.geometry.coordinates[1]);
          mapInstance.current.flyTo(center, 16);
          toast({ title: "Found", description: `Located record in ${schemas.find(s=>s.id===found.tableId)?.name}` });
      } else {
          toast({ title: "Not Found", description: "No visible feature matches your search.", variant: "destructive" });
      }
  };

  // Combine visible active base layers with inactive ones for the list
  const baseLayersList = useMemo(() => {
      const activeIds = mapState.visibleBaseLayers || [];
      const activeLayers = activeIds.map(id => mapConfig.tileLayers.find(l => l.id === id)).filter(Boolean) as typeof mapConfig.tileLayers;
      const inactiveLayers = mapConfig.tileLayers.filter(l => !activeIds.includes(l.id));
      return [...activeLayers, ...inactiveLayers];
  }, [mapConfig.tileLayers, mapState.visibleBaseLayers]);

  const activeSchema = schemas.find(s => s.id === activeSchemaId);

  // Helper for Feature View Modal styles
  const getDialogStyles = (record: DataRecord | null) => {
      if (!record) return {};
      const schema = schemas.find(s => s.id === record.tableId);
      const config = schema?.dialogConfig;
      
      let style: React.CSSProperties = {};
      let className = "sm:max-w-lg"; // Default

      if (config) {
          if (config.size === 'small') className = "sm:max-w-sm";
          else if (config.size === 'medium') className = "sm:max-w-lg";
          else if (config.size === 'large') className = "sm:max-w-4xl";
          else if (config.size === 'fullscreen') className = "max-w-[95vw] h-[90vh] flex flex-col";
          else if (config.size === 'custom') {
              className = "sm:max-w-none"; // Reset default
              if (config.width) style.width = config.width;
              if (config.height) style.height = config.height;
          }
      }
      return { className, style };
  };

  const dialogProps = getDialogStyles(viewingRecord);

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
       {/* Map Container - Use absolute positioning to ensure it fills parent completely */}
       <div 
         ref={mapContainer} 
         className="absolute inset-0 z-0 outline-none"
       />

       {/* LEFT: Toolbar */}
       <div className="absolute top-4 left-4 z-[400] flex flex-col gap-4 items-start">
          <div className="bg-background/95 backdrop-blur shadow-xl border rounded-lg p-1.5 flex flex-col gap-1">
             <ToolButton 
                icon={MousePointer2} 
                active={mapState.toolMode === 'select'} 
                onClick={() => setTool('select')} 
                title="Select & View"
             />
             {canEdit && (
               <>
                 <ToolButton 
                    icon={Plus} 
                    active={mapState.toolMode === 'add'} 
                    onClick={() => setTool('add')} 
                    title="Add Feature"
                 />
                 <ToolButton 
                    icon={Move} 
                    active={mapState.toolMode === 'move'} 
                    onClick={() => setTool('move')} 
                    title="Move Feature"
                 />
                 <div className="h-px bg-border my-1" />
               </>
             )}
             <ToolButton 
                icon={Ruler} 
                active={mapState.toolMode === 'measure'} 
                onClick={() => setTool('measure')} 
                title="Measure Distance or Area"
             />
             <ToolButton 
                icon={Filter} 
                active={mapState.toolMode === 'filter'} 
                onClick={() => setTool('filter')} 
                title="Spatial Filter (Box)"
             />
             <ToolButton 
                icon={Printer} 
                active={mapState.toolMode === 'print'} 
                onClick={() => setTool('print')} 
                title="Print Map"
             />
          </div>

          {/* Context Panels */}
          {mapState.toolMode === 'measure' && (
             <div className="bg-background/95 backdrop-blur border p-3 rounded-md shadow-lg text-sm animate-in slide-in-from-left-2 w-56">
                 <div className="font-bold flex justify-between items-center mb-3">
                    <span className="flex items-center gap-2"><Ruler className="w-4 h-4" /> Measure</span>
                    <button onClick={() => { setMeasurePoints([]); setTotalDistance(0); setTotalArea(0); }} className="hover:bg-muted p-1 rounded text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                    </button>
                 </div>
                 
                 <div className="bg-muted p-1 rounded flex mb-3">
                     <button 
                        onClick={() => { setMeasureType('line'); setMeasurePoints([]); }}
                        className={cn("flex-1 py-1 rounded text-xs text-center transition-colors", measureType === 'line' ? "bg-white shadow text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                     >
                        Distance
                     </button>
                     <button 
                        onClick={() => { setMeasureType('polygon'); setMeasurePoints([]); }}
                        className={cn("flex-1 py-1 rounded text-xs text-center transition-colors", measureType === 'polygon' ? "bg-white shadow text-primary font-medium" : "text-muted-foreground hover:text-foreground")}
                     >
                        Area
                     </button>
                 </div>

                 <div className="p-2 bg-yellow-50 text-yellow-900 border border-yellow-200 rounded text-center">
                     <div className="text-xs text-yellow-700 uppercase font-bold tracking-wider mb-1">
                         {measureType === 'line' ? 'Total Distance' : 'Total Area'}
                     </div>
                     <div className="text-lg font-mono font-bold">
                        {measureType === 'line' 
                            ? (totalDistance > 1000 ? (totalDistance/1000).toFixed(2) + ' km' : totalDistance.toFixed(0) + ' m')
                            : formatArea(totalArea)
                        }
                     </div>
                 </div>
                 <div className="text-[10px] text-muted-foreground mt-2 italic text-center">
                     {measureType === 'line' ? "Click to add points." : "Click to add vertices to form a polygon."}
                 </div>
             </div>
          )}

          {mapState.toolMode === 'move' && (
             <div className="bg-background/95 backdrop-blur text-foreground p-3 rounded-md shadow-lg text-sm animate-in slide-in-from-left-2 w-auto border">
                 <div className="font-bold mb-3 flex items-center gap-2 border-b pb-2"><Move className="w-4 h-4" /> Move Features</div>
                 <div className="flex gap-2">
                     <Button variant="outline" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} title="Undo last move">
                        <Undo2 className="w-4 h-4 mr-1" /> Undo
                     </Button>
                     <Button variant="outline" size="sm" onClick={handleRedo} disabled={redoStack.length === 0} title="Redo move">
                        <Redo2 className="w-4 h-4 mr-1" /> Redo
                     </Button>
                     <Button variant="default" size="sm" onClick={handleHistorySave} title="Commit changes">
                        <Save className="w-4 h-4 mr-1" /> Save
                     </Button>
                 </div>
                 <div className="text-xs text-muted-foreground mt-2">
                    Drag points or vertices to move them.
                 </div>
             </div>
          )}

          {mapState.toolMode === 'print' && (
             <div className="bg-background/95 backdrop-blur text-foreground p-3 rounded-md shadow-lg text-sm animate-in slide-in-from-left-2 w-64 border">
                 <div className="font-bold mb-3 flex items-center gap-2 border-b pb-2"><FileDown className="w-4 h-4" /> Print Map</div>
                 
                 <div className="space-y-3">
                     <div className="space-y-1">
                       <Label className="text-xs">Map Title</Label>
                       <Input 
                           value={printConfig.title} 
                           onChange={e => setPrintConfig({...printConfig, title: e.target.value})} 
                           placeholder="Enter map title"
                           className="h-7 text-xs"
                       />
                     </div>
                     
                     <div className="space-y-1">
                       <Label className="text-xs">Description</Label>
                       <Textarea 
                           className="resize-none h-16 text-xs"
                           value={printConfig.description}
                           onChange={e => setPrintConfig({...printConfig, description: e.target.value})}
                           placeholder="Optional notes..."
                       />
                     </div>

                     <div className="flex items-center justify-between">
                       <Label className="text-xs">Include Legend</Label>
                       <Switch 
                           checked={printConfig.includeLegend}
                           onCheckedChange={c => setPrintConfig({...printConfig, includeLegend: c})}
                           className="scale-75 origin-right"
                       />
                     </div>
                     
                     <div className="text-[10px] text-muted-foreground bg-indigo-50 dark:bg-indigo-900/20 p-2 rounded border border-indigo-100 dark:border-indigo-800">
                        Drag the center marker to move the print area.
                     </div>

                     <div className="flex gap-2 pt-1 border-t">
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="w-full"
                            onClick={handleExportPDF} 
                            disabled={printConfig.isExporting}
                        >
                            {printConfig.isExporting ? 'Generating...' : 'Export PDF'}
                        </Button>
                     </div>
                 </div>
             </div>
          )}

          {mapState.toolMode === 'add' && (
             <div className="bg-background/95 backdrop-blur text-foreground p-3 rounded-md shadow-lg text-sm animate-in slide-in-from-left-2 w-64 border">
                 <div className="font-bold mb-3 flex items-center gap-2 border-b pb-2"><Plus className="w-4 h-4" /> Add Feature</div>
                 <div className="space-y-3">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground block">Target Layer</label>
                        <Combobox 
                            options={schemas.filter(s => s.geometryType !== 'none').map(s => ({ value: s.id, label: s.name }))}
                            value={activeSchemaId || ''}
                            onChange={(val) => {
                                setActiveSchemaId(val);
                                setMapState({ activeLayerId: val });
                            }}
                            placeholder="Select Layer"
                        />
                     </div>

                     {activeSchema?.geometryType === 'mixed' && (
                         <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-muted-foreground block">Geometry Type</label>
                            <div className="flex bg-muted rounded p-1">
                                <button 
                                    onClick={() => setActiveGeoType('point')} 
                                    className={cn("flex-1 py-1 rounded text-xs flex justify-center", activeGeoType === 'point' ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground")}
                                    title="Point"
                                >
                                    <CircleDot className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setActiveGeoType('line')} 
                                    className={cn("flex-1 py-1 rounded text-xs flex justify-center", activeGeoType === 'line' ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground")}
                                    title="Line"
                                >
                                    <Spline className="w-4 h-4" />
                                </button>
                                <button 
                                    onClick={() => setActiveGeoType('polygon')} 
                                    className={cn("flex-1 py-1 rounded text-xs flex justify-center", activeGeoType === 'polygon' ? "bg-white shadow text-primary" : "text-muted-foreground hover:text-foreground")}
                                    title="Polygon"
                                >
                                    <Hexagon className="w-4 h-4" />
                                </button>
                            </div>
                         </div>
                     )}

                     <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                         {activeGeoType === 'point' && "Click map to add a point."}
                         {activeGeoType === 'line' && "Click to add points. Double-click or use Finish to complete."}
                         {activeGeoType === 'polygon' && "Click to add vertices. Double-click or use Finish to close loop."}
                     </div>

                     {activeGeoType !== 'point' && drawingPoints.length > 0 && (
                         <>
                            <div className="flex gap-2 pt-1 border-t">
                                <Button 
                                    size="sm" variant="outline" className="h-7 text-xs flex-1" 
                                    onClick={handleDrawingUndo} disabled={drawingPoints.length === 0}
                                    title="Undo last point"
                                >
                                    <Undo2 className="w-3 h-3" />
                                </Button>
                                <Button 
                                    size="sm" variant="outline" className="h-7 text-xs flex-1" 
                                    onClick={handleDrawingRedo} disabled={drawingRedoStack.length === 0}
                                    title="Redo last point"
                                >
                                    <Redo2 className="w-3 h-3" />
                                </Button>
                            </div>
                            <div className="flex gap-2 pt-1">
                                <Button size="sm" variant="destructive" className="h-7 text-xs flex-1" onClick={handleCancelDrawing}>Cancel</Button>
                                <Button size="sm" className="h-7 text-xs flex-1" onClick={commitDrawing}>Finish</Button>
                            </div>
                         </>
                     )}
                 </div>
             </div>
          )}
       </div>

       {/* SEARCH BAR (Floating Left) */}
       <div className="absolute top-4 left-20 ml-2 z-[400]">
           <form onSubmit={handleSearch} className="relative group">
               <div className="bg-background/95 backdrop-blur shadow-lg border rounded-full flex items-center p-1 pl-3 transition-all w-10 group-hover:w-64 overflow-hidden focus-within:w-64">
                   <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                   <Input 
                      className="border-0 bg-transparent h-8 focus-visible:ring-0 px-2 text-sm placeholder:text-muted-foreground/70" 
                      placeholder="Search visible features..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                   />
               </div>
           </form>
       </div>

       {/* SPATIAL SEARCH RESULTS (Center/Bottom Left Panel) */}
       {searchResults.length > 0 && (
           <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[400] w-96 animate-in slide-in-from-bottom-4">
               <div className="bg-background/95 backdrop-blur border shadow-xl rounded-lg overflow-hidden flex flex-col max-h-[400px]">
                   <div className="bg-muted px-3 py-2 border-b flex justify-between items-center">
                       <span className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-2">
                          <Filter className="w-3 h-3" /> Spatial Search Results ({searchResults.length})
                       </span>
                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
                           setSearchResults([]);
                           if (filterLayer.current && mapInstance.current) {
                               try { mapInstance.current.removeLayer(filterLayer.current); } catch(e) {}
                               filterLayer.current = null;
                           }
                       }}>
                           <X className="w-3 h-3" />
                       </Button>
                   </div>
                   <div className="overflow-y-auto custom-scrollbar p-1">
                       {searchResults.map((result) => {
                           const schema = schemas.find(s => s.id === result.tableId);
                           const titleField = schema?.fields.find(f => f.type === 'text');
                           const title = titleField ? result.data[titleField.name] : result.id;
                           
                           return (
                               <div key={result.id} className="group flex items-center justify-between p-2 hover:bg-muted rounded text-sm transition-colors border-b last:border-0 border-dashed border-border/50">
                                   <div className="flex items-center gap-2 overflow-hidden">
                                       <span className="w-2 h-2 rounded-full shrink-0" style={{background: schema?.color || '#ccc'}}></span>
                                       <div className="flex flex-col overflow-hidden">
                                           <span className="font-medium truncate">{title}</span>
                                           <span className="text-[10px] text-muted-foreground truncate">{schema?.name}</span>
                                       </div>
                                   </div>
                                   <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                       <Button size="icon" variant="ghost" className="h-7 w-7" title="Locate" onClick={() => handleLocateFeature(result)}>
                                           <Target className="w-3 h-3" />
                                       </Button>
                                       {canEdit && (
                                         <Button size="icon" variant="ghost" className="h-7 w-7" title="Open/Edit" onClick={() => handleEditFeature(result)}>
                                             <PenLine className="w-3 h-3" />
                                         </Button>
                                       )}
                                   </div>
                               </div>
                           );
                       })}
                   </div>
               </div>
           </div>
       )}

       {/* RIGHT: Layers & Info */}
       <div className="absolute top-4 right-4 z-[400] flex flex-col items-end gap-2">
          {/* Layer Toggle Button */}
          <Button 
             variant="outline" 
             size="sm"
             className="bg-background/95 backdrop-blur shadow-md gap-2"
             onClick={() => setIsLayersOpen(!isLayersOpen)}
          >
             <Layers className="w-4 h-4" />
             <span className="hidden sm:inline">Layers</span>
             {isLayersOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>

          {/* Layer List */}
          {isLayersOpen && (
              <div className="bg-background/95 backdrop-blur border shadow-xl rounded-lg p-3 w-72 animate-in slide-in-from-top-2 flex flex-col max-h-[calc(100vh-120px)]">
                 
                 {/* Base Maps Section */}
                 <div className="mb-4">
                     <div className="flex items-center justify-between text-[10px] font-bold uppercase text-muted-foreground mb-2 cursor-pointer" onClick={() => setExpandedBaseLayers(!expandedBaseLayers)}>
                         <span className="flex items-center gap-2"><Globe className="w-3 h-3" /> Base Layers</span>
                         {expandedBaseLayers ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                     </div>
                     
                     {expandedBaseLayers && (
                         <div className="space-y-1">
                             {baseLayersList.map(layer => {
                                 const isActive = (mapState.visibleBaseLayers || []).includes(layer.id);
                                 const isExpanded = expandedLayers[layer.id];
                                 const currentOpacity = mapState.baseLayerOpacity?.[layer.id] ?? 1.0;
                                 const isDragging = draggedLayerId === layer.id;

                                 return (
                                     <div 
                                         key={layer.id} 
                                         className={cn("flex flex-col transition-opacity", isDragging ? "opacity-30" : "opacity-100")}
                                         draggable={hoveredDragHandleId === layer.id}
                                         onDragStart={(e) => handleBaseLayerDragStart(e, layer.id)}
                                         onDragOver={handleDragOver}
                                         onDrop={(e) => handleBaseLayerDrop(e, layer.id)}
                                     >
                                         <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors select-none group">
                                             {isActive ? (
                                                 <div 
                                                    className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1 -ml-1"
                                                    onMouseEnter={() => setHoveredDragHandleId(layer.id)}
                                                    onMouseLeave={() => setHoveredDragHandleId(null)}
                                                 >
                                                     <GripVertical className="w-3 h-3" />
                                                 </div>
                                             ) : (
                                                 <div className="w-5" />
                                             )}
                                             
                                             <input 
                                                 type="checkbox" 
                                                 className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                 checked={isActive}
                                                 onChange={(e) => { e.stopPropagation(); handleBaseLayerToggle(layer.id, e.target.checked); }}
                                                 onMouseDown={(e) => e.stopPropagation()}
                                                 onTouchStart={(e) => e.stopPropagation()}
                                             />
                                             
                                             <div className="flex-1 truncate text-sm" title={layer.name}>
                                                 {layer.name}
                                             </div>

                                             {isActive && (
                                                 <button onClick={(e) => { e.stopPropagation(); toggleLayerExpand(layer.id); }} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
                                                     {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                 </button>
                                             )}
                                         </div>

                                         {isActive && isExpanded && (
                                             <div className="ml-8 mt-1 border-l-2 pl-2 border-muted" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                                                 <div className="px-1 py-1">
                                                     <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-1">
                                                         <span>Opacity</span>
                                                         <span>{(currentOpacity * 100).toFixed(0)}%</span>
                                                     </div>
                                                     <input 
                                                         type="range" 
                                                         min="0" max="1" step="0.1" 
                                                         value={currentOpacity}
                                                         onChange={(e) => handleBaseLayerOpacityChange(layer.id, e.target.value)}
                                                         onMouseDown={(e) => e.stopPropagation()}
                                                         onTouchStart={(e) => e.stopPropagation()}
                                                         className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                                     />
                                                 </div>
                                             </div>
                                         )}
                                     </div>
                                 );
                             })}
                         </div>
                     )}
                 </div>

                 <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2 flex justify-between items-center shrink-0 border-t pt-2">
                    <span>Feature Layers</span>
                    <span className="bg-muted px-1.5 rounded-full">{mapState.visibleLayers.length}</span>
                 </div>
                 <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1">
                    {sortedSchemas.filter(s => s.geometryType !== 'none').map(s => {
                       const isVisible = mapState.visibleLayers.includes(s.id);
                       const hasSubLayers = s.subLayerConfig?.enabled && s.subLayerConfig.rules.length > 0;
                       const isExpanded = expandedLayers[s.id];
                       const currentOpacity = mapState.layerOpacity?.[s.id] ?? 1.0;
                       const isDragging = draggedLayerId === s.id;

                       return (
                        <div 
                           key={s.id} 
                           className={cn("flex flex-col transition-opacity", isDragging ? "opacity-30" : "opacity-100")}
                           draggable={hoveredDragHandleId === s.id}
                           onDragStart={(e) => handleDragStart(e, s.id)}
                           onDragOver={handleDragOver}
                           onDrop={(e) => handleDrop(e, s.id)}
                        >
                            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors select-none group">
                                <div 
                                    className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground p-1 -ml-1" 
                                    title="Drag to reorder"
                                    onMouseEnter={() => setHoveredDragHandleId(s.id)}
                                    onMouseLeave={() => setHoveredDragHandleId(null)}
                                >
                                    <GripVertical className="w-3 h-3" />
                                </div>
                                <input 
                                    type="checkbox" 
                                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                    checked={isVisible}
                                    onChange={(e) => {
                                        const newLayers = e.target.checked 
                                            ? [...mapState.visibleLayers, s.id]
                                            : mapState.visibleLayers.filter(id => id !== s.id);
                                        setMapState({ visibleLayers: newLayers });
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onTouchStart={(e) => e.stopPropagation()}
                                />
                                <label className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => {
                                    toggleLayerExpand(s.id);
                                }}>
                                    <span className="w-3 h-3 rounded-full shadow-sm ring-1 ring-black/5" style={{background: s.color}} />
                                    <span className="truncate flex-1 font-medium text-sm">{s.name}</span>
                                </label>
                                
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                        {records.filter(r => r.tableId === s.id && r.geometry).length}
                                    </span>
                                    {isVisible && (
                                        <button onClick={() => toggleLayerExpand(s.id)} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Expanded Content: Opacity Slider & Sub-Layers */}
                            {isVisible && isExpanded && (
                                <div className="ml-8 mt-1 space-y-2 border-l-2 pl-2 border-muted" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
                                    {/* Opacity Control */}
                                    <div className="px-1 py-1">
                                        <div className="flex justify-between items-center text-[10px] text-muted-foreground mb-1">
                                            <span>Opacity</span>
                                            <span>{(currentOpacity * 100).toFixed(0)}%</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="1" step="0.1" 
                                            value={currentOpacity}
                                            onChange={(e) => handleOpacityChange(s.id, e.target.value)}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                            className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                        />
                                    </div>
                                    
                                    {/* Sub-Layer Rules */}
                                    {hasSubLayers && (
                                        <div className="space-y-1 pt-1 border-t border-muted/50">
                                            {s.subLayerConfig!.rules.map((rule, idx) => {
                                                const isHidden = mapState.hiddenSubLayers?.[s.id]?.includes(rule.value);
                                                return (
                                                    <label 
                                                        key={idx} 
                                                        className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded"
                                                        onMouseDown={(e) => e.stopPropagation()}
                                                        onTouchStart={(e) => e.stopPropagation()}
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
                                                            checked={!isHidden}
                                                            onChange={() => toggleSubLayer(s.id, rule.value)}
                                                            onMouseDown={(e) => e.stopPropagation()}
                                                            onTouchStart={(e) => e.stopPropagation()}
                                                        />
                                                        <span className="w-2 h-2 rounded-full" style={{background: rule.color}}></span>
                                                        <span className="truncate text-muted-foreground">{rule.label || rule.value}</span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                       );
                    })}
                    {schemas.filter(s => s.geometryType !== 'none').length === 0 && (
                        <div className="text-xs text-muted-foreground italic py-2 text-center">No layers configured</div>
                    )}
                 </div>
              </div>
          )}
       </div>

       {/* LEGEND (Bottom Right, above controls) */}
       {mapState.visibleLayers.length > 0 && printConfig.includeLegend && (
          <div className="absolute bottom-8 right-4 z-[400] bg-background/95 backdrop-blur p-2 rounded-lg shadow-lg border text-xs max-w-[200px] animate-in slide-in-from-bottom-2">
              <div className="font-bold mb-1 border-b pb-1">Legend</div>
              <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                  {/* Legend Order: Match Sidebar Order */}
                  {sortedSchemas.filter(s => mapState.visibleLayers.includes(s.id)).map(s => {
                      // If using sub-layer config (categories), show those
                      if (s.subLayerConfig?.enabled && s.subLayerConfig.rules.length > 0) {
                          return (
                              <div key={s.id} className="space-y-1 mt-1.5">
                                  <div className="font-semibold text-[10px] text-muted-foreground">{s.name}</div>
                                  {s.subLayerConfig.rules.map((rule, idx) => {
                                      // Skip hidden rules in legend to avoid confusion? Or keep them? 
                                      // Usually legends show everything available, but greying out hidden ones is nice.
                                      const isHidden = mapState.hiddenSubLayers?.[s.id]?.includes(rule.value);
                                      return (
                                          <div key={idx} className={cn("flex items-center gap-2", isHidden && "opacity-40 grayscale")}>
                                              <span className="w-2 h-2 rounded-full" style={{background: rule.color}}></span>
                                              <span className="truncate">{rule.label || rule.value}</span>
                                          </div>
                                      );
                                  })}
                              </div>
                          )
                      }
                      // Default single color
                      return (
                          <div key={s.id} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{background: s.color}}></span>
                              <span className="truncate">{s.name}</span>
                          </div>
                      );
                  })}
              </div>
          </div>
       )}

       {/* Feature Creation Modal */}
       <Dialog open={isFeatureModalOpen} onOpenChange={(open) => !open && handleCloseModal()}>
           <DialogContent>
               <DialogHeader>
                   <DialogTitle>{editingRecordId ? 'Edit Feature Attributes' : 'New Feature Attributes'}</DialogTitle>
                   <DialogDescription>{editingRecordId ? 'Update details' : `Enter details for the new ${activeSchema?.name} item.`}</DialogDescription>
               </DialogHeader>
               
               {activeSchema && (
                  <form id="feature-form" onSubmit={handleSaveFeature} className="space-y-4 py-2">
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
                           ) : field.type === 'datetime' ? (
                              <Input
                                 type="datetime-local"
                                 required={field.required}
                                 value={formData[field.name] ? String(formData[field.name]).slice(0, 16) : ''}
                                 onChange={e => setFormData({...formData, [field.name]: e.target.value})}
                                 className={cn(formErrors[field.name] && "border-red-500 focus-visible:ring-red-500")}
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
                   <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
                   <Button type="submit" form="feature-form">{editingRecordId ? 'Update Feature' : 'Save Feature'}</Button>
               </DialogFooter>
           </DialogContent>
       </Dialog>

       {/* View Feature Modal (for Map Display Mode = Dialog) */}
       <Dialog open={!!viewingRecord} onOpenChange={(open) => !open && setViewingRecord(null)}>
           <DialogContent className={dialogProps.className} style={dialogProps.style}>
               <DialogHeader>
                   <DialogTitle className="flex items-center gap-2">
                       {viewingRecord && (
                           <div className="w-3 h-3 rounded-full" style={{background: schemas.find(s=>s.id === viewingRecord.tableId)?.color}} />
                       )}
                       <span>Feature Details</span>
                   </DialogTitle>
                   <DialogDescription>
                       {schemas.find(s=>s.id === viewingRecord?.tableId)?.name || 'Map Feature'}
                   </DialogDescription>
               </DialogHeader>
               
               <div className="flex-1 overflow-y-auto py-2">
                   {viewingRecord && schemas.find(s=>s.id === viewingRecord.tableId)?.fields.map(f => {
                       const val = viewingRecord.data[f.name];
                       return (
                           <div key={f.id} className="grid grid-cols-3 gap-2 py-2 border-b last:border-0 items-baseline">
                               <span className="text-sm font-medium text-muted-foreground">{f.label}</span>
                               <span className="col-span-2 text-sm break-words">{String(val || '-')}</span>
                           </div>
                       );
                   })}
               </div>

               <DialogFooter>
                   {canEdit && viewingRecord && (
                        <div className="flex w-full justify-between">
                            <Button variant="destructive" onClick={() => { setDeleteConfirmId(viewingRecord.id); }}>
                                Delete
                            </Button>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setViewingRecord(null)}>Close</Button>
                                <Button onClick={() => handleEditFeature(viewingRecord)}>Edit</Button>
                            </div>
                        </div>
                   )}
                   {(!canEdit || !viewingRecord) && (
                       <Button variant="outline" onClick={() => setViewingRecord(null)}>Close</Button>
                   )}
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
                    <Button variant="outline" onClick={closeModalForce} className="text-destructive hover:text-destructive">{t('common.discard')}</Button>
                    <Button onClick={() => setShowUnsavedDialog(false)}>{t('common.continue_editing')}</Button>
                </DialogFooter>
            </DialogContent>
       </Dialog>

       {/* Delete Confirmation Dialog */}
       <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
           <DialogContent className="max-w-sm">
               <DialogHeader>
                   <DialogTitle className="flex items-center gap-2 text-destructive">
                       <AlertTriangle className="w-5 h-5" /> Confirm Delete
                   </DialogTitle>
                   <DialogDescription>
                       Are you sure you want to delete this feature? This action cannot be undone.
                   </DialogDescription>
               </DialogHeader>
               <DialogFooter>
                   <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                   <Button variant="destructive" onClick={handleConfirmDelete}>Delete</Button>
               </DialogFooter>
           </DialogContent>
       </Dialog>
    </div>
  );
};

// Helper component for tool buttons
const ToolButton = ({ icon: Icon, active, onClick, title }: { icon: any, active?: boolean, onClick: () => void, title: string }) => (
    <Button
        variant="ghost"
        size="icon"
        className={cn(
            "h-8 w-8 transition-colors",
            active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={onClick}
        title={title}
    >
        <Icon className="w-4 h-4" />
    </Button>
);