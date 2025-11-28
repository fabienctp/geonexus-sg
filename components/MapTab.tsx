
import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
// CSS is loaded via index.html
import { useAppStore } from '../store';
import { DataRecord } from '../types';
import { useTranslation } from '../hooks/useTranslation';
import { 
  MousePointer2, Plus, Move, Ruler, Navigation, Filter, Printer, 
  Trash2, X, Check, Map as MapIcon, Layers, Search, ChevronDown, ChevronUp, Info,
  CircleDot, Hexagon, Spline, Undo2, Redo2, Save, Target, PenLine,
  FileDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
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

export const MapTab: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const layerGroups = useRef<Record<string, L.LayerGroup>>({});
  const measureLayer = useRef<L.LayerGroup | null>(null);
  const drawingLayer = useRef<L.LayerGroup | null>(null); // Layer for active drawing
  const filterLayer = useRef<L.Rectangle | null>(null);
  const printLayer = useRef<L.Rectangle | null>(null); // Layer for print viewfinder
  const printDragMarker = useRef<L.Marker | null>(null); // Reference to the drag handle
  
  const { 
    mapState, setMapState, schemas, records, addRecord, updateRecord
  } = useAppStore();
  const { t } = useTranslation();
  const { toast } = useToast();

  // Local state for tools
  const [measurePoints, setMeasurePoints] = useState<L.LatLng[]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  
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
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null); // Track if we are editing

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
  const [searchQuery, setSearchQuery] = useState('');

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

  // Handle opening the modal (Create)
  const handleInitiateFeatureCreation = (geometry: any) => {
      setPendingGeometry(geometry);
      setEditingRecordId(null);
      // Initialize with defaults if any
      setFormData(mapState.featureDefaults || {}); 
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
      setActiveSchemaId(record.tableId);
      setPendingGeometry(record.geometry);
      setEditingRecordId(record.id);
      setFormData(record.data);
      setFormErrors({});
      setIsFeatureModalOpen(true);
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
          const typeLabel = pendingGeometry.type === 'Point' ? 'Point' : pendingGeometry.type === 'LineString' ? 'Path' : 'Area';
          toast({ title: t('map.feature_added'), description: `${typeLabel} added to map.`, variant: "success" });
      }

      setIsFeatureModalOpen(false);
      setPendingGeometry(null);
      setEditingRecordId(null);
      setFormData({});
  };

  // Ref to hold latest state for event handlers
  // CRITICAL: Includes 'records' to avoid stale closure in mouseup handler
  const stateRef = useRef({ mapState, measurePoints, activeGeoType, records });
  useEffect(() => {
    stateRef.current = { mapState, measurePoints, activeGeoType, records };
  }, [mapState, measurePoints, activeGeoType, records]);

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

  const toggleLayerExpand = (id: string) => {
      setExpandedLayers(prev => ({...prev, [id]: !prev[id]}));
  };

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

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);
    
    // Add controls
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    mapInstance.current = map;
    measureLayer.current = L.layerGroup().addTo(map);
    drawingLayer.current = L.layerGroup().addTo(map);

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
          
          // Calculate distance
          if (newPoints.length > 1) {
             let d = 0;
             for(let i = 0; i < newPoints.length - 1; i++) {
                d += newPoints[i].distanceTo(newPoints[i+1]);
             }
             setTotalDistance(d);
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
    };
  }, []);

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

    schemas.forEach(schema => {
      if (schema.geometryType === 'none') return;
      const isVisible = mapState.visibleLayers.includes(schema.id);
      
      let group = layerGroups.current[schema.id];
      if (!group) {
        group = L.layerGroup().addTo(map);
        layerGroups.current[schema.id] = group;
      }

      group.clearLayers();
      if (!isVisible) return;

      const schemaRecords = records.filter(r => r.tableId === schema.id && r.geometry);

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
                layer = L.marker([lat, lng], { icon, draggable: isMoveMode });
            } else {
                layer = L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
                
                if (isMoveMode) {
                     const divIcon = L.divIcon({
                         className: 'bg-transparent border-0',
                         html: `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;cursor:move;box-shadow:0 2px 4px rgba(0,0,0,0.3)"></div>`,
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
                 layer = L.polyline(points, { color, weight: 4 });
             } else {
                 layer = L.polygon(points, { color, fillOpacity: 0.4 });
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
         // Only enable standard interaction if NOT in move mode to prevent popups from getting in the way
         if (!isMoveMode) {
             layer.on('mouseover', (e: L.LeafletMouseEvent) => {
                const target = e.target;
                if (target.setStyle) target.setStyle({ fillOpacity: 0.9, weight: (target.options.weight || 2) + 2 });
                if (target.setOpacity) target.setOpacity(0.8);
             });
             layer.on('mouseout', (e: L.LeafletMouseEvent) => {
                const target = e.target;
                const baseWeight = record.geometry?.type === 'LineString' ? 4 : 2;
                if (target.setStyle) target.setStyle({ fillOpacity: record.geometry?.type === 'Polygon' ? 0.4 : 0.8, weight: baseWeight });
                if (target.setOpacity) target.setOpacity(1);
             });

             if (schema.hoverFields?.length) {
                const content = schema.hoverFields.map(field => {
                    const val = record.data[field];
                    return val ? `<b>${schema.fields.find(f=>f.name===field)?.label}:</b> ${val}` : '';
                }).filter(Boolean).join('<br>');
                if (content) layer.bindTooltip(content, { direction: 'top', offset: [0, -10], className: 'font-sans text-xs px-2 py-1 shadow-sm border-0 whitespace-nowrap' });
             }

             const popupContent = `
                <div class="p-1 font-sans">
                   <h3 class="font-bold text-sm mb-2 border-b pb-1" style="color:${color}">${schema.name}</h3>
                   <div class="space-y-1 text-xs">
                      ${schema.fields.map(f => {
                         const val = record.data[f.name];
                         if (val === undefined || val === '') return '';
                         return `<div class="grid grid-cols-[min-content_1fr] gap-2 items-baseline">
                            <span class="text-gray-500 whitespace-nowrap">${f.label}:</span> 
                            <span class="font-medium text-slate-800 break-words">${val}</span>
                         </div>`;
                      }).join('')}
                   </div>
                </div>
             `;
             layer.bindPopup(popupContent, { className: 'rounded-lg shadow-xl', maxWidth: 350 });
         }

         layer.addTo(group);
      });
    });

  }, [schemas, records, mapState.visibleLayers, mapState.hiddenSubLayers, mapState.toolMode]);

  // --- Measure Layer Rendering ---
  useEffect(() => {
     if (!measureLayer.current) return;
     measureLayer.current.clearLayers();
     
     if (measurePoints.length > 0) {
        measurePoints.forEach((pt, idx) => {
            L.circleMarker(pt, { radius: 5, color: 'black', fillColor: 'yellow', fillOpacity: 1 }).addTo(measureLayer.current!);
        });
        
        if (measurePoints.length > 1) {
            L.polyline(measurePoints, { color: 'black', weight: 3, dashArray: '5, 10' }).addTo(measureLayer.current!);
            const lastPt = measurePoints[measurePoints.length - 1];
            const distLabel = totalDistance > 1000 
               ? `${(totalDistance/1000).toFixed(2)} km` 
               : `${totalDistance.toFixed(0)} m`;
               
            L.marker(lastPt, {
                icon: L.divIcon({
                    className: 'bg-yellow-300 px-2 py-1 rounded border border-black font-bold text-xs whitespace-nowrap shadow-md',
                    html: distLabel,
                    iconAnchor: [-10, 15]
                })
            }).addTo(measureLayer.current!);
        }
     }
  }, [measurePoints, totalDistance]);

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

  const activeSchema = schemas.find(s => s.id === activeSchemaId);

  return (
    <div className="relative w-full h-full bg-slate-100 flex overflow-hidden">
       {/* Map Container - Static ClassName to preserve Leaflet internal classes */}
       <div 
         ref={mapContainer} 
         className="flex-1 z-0 relative outline-none"
       />

       {/* LEFT: Toolbar */}
       <div className="absolute top-4 left-4 z-[400] flex flex-col gap-4 items-start items-start">
          <div className="bg-background/95 backdrop-blur shadow-xl border rounded-lg p-1.5 flex flex-col gap-1">
             <ToolButton 
                icon={MousePointer2} 
                active={mapState.toolMode === 'select'} 
                onClick={() => setTool('select')} 
                title="Select & View"
             />
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
             <ToolButton 
                icon={Ruler} 
                active={mapState.toolMode === 'measure'} 
                onClick={() => setTool('measure')} 
                title="Measure Distance"
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
             <div className="bg-yellow-50 text-yellow-900 border border-yellow-200 p-3 rounded-md shadow-lg text-sm animate-in slide-in-from-left-2 w-48">
                 <div className="font-bold flex justify-between items-center mb-1">
                    <span>Measure</span>
                    <button onClick={() => { setMeasurePoints([]); setTotalDistance(0); }} className="hover:bg-yellow-200 p-0.5 rounded"><Trash2 className="w-3 h-3" /></button>
                 </div>
                 <div className="text-lg font-mono font-bold">
                    {totalDistance > 1000 ? (totalDistance/1000).toFixed(2) + ' km' : totalDistance.toFixed(0) + ' m'}
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
                        <select 
                            className="w-full text-sm p-1.5 rounded cursor-pointer bg-muted border-transparent focus:border-primary focus:ring-1 focus:ring-primary"
                            value={activeSchemaId || ''}
                            onChange={(e) => {
                                setActiveSchemaId(e.target.value);
                                setMapState({ activeLayerId: e.target.value });
                            }}
                        >
                            <option value="" disabled>-- Select Layer --</option>
                            {schemas.filter(s => s.geometryType !== 'none').map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
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
                                       <Button size="icon" variant="ghost" className="h-7 w-7" title="Open/Edit" onClick={() => handleEditFeature(result)}>
                                           <PenLine className="w-3 h-3" />
                                       </Button>
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
                 <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2 flex justify-between items-center shrink-0">
                    <span>Visible Layers</span>
                    <span className="bg-muted px-1.5 rounded-full">{mapState.visibleLayers.length}</span>
                 </div>
                 <div className="space-y-1 overflow-y-auto custom-scrollbar pr-1 flex-1">
                    {schemas.filter(s => s.geometryType !== 'none').map(s => {
                       const isVisible = mapState.visibleLayers.includes(s.id);
                       const hasSubLayers = s.subLayerConfig?.enabled && s.subLayerConfig.rules.length > 0;
                       const isExpanded = expandedLayers[s.id];

                       return (
                        <div key={s.id} className="flex flex-col">
                            <div className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 transition-colors select-none group">
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
                                />
                                <label className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => {
                                    if(hasSubLayers) toggleLayerExpand(s.id);
                                }}>
                                    <span className="w-3 h-3 rounded-full shadow-sm ring-1 ring-black/5" style={{background: s.color}} />
                                    <span className="truncate flex-1 font-medium text-sm">{s.name}</span>
                                </label>
                                
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                        {records.filter(r => r.tableId === s.id && r.geometry).length}
                                    </span>
                                    {hasSubLayers && isVisible && (
                                        <button onClick={() => toggleLayerExpand(s.id)} className="p-0.5 hover:bg-muted rounded text-muted-foreground">
                                            {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            {/* Sub-Layer Rules */}
                            {hasSubLayers && isVisible && isExpanded && (
                                <div className="ml-6 mt-1 space-y-1 border-l-2 pl-2 border-muted">
                                    {s.subLayerConfig!.rules.map((rule, idx) => {
                                        const isHidden = mapState.hiddenSubLayers?.[s.id]?.includes(rule.value);
                                        return (
                                            <label key={idx} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/30 p-1 rounded">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded border-gray-300 text-primary focus:ring-primary h-3 w-3"
                                                    checked={!isHidden}
                                                    onChange={() => toggleSubLayer(s.id, rule.value)}
                                                />
                                                <span className="w-2 h-2 rounded-full" style={{background: rule.color}}></span>
                                                <span className="truncate text-muted-foreground">{rule.label || rule.value}</span>
                                            </label>
                                        );
                                    })}
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
                  {schemas.filter(s => mapState.visibleLayers.includes(s.id)).map(s => {
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
       <Dialog open={isFeatureModalOpen} onOpenChange={(open) => {
           if (!open) {
               setIsFeatureModalOpen(false);
               setPendingGeometry(null);
               setEditingRecordId(null);
               setFormData({});
           }
       }}>
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
                   <Button variant="outline" onClick={() => setIsFeatureModalOpen(false)}>Cancel</Button>
                   <Button type="submit" form="feature-form">{editingRecordId ? 'Update Feature' : 'Save Feature'}</Button>
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
