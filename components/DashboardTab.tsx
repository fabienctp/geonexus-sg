
import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store';
import { analyzeData } from '../services/geminiService';
import { Button } from './ui/button';
import { Combobox } from './ui/combobox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Sparkles, Loader2, BarChart3, Table as TableIcon } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { DataRecord, TableSchema, DashboardSchema } from '../types';

const COLORS = ['hsl(var(--primary))', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DashboardViewProps {
  activeSchema: TableSchema;
  records: DataRecord[];
  dashboardConfig: {
      title: string;
      widgets: any[];
      filters: any[];
      filterLogic?: 'and' | 'or';
      showTable?: boolean;
  };
  showHeader?: boolean;
  onAnalyzeRequest?: (schema: TableSchema, records: DataRecord[]) => Promise<string>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ activeSchema, dashboardConfig, records, showHeader = true, onAnalyzeRequest }) => {
  const { t } = useTranslation();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset analysis when schema changes
  useEffect(() => {
    setAiAnalysis(null);
  }, [activeSchema.id]);

  // Filter records based on tableId AND configured filters in dashboard
  const activeRecords = useMemo(() => {
    let result = records.filter(r => r.tableId === activeSchema.id);
    
    // Apply configured dashboard filters
    if (dashboardConfig.filters && dashboardConfig.filters.length > 0) {
        result = result.filter(r => {
            const checkFilter = (f: any) => {
                if (!f.value || !f.field) return true; // Ignore empty filters
                const val = r.data[f.field];
                const checkVal = f.value;

                switch(f.operator) {
                    // Use loose equality to handle string vs number/boolean issues
                    case 'equals': return String(val) == String(checkVal);
                    case 'neq': return String(val) != String(checkVal);
                    case 'contains': return String(val).toLowerCase().includes(String(checkVal).toLowerCase());
                    // Use lexicographical comparison which works for ISO Date strings and numbers correctly
                    case 'gt': return val > checkVal; 
                    case 'lt': return val < checkVal;
                    default: return true;
                }
            };

            if (dashboardConfig.filterLogic === 'or') {
                // Return true if ANY filter matches
                return dashboardConfig.filters.some(checkFilter);
            } else {
                // Default 'and': Return true if ALL filters match
                return dashboardConfig.filters.every(checkFilter);
            }
        });
    }
    return result;
  }, [activeSchema, records, dashboardConfig.filters, dashboardConfig.filterLogic]);

  // Basic Stats Calculation
  const recordCount = activeRecords.length;

  // Helper to generate data for a specific widget
  const getWidgetData = (fieldId: string) => {
     const field = activeSchema.fields.find(f => f.name === fieldId);
     if (!field) return [];

     const counts = activeRecords.reduce((acc, curr) => {
       const key = String(curr.data[field.name] || 'Unknown');
       acc[key] = (acc[key] || 0) + 1;
       return acc;
     }, {} as Record<string, number>);

     return Object.entries(counts).map(([name, value]) => ({ name, value }));
  };

  const handleAnalyze = async () => {
    if (!onAnalyzeRequest) return;
    setIsLoading(true);
    try {
      const result = await onAnalyzeRequest(activeSchema, activeRecords);
      setAiAnalysis(result);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       {showHeader && (
         <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {dashboardConfig.title || t('dash.title')}
            </h1>
            <p className="text-muted-foreground">
               Source: {activeSchema.name}
            </p>
         </div>
       )}

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* KPI Cards */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('dash.total')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">{recordCount}</div>
              {dashboardConfig.filters && dashboardConfig.filters.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                     {t('dash.filtered')}
                     <span className="bg-slate-100 text-slate-600 px-1 rounded text-[10px] uppercase font-bold border">
                         {dashboardConfig.filterLogic === 'or' ? 'Any' : 'All'}
                     </span>
                  </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('dash.fields')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{activeSchema.fields.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t('dash.widgets')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold capitalize">{dashboardConfig.widgets.length || 0}</div>
            </CardContent>
          </Card>

          {/* Dynamic Widgets */}
          {dashboardConfig.widgets.map((widget, idx) => {
             const data = getWidgetData(widget.field);
             if (data.length === 0) return null;

             return (
               <Card key={widget.id || idx} className="lg:col-span-1 min-h-[300px]">
                 <CardHeader>
                   <CardTitle className="text-base">{widget.title || `${t('dash.analysis_by')} ${widget.field}`}</CardTitle>
                 </CardHeader>
                 <CardContent>
                   <div className="h-[200px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                       {widget.type === 'bar' ? (
                         <BarChart data={data}>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                           <XAxis dataKey="name" className="text-xs" tickLine={false} axisLine={false} />
                           <YAxis className="text-xs" tickLine={false} axisLine={false} />
                           <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                           <Bar dataKey="value" fill={activeSchema.color} radius={[4, 4, 0, 0]} />
                         </BarChart>
                       ) : (
                         <PieChart>
                           <Pie
                             data={data}
                             cx="50%"
                             cy="50%"
                             innerRadius={60}
                             outerRadius={80}
                             paddingAngle={5}
                             dataKey="value"
                           >
                             {data.map((entry, index) => (
                               <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                             ))}
                           </Pie>
                           <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                         </PieChart>
                       )}
                     </ResponsiveContainer>
                   </div>
                 </CardContent>
               </Card>
             );
          })}

          {/* AI Analysis */}
          <Card className="lg:col-span-3 bg-gradient-to-br from-primary/5 to-accent/10 border-primary/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <CardTitle className="text-lg flex items-center gap-2 text-primary">
                 <Sparkles className="w-5 h-5" /> 
                 {t('dash.ai')}
               </CardTitle>
               <Button size="sm" onClick={handleAnalyze} disabled={isLoading || recordCount === 0}>
                 {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : t('dash.generate')}
               </Button>
            </CardHeader>
            <CardContent>
               <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                 {isLoading ? (
                   <div className="space-y-2 animate-pulse">
                     <div className="h-4 bg-primary/10 rounded w-3/4"></div>
                     <div className="h-4 bg-primary/10 rounded w-1/2"></div>
                     <div className="h-4 bg-primary/10 rounded w-5/6"></div>
                   </div>
                 ) : aiAnalysis ? (
                   <div dangerouslySetInnerHTML={{ __html: aiAnalysis }} />
                 ) : (
                   <p className="text-muted-foreground text-sm italic">
                     {t('dash.generate_hint')}
                   </p>
                 )}
              </div>
            </CardContent>
          </Card>

          {/* Data Table (If enabled) */}
          {dashboardConfig.showTable && (
             <Card className="lg:col-span-3 overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <TableIcon className="w-5 h-5" /> {t('schema.data_view')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                   <div className="max-h-[400px] overflow-auto">
                      <Table>
                         <TableHeader>
                            <TableRow>
                               {activeSchema.fields.map(f => (
                                  <TableHead key={f.id}>{f.label}</TableHead>
                               ))}
                            </TableRow>
                         </TableHeader>
                         <TableBody>
                            {activeRecords.slice(0, 50).map(r => (
                               <TableRow key={r.id}>
                                  {activeSchema.fields.map(f => {
                                     const val = r.data[f.name];
                                     let displayVal: React.ReactNode = String(val || '-');
                                     if (f.type === 'select' && f.options) {
                                        const opt = f.options.find(o => o.value === val);
                                        if (opt?.color) {
                                          displayVal = (
                                            <span className="inline-flex items-center gap-2">
                                              <span className="w-2 h-2 rounded-full" style={{backgroundColor: opt.color}} />
                                              {val}
                                            </span>
                                          );
                                        }
                                     }
                                     return <TableCell key={f.id}>{displayVal}</TableCell>
                                  })}
                               </TableRow>
                            ))}
                            {activeRecords.length === 0 && (
                               <TableRow>
                                  <TableCell colSpan={activeSchema.fields.length} className="text-center text-muted-foreground py-8">
                                     {t('dash.no_matches')}
                                  </TableCell>
                               </TableRow>
                            )}
                         </TableBody>
                      </Table>
                   </div>
                   {activeRecords.length > 50 && (
                      <div className="p-2 text-center text-xs text-muted-foreground bg-muted/10 border-t">
                         {t('dash.showing_50')}
                      </div>
                   )}
                </CardContent>
             </Card>
          )}
       </div>
    </div>
  );
};

export const DashboardTab: React.FC = () => {
  const { schemas, records, dashboards, dashboardState, setDashboardState } = useAppStore();
  const { t } = useTranslation();
  
  const selectedDashboardId = dashboardState.activeDashboardId || '';

  const setSelectedDashboardId = (id: string) => {
    setDashboardState({ activeDashboardId: id });
  };

  // Default selection priority
  useEffect(() => {
    if (dashboards.length > 0 && (!selectedDashboardId || !dashboards.find(d => d.id === selectedDashboardId))) {
         // Find the default one
         const defaultDash = dashboards.find(d => d.isDefault);
         setSelectedDashboardId(defaultDash ? defaultDash.id : dashboards[0].id);
    }
  }, [dashboards, selectedDashboardId]);

  const activeDashboard = dashboards.find(d => d.id === selectedDashboardId);
  const activeSchema = activeDashboard ? schemas.find(s => s.id === activeDashboard.tableId) : null;

  if (dashboards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
        <BarChart3 className="w-12 h-12 opacity-20" />
        <p>{t('dash.noDash')}</p>
        <p className="text-sm">Go to Configuration &gt; Dashboards to create analytics views.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto space-y-8">
      <div className="flex justify-between items-center">
        {/* Render active title from schema or fallback */}
        <h1 className="text-3xl font-bold tracking-tight">
          {activeDashboard?.name || t('dash.title')}
        </h1>
        <div className="w-64">
          <Combobox
            options={dashboards.map(d => ({ value: d.id, label: d.name }))}
            value={selectedDashboardId}
            onChange={(val) => setSelectedDashboardId(val)}
            placeholder="Select dashboard..."
          />
        </div>
      </div>

      {!activeDashboard || !activeSchema ? (
        <div className="text-center py-20 text-muted-foreground">
             {!activeDashboard ? t('dash.select') : "Configuration Error: Source table not found."}
        </div>
      ) : (
        <DashboardView 
           activeSchema={activeSchema} 
           dashboardConfig={{
               title: activeDashboard.name,
               widgets: activeDashboard.widgets,
               filters: activeDashboard.filters,
               filterLogic: activeDashboard.filterLogic,
               showTable: activeDashboard.showTable
           }}
           records={records} 
           showHeader={false} 
           onAnalyzeRequest={analyzeData}
        />
      )}
    </div>
  );
};
