
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
import { DataRecord, TableSchema } from '../types';

const COLORS = ['hsl(var(--primary))', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface DashboardViewProps {
  activeSchema: TableSchema;
  records: DataRecord[];
  // Optional overrides or controls
  showHeader?: boolean;
  onAnalyzeRequest?: (schema: TableSchema, records: DataRecord[]) => Promise<string>;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ activeSchema, records, showHeader = true, onAnalyzeRequest }) => {
  const { t } = useTranslation();
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset analysis when schema changes
  useEffect(() => {
    setAiAnalysis(null);
  }, [activeSchema.id]);

  // Filter records based on tableId AND configured filters in schema
  const activeRecords = useMemo(() => {
    let result = records.filter(r => r.tableId === activeSchema.id);
    
    // Apply configured dashboard filters
    if (activeSchema.dashboard?.filters && activeSchema.dashboard.filters.length > 0) {
        result = result.filter(r => {
            return activeSchema.dashboard!.filters!.every(f => {
                if (!f.value || !f.field) return true;
                const val = r.data[f.field];
                const checkVal = f.value;

                switch(f.operator) {
                    case 'equals': return String(val) == checkVal;
                    case 'neq': return String(val) != checkVal;
                    case 'contains': return String(val).toLowerCase().includes(checkVal.toLowerCase());
                    case 'gt': return Number(val) > Number(checkVal);
                    case 'lt': return Number(val) < Number(checkVal);
                    default: return true;
                }
            });
        });
    }
    return result;
  }, [activeSchema, records]);

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
              {activeSchema.dashboard?.title || t('dash.title')}
            </h1>
            <p className="text-muted-foreground">
               {activeSchema.dashboard?.title ? t('dash.title') + ' - ' : ''} {activeSchema.name}
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
              {activeSchema.dashboard?.filters && activeSchema.dashboard.filters.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                     <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                     {t('dash.filtered')}
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
              <div className="text-2xl font-bold capitalize">{activeSchema.dashboard?.widgets.length || 0}</div>
            </CardContent>
          </Card>

          {/* Dynamic Widgets */}
          {activeSchema.dashboard?.widgets.map((widget, idx) => {
             const data = getWidgetData(widget.field);
             if (data.length === 0) return null;

             return (
               <Card key={widget.id} className="lg:col-span-1 min-h-[300px]">
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
          {activeSchema.dashboard?.showTable && (
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
  const { schemas, records, dashboardState, setDashboardState } = useAppStore();
  const { t } = useTranslation();
  
  // Filter schemas that have dashboard enabled
  const dashboardSchemas = schemas.filter(s => s.dashboard?.enabled);
  
  const selectedSchemaId = dashboardState.activeSchemaId || '';

  const setSelectedSchemaId = (id: string) => {
    setDashboardState({ activeSchemaId: id });
  };

  // Default selection priority
  useEffect(() => {
    if (dashboardSchemas.length > 0 && (!selectedSchemaId || !dashboardSchemas.find(s => s.id === selectedSchemaId))) {
         // Find the default one
         const defaultSchema = dashboardSchemas.find(s => s.dashboard?.isDefault);
         setSelectedSchemaId(defaultSchema ? defaultSchema.id : dashboardSchemas[0].id);
    }
  }, [dashboardSchemas, selectedSchemaId]);

  const activeSchema = dashboardSchemas.find(s => s.id === selectedSchemaId);

  if (dashboardSchemas.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground flex-col gap-2">
        <BarChart3 className="w-12 h-12 opacity-20" />
        <p>{t('dash.noDash')}</p>
        <p className="text-sm">Go to Configuration &gt; Dashboards to enable analytics for your tables.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto h-full overflow-y-auto space-y-8">
      <div className="flex justify-between items-center">
        {/* Render active title from schema or fallback */}
        <h1 className="text-3xl font-bold tracking-tight">
          {activeSchema?.dashboard?.title || t('dash.title')}
        </h1>
        <div className="w-64">
          <Combobox
            options={dashboardSchemas.map(s => ({ value: s.id, label: s.name }))}
            value={selectedSchemaId}
            onChange={(val) => setSelectedSchemaId(val)}
            placeholder="Select dataset..."
          />
        </div>
      </div>

      {!activeSchema ? (
        <div className="text-center py-20 text-muted-foreground">{t('dash.select')}</div>
      ) : (
        <DashboardView 
           activeSchema={activeSchema} 
           records={records} 
           showHeader={false} // We render the header above to include the selector
           onAnalyzeRequest={analyzeData}
        />
      )}
    </div>
  );
};
