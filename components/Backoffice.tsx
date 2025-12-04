
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Settings, Database, Users, LayoutDashboard, Calendar, 
  Trash2, Plus, Zap, Shield, Map as MapIcon, Link,
  Edit, Save, X, Eye, Check, Globe, Layers, CheckCircle,
  BarChart3, Activity, PieChart as PieChartIcon, CalendarRange, Filter,
  FileJson, FileSpreadsheet, HardDrive, Download, RefreshCw, MoreVertical, ChevronDown, FileCode,
  Smartphone, Monitor, Cpu, Clock, Wifi, MousePointerClick, TableProperties, Code,
  AlertTriangle, Palette, ToggleLeft
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useAppStore } from '../store';
import { TableSchema, User, UserRole, Shortcut, ShortcutType, TileLayerConfig } from '../types';
import { GEO_TYPES, LANGUAGES, PERMISSIONS_LIST, SHORTCUT_ICONS, SHORTCUT_TYPES } from '../constants';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Combobox } from './ui/combobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { cn, getDirtyFields } from '../lib/utils';
import { SchemaEditor } from './SchemaEditor';
import { DashboardEditor } from './DashboardEditor';
import { CalendarEditor } from './CalendarEditor';
import { ColorPicker } from './ColorPicker';
import { Textarea } from './ui/textarea';
import { Select } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Switch } from './ui/switch';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { ShortcutsConfigView } from './ShortcutsConfigView'; // Assuming you might extract this later, but keeping logic here if not present in previous context
import { UsersSecurityView } from './UsersSecurityView'; // Placeholder if needed

const genId = () => Math.random().toString(36).substr(2, 9);

const NavItem = ({ id, label, icon: Icon, active, onClick }: any) => (
    <button
        onClick={onClick}
        className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full",
            active 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);

const NavGroup = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <div className="mb-6">
        <h4 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider opacity-70">
            {title}
        </h4>
        <div className="space-y-1">
            {children}
        </div>
    </div>
);

// --- Database Administration View ---

interface SystemTableDef {
    id: string;
    name: string;
    description: string;
    count: number;
    data: any[];
}

const DatabaseAdminView = () => {
    const { schemas, records, users, roles } = useAppStore();
    const { toast } = useToast();
    
    // Local state to simulate database configurations
    const [dbConfigs, setDbConfigs] = useState<Record<string, { autoBackup: boolean, lastBackup: string }>>({});
    const [processingBackup, setProcessingBackup] = useState<string | null>(null);
    
    // System Table Details View State
    const [viewingTable, setViewingTable] = useState<SystemTableDef | null>(null);

    // System Tables Definition
    const systemTables: SystemTableDef[] = [
        { id: 'deftable', name: 'deftable', description: 'Stores table schema definitions', count: schemas.length, data: schemas },
        { id: 'defdata', name: 'defdata', description: 'Stores all data records', count: records.length, data: records },
        { id: 'sys_users', name: 'sys_users', description: 'System user accounts', count: users.length, data: users },
        { id: 'sys_roles', name: 'sys_roles', description: 'Role and permission definitions', count: roles.length, data: roles }
    ];

    // Initialize mock configs if missing
    useEffect(() => {
        const newConfigs = { ...dbConfigs };
        let hasChanges = false;
        systemTables.forEach(s => {
            if (!newConfigs[s.id]) {
                const randomDays = Math.floor(Math.random() * 5);
                const date = new Date();
                date.setDate(date.getDate() - randomDays);
                
                newConfigs[s.id] = {
                    autoBackup: Math.random() > 0.3,
                    lastBackup: date.toISOString()
                };
                hasChanges = true;
            }
        });
        if (hasChanges) setDbConfigs(newConfigs);
    }, []);

    const handleToggleBackup = (id: string) => {
        setDbConfigs(prev => ({
            ...prev,
            [id]: { ...prev[id], autoBackup: !prev[id].autoBackup }
        }));
        toast({ title: "Configuration Updated", description: "Auto-backup settings saved." });
    };

    const handleEnableAllBackups = () => {
        const newConfigs = { ...dbConfigs };
        systemTables.forEach(s => {
            if (newConfigs[s.id]) {
                newConfigs[s.id] = { ...newConfigs[s.id], autoBackup: true };
            }
        });
        setDbConfigs(newConfigs);
        toast({ title: "Updated", description: "Auto-backup enabled for all system tables.", variant: "success" });
    };

    const handleCreateBackup = (id: string) => {
        setProcessingBackup(id);
        // Simulate API call
        setTimeout(() => {
            setDbConfigs(prev => ({
                ...prev,
                [id]: { ...prev[id], lastBackup: new Date().toISOString() }
            }));
            setProcessingBackup(null);
            toast({ title: "Backup Successful", description: "A new snapshot has been created.", variant: "success" });
        }, 1500);
    };

    const handleExport = (table: SystemTableDef, format: 'json' | 'csv' | 'sql') => {
        const data = table.data;
        let content = '';
        let mimeType = '';
        let extension = '';

        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        } else if (format === 'csv') {
            // Flatten generic objects to CSV
            if (data.length > 0) {
                const headers = Object.keys(data[0]);
                const csvRows = [headers.join(',')];
                data.forEach(row => {
                    const values = headers.map(header => {
                        const val = (row as any)[header];
                        const escaped = String(typeof val === 'object' ? JSON.stringify(val) : val).replace(/"/g, '""');
                        return `"${escaped}"`;
                    });
                    csvRows.push(values.join(','));
                });
                content = csvRows.join('\n');
            }
            mimeType = 'text/csv';
            extension = 'csv';
        } else if (format === 'sql') {
            content = `-- Export for ${table.name}\n`;
            if (table.name === 'deftable') {
                content += `CREATE TABLE IF NOT EXISTS deftable (id TEXT PRIMARY KEY, name TEXT, definition JSONB);\n`;
                data.forEach((s: any) => {
                    content += `INSERT INTO deftable (id, name, definition) VALUES ('${s.id}', '${s.name}', '${JSON.stringify(s).replace(/'/g, "''")}');\n`;
                });
            } else if (table.name === 'defdata') {
                content += `CREATE TABLE IF NOT EXISTS defdata (id TEXT PRIMARY KEY, table_id TEXT, data JSONB);\n`;
                data.forEach((r: any) => {
                    content += `INSERT INTO defdata (id, table_id, data) VALUES ('${r.id}', '${r.tableId}', '${JSON.stringify(r).replace(/'/g, "''")}');\n`;
                });
            } else {
                // Generic fallback
                data.forEach((r: any) => {
                    content += `INSERT INTO ${table.name} VALUES ('${JSON.stringify(r).replace(/'/g, "''")}');\n`;
                });
            }
            mimeType = 'application/sql';
            extension = 'sql';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${table.name}_export.${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleExportAll = (format: 'json' | 'sql' | 'csv' = 'json') => {
        // Full System Dump
        if (format === 'sql') {
            let sql = `-- Full Database Backup\n\n`;
            
            // 1. Deftable
            sql += `-- Table: deftable\n`;
            sql += `CREATE TABLE IF NOT EXISTS deftable (id TEXT PRIMARY KEY, name TEXT, definition JSONB);\n`;
            schemas.forEach(s => {
                sql += `INSERT INTO deftable (id, name, definition) VALUES ('${s.id}', '${s.name}', '${JSON.stringify(s).replace(/'/g, "''")}');\n`;
            });
            sql += `\n`;

            // 2. Defdata
            sql += `-- Table: defdata\n`;
            sql += `CREATE TABLE IF NOT EXISTS defdata (id TEXT PRIMARY KEY, table_id TEXT, data JSONB);\n`;
            records.forEach(r => {
                sql += `INSERT INTO defdata (id, table_id, data) VALUES ('${r.id}', '${r.tableId}', '${JSON.stringify(r).replace(/'/g, "''")}');\n`;
            });
            sql += `\n`;

            // 3. Users/Roles
            sql += `-- Table: sys_users\n`;
            users.forEach(u => {
                sql += `INSERT INTO sys_users (id, username, email, role_id) VALUES ('${u.id}', '${u.username}', '${u.email}', '${u.roleId}');\n`;
            });

            const blob = new Blob([sql], { type: 'application/sql' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full_backup.sql`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Simple JSON dump
            const data = { schemas, records, users, roles };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `full_backup.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    const stats = useMemo(() => {
        let totalSize = 0;
        records.forEach(r => {
            totalSize += JSON.stringify(r).length;
        });
        schemas.forEach(s => totalSize += JSON.stringify(s).length);
        
        return {
            totalTables: schemas.length, // Logical user tables
            totalRecords: records.length,
            totalSize: (totalSize / 1024).toFixed(2) + ' KB'
        };
    }, [schemas, records]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex flex-col gap-2">
                <h3 className="text-lg font-medium flex items-center gap-2">
                    <Database className="w-5 h-5" /> Database Administration
                </h3>
                <p className="text-sm text-muted-foreground">Manage core system tables and data storage.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">User Schemas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalTables}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Records</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalRecords}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Est. DB Size</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">{stats.totalSize}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-6">
                    <div className="space-y-1">
                        <CardTitle>System Tables</CardTitle>
                        <CardDescription>Core database tables storing configuration and data.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleEnableAllBackups}>
                            <CheckCircle className="w-4 h-4 mr-2" /> Enable All Backups
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                    <Download className="w-4 h-4 mr-2" /> Export All <ChevronDown className="w-3 h-3 ml-1" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => handleExportAll('json')}>JSON Dump</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportAll('sql')}>SQL Dump</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleExportAll('csv')} disabled>CSV (Not supported for full dump)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Table Name</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[100px]">Rows</TableHead>
                                <TableHead className="w-[150px]">Auto Backup</TableHead>
                                <TableHead className="w-[180px]">Last Backup</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {systemTables.map(table => {
                                const config = dbConfigs[table.id] || { autoBackup: false, lastBackup: '-' };
                                const isBackingUp = processingBackup === table.id;

                                return (
                                    <TableRow 
                                        key={table.id} 
                                        className="cursor-pointer hover:bg-muted/50"
                                        onClick={() => setViewingTable(table)}
                                    >
                                        <TableCell className="font-medium font-mono text-xs">
                                            {table.name}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {table.description}
                                        </TableCell>
                                        <TableCell>{table.count}</TableCell>
                                        <TableCell onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center gap-2">
                                                <Switch 
                                                    checked={config.autoBackup}
                                                    onCheckedChange={() => handleToggleBackup(table.id)}
                                                    className="scale-75"
                                                />
                                                <span className="text-xs text-muted-foreground">{config.autoBackup ? 'On' : 'Off'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">
                                            {config.lastBackup !== '-' ? new Date(config.lastBackup).toLocaleString() : 'Never'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleCreateBackup(table.id)}
                                                    disabled={isBackingUp}
                                                >
                                                    <HardDrive className={cn("w-4 h-4", isBackingUp && "animate-pulse")} />
                                                </Button>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handleExport(table, 'json')}>Export JSON</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport(table, 'sql')}>Export SQL</DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport(table, 'csv')}>Export CSV</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* System Table Details Modal */}
            <Dialog open={!!viewingTable} onOpenChange={(open) => !open && setViewingTable(null)}>
                <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle className="font-mono">{viewingTable?.name}</DialogTitle>
                        <DialogDescription>{viewingTable?.description} ({viewingTable?.count} rows)</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    {viewingTable?.id === 'deftable' && (
                                        <>
                                            <TableHead className="w-[150px]">ID</TableHead>
                                            <TableHead>Schema Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Fields</TableHead>
                                        </>
                                    )}
                                    {viewingTable?.id === 'defdata' && (
                                        <>
                                            <TableHead className="w-[150px]">ID</TableHead>
                                            <TableHead className="w-[150px]">Table ID</TableHead>
                                            <TableHead>Data Preview</TableHead>
                                        </>
                                    )}
                                    {viewingTable?.id === 'sys_users' && (
                                        <>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Username</TableHead>
                                            <TableHead>Role ID</TableHead>
                                        </>
                                    )}
                                    {viewingTable?.id === 'sys_roles' && (
                                        <>
                                            <TableHead>ID</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Permissions</TableHead>
                                        </>
                                    )}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viewingTable?.data.slice(0, 50).map((row: any) => (
                                    <TableRow key={row.id}>
                                        {viewingTable.id === 'deftable' && (
                                            <>
                                                <TableCell className="font-mono text-xs">{row.id}</TableCell>
                                                <TableCell>{row.name}</TableCell>
                                                <TableCell>{row.geometryType}</TableCell>
                                                <TableCell>{row.fields?.length || 0}</TableCell>
                                            </>
                                        )}
                                        {viewingTable.id === 'defdata' && (
                                            <>
                                                <TableCell className="font-mono text-xs">{row.id}</TableCell>
                                                <TableCell className="font-mono text-xs">{row.tableId}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground truncate max-w-[300px]">
                                                    {JSON.stringify(row.data)}
                                                </TableCell>
                                            </>
                                        )}
                                        {viewingTable.id === 'sys_users' && (
                                            <>
                                                <TableCell className="font-mono text-xs">{row.id}</TableCell>
                                                <TableCell>{row.username}</TableCell>
                                                <TableCell>{row.roleId}</TableCell>
                                            </>
                                        )}
                                        {viewingTable.id === 'sys_roles' && (
                                            <>
                                                <TableCell className="font-mono text-xs">{row.id}</TableCell>
                                                <TableCell>{row.name}</TableCell>
                                                <TableCell className="text-xs truncate max-w-[300px]">{row.permissions?.join(', ')}</TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <p className="text-xs text-muted-foreground text-center">Showing first 50 rows.</p>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// --- Usage Statistics View ---

interface LogEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  status: 'success' | 'warning' | 'error';
}

const UsageStatisticsView = () => {
    // Mock Data
    const logs: LogEntry[] = useMemo(() => {
        return Array.from({length: 20}).map((_, i) => ({
            id: `log_${i}`,
            user: ['admin', 'editor', 'viewer'][Math.floor(Math.random()*3)],
            action: ['CREATE_RECORD', 'UPDATE_SCHEMA', 'EXPORT_DATA', 'LOGIN', 'DELETE_RECORD'][Math.floor(Math.random()*5)],
            target: ['Table: Assets', 'Table: Interventions', 'System'][Math.floor(Math.random()*3)],
            timestamp: new Date(Date.now() - Math.floor(Math.random() * 1000000000)).toISOString(),
            status: Math.random() > 0.9 ? 'error' : (Math.random() > 0.8 ? 'warning' : 'success')
        })).sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, []);

    const [activeSubTab, setActiveSubTab] = useState<'overview' | 'tech' | 'modules' | 'connectivity'>('overview');

    const chartData = [
        { name: 'Mon', logins: 45, edits: 120, exports: 10 },
        { name: 'Tue', logins: 52, edits: 132, exports: 15 },
        { name: 'Wed', logins: 48, edits: 101, exports: 8 },
        { name: 'Thu', logins: 61, edits: 145, exports: 20 },
        { name: 'Fri', logins: 55, edits: 160, exports: 25 },
        { name: 'Sat', logins: 20, edits: 45, exports: 5 },
        { name: 'Sun', logins: 15, edits: 30, exports: 2 },
    ];

    const browserData = [
        { name: 'Chrome', value: 65, fill: '#4285F4' },
        { name: 'Firefox', value: 15, fill: '#FF7139' },
        { name: 'Safari', value: 12, fill: '#00ACED' },
        { name: 'Edge', value: 8, fill: '#0078D7' },
    ];

    const moduleData = [
        { subject: 'Map', A: 120, fullMark: 150 },
        { subject: 'Data', A: 98, fullMark: 150 },
        { subject: 'Dash', A: 86, fullMark: 150 },
        { subject: 'Plan', A: 65, fullMark: 150 },
        { subject: 'Config', A: 40, fullMark: 150 },
    ];

    const connData = Array.from({length: 24}, (_, i) => ({
        hour: `${i}h`,
        users: Math.floor(Math.random() * 50) + (i > 8 && i < 18 ? 40 : 5)
    }));

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2"><Activity className="w-5 h-5" /> System Analytics</h3>
                
                <div className="flex bg-muted p-1 rounded-md">
                    {['overview', 'tech', 'modules', 'connectivity'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveSubTab(tab as any)}
                            className={cn(
                                "px-3 py-1.5 text-xs font-medium rounded-sm transition-all capitalize",
                                activeSubTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>
            
            {activeSubTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Weekly Activity</CardTitle></CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                                            </linearGradient>
                                            <linearGradient id="colorEdits" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                        <RechartsTooltip />
                                        <Area type="monotone" dataKey="logins" stroke="#8884d8" fillOpacity={1} fill="url(#colorLogins)" />
                                        <Area type="monotone" dataKey="edits" stroke="#82ca9d" fillOpacity={1} fill="url(#colorEdits)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-100 rounded-full text-green-600"><CheckCircle className="w-5 h-5" /></div>
                                        <div>
                                            <div className="font-medium text-green-900">Database Connection</div>
                                            <div className="text-xs text-green-700">Optimal latency (12ms)</div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" className="text-green-700 hover:text-green-800 hover:bg-green-100">Details</Button>
                                </div>
                                <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-100 rounded-full text-blue-600"><Cpu className="w-5 h-5" /></div>
                                        <div>
                                            <div className="font-medium text-blue-900">Server Load</div>
                                            <div className="text-xs text-blue-700">CPU: 24% | Memory: 45%</div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Audit Logs</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Timestamp</TableHead>
                                        <TableHead>User</TableHead>
                                        <TableHead>Action</TableHead>
                                        <TableHead>Target</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map(log => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-mono text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</TableCell>
                                            <TableCell>{log.user}</TableCell>
                                            <TableCell className="font-medium text-xs">{log.action}</TableCell>
                                            <TableCell className="text-muted-foreground">{log.target}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold",
                                                    log.status === 'success' ? "bg-green-100 text-green-700" : 
                                                    log.status === 'warning' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                                                )}>
                                                    {log.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeSubTab === 'tech' && (
                <div className="grid grid-cols-2 gap-6">
                    <Card>
                        <CardHeader><CardTitle>Browser Usage</CardTitle></CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={browserData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                                        {browserData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Device Types</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-4 border rounded">
                                <div className="flex items-center gap-3">
                                    <Monitor className="w-5 h-5 text-blue-500" />
                                    <span>Desktop</span>
                                </div>
                                <span className="font-bold">82%</span>
                            </div>
                            <div className="flex items-center justify-between p-4 border rounded">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-green-500" />
                                    <span>Mobile / Tablet</span>
                                </div>
                                <span className="font-bold">18%</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {activeSubTab === 'modules' && (
                <Card>
                    <CardHeader><CardTitle>Module Engagement</CardTitle></CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={moduleData}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis />
                                <Radar name="Usage" dataKey="A" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {activeSubTab === 'connectivity' && (
                <Card>
                    <CardHeader><CardTitle>Hourly Traffic (Last 24h)</CardTitle></CardHeader>
                    <CardContent className="h-[400px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={connData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="hour" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                                <RechartsTooltip />
                                <Bar dataKey="users" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

// --- Map Configuration View ---

const MapConfigView = () => {
    const { mapConfig, updateMapConfig, schemas, updateSchema } = useAppStore();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'layers' | 'styles'>('layers');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingLayer, setEditingLayer] = useState<Partial<TileLayerConfig>>({});
    
    // Feature Styling State
    const [selectedStyleSchemaId, setSelectedStyleSchemaId] = useState<string | null>(null);
    const selectedSchema = useMemo(() => 
        schemas.find(s => s.id === selectedStyleSchemaId), 
    [schemas, selectedStyleSchemaId]);

    const handleSaveLayer = () => {
        if (!editingLayer.name || !editingLayer.url) {
            toast({ title: "Error", description: "Name and URL are required.", variant: "destructive" });
            return;
        }

        const newLayer = {
            id: editingLayer.id || genId(),
            name: editingLayer.name,
            url: editingLayer.url,
            attribution: editingLayer.attribution || '',
            maxZoom: Number(editingLayer.maxZoom) || 19,
            subdomains: editingLayer.subdomains || '',
            isDefaultVisible: editingLayer.isDefaultVisible,
            defaultOpacity: editingLayer.defaultOpacity ?? 1
        };

        if (editingLayer.id) {
            // Update
            const updatedLayers = mapConfig.tileLayers.map(l => l.id === newLayer.id ? newLayer : l);
            updateMapConfig({ ...mapConfig, tileLayers: updatedLayers });
            toast({ title: "Updated", description: "Tile layer updated successfully." });
        } else {
            // Create
            updateMapConfig({ ...mapConfig, tileLayers: [...mapConfig.tileLayers, newLayer] });
            toast({ title: "Created", description: "New tile layer added." });
        }
        setIsEditModalOpen(false);
        setEditingLayer({});
    };

    const handleDeleteLayer = (id: string) => {
        if (mapConfig.tileLayers.length <= 1) {
            toast({ title: "Error", description: "Cannot delete the last layer.", variant: "destructive" });
            return;
        }
        const updatedLayers = mapConfig.tileLayers.filter(l => l.id !== id);
        updateMapConfig({ ...mapConfig, tileLayers: updatedLayers });
        toast({ title: "Deleted", description: "Tile layer removed." });
    };

    const openEdit = (layer?: TileLayerConfig) => {
        if (layer) {
            setEditingLayer({ ...layer });
        } else {
            setEditingLayer({ name: '', url: '', attribution: '', maxZoom: 19, subdomains: 'abc', isDefaultVisible: false, defaultOpacity: 1 });
        }
        setIsEditModalOpen(true);
    };

    // Style Helpers
    const updateSubLayerConfig = (schema: TableSchema, key: string, value: any) => {
        const current = schema.subLayerConfig || { enabled: false, field: '', rules: [] };
        updateSchema({
            ...schema,
            subLayerConfig: { ...current, [key]: value }
        });
    };

    const addRule = (schema: TableSchema) => {
        const current = schema.subLayerConfig || { enabled: true, field: '', rules: [] };
        const newRule = { value: '', label: '', color: '#cccccc' };
        updateSchema({
            ...schema,
            subLayerConfig: { ...current, rules: [...current.rules, newRule] }
        });
    };

    const updateRule = (schema: TableSchema, idx: number, key: string, value: any) => {
        if (!schema.subLayerConfig) return;
        const newRules = [...schema.subLayerConfig.rules];
        newRules[idx] = { ...newRules[idx], [key]: value };
        updateSchema({
            ...schema,
            subLayerConfig: { ...schema.subLayerConfig, rules: newRules }
        });
    };

    const removeRule = (schema: TableSchema, idx: number) => {
        if (!schema.subLayerConfig) return;
        const newRules = schema.subLayerConfig.rules.filter((_, i) => i !== idx);
        updateSchema({
            ...schema,
            subLayerConfig: { ...schema.subLayerConfig, rules: newRules }
        });
    };

    const generateRulesFromOptions = (schema: TableSchema) => {
        if (!schema.subLayerConfig?.field) return;
        const fieldDef = schema.fields.find(f => f.name === schema.subLayerConfig!.field);
        if (fieldDef && fieldDef.type === 'select' && fieldDef.options) {
            const newRules = fieldDef.options.map(opt => ({
                value: opt.value,
                label: opt.label,
                color: opt.color || '#cccccc'
            }));
            updateSchema({
                ...schema,
                subLayerConfig: { ...schema.subLayerConfig, rules: newRules }
            });
            toast({ title: "Rules Generated", description: `Created ${newRules.length} styling rules from field options.` });
        } else {
            toast({ title: "Cannot Generate", description: "Selected field is not a list with options.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-medium flex items-center gap-2"><MapIcon className="w-5 h-5" /> Map Configuration</h3>
                    <p className="text-sm text-muted-foreground">Manage base maps and default view settings.</p>
                </div>
            </div>

            <div className="flex space-x-1 bg-muted p-1 rounded-md w-fit">
                <button
                    onClick={() => setActiveTab('layers')}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-sm transition-all",
                        activeTab === 'layers' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Tile Layers
                </button>
                <button
                    onClick={() => setActiveTab('styles')}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-sm transition-all",
                        activeTab === 'styles' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    Layer Styles
                </button>
            </div>

            {activeTab === 'layers' && (
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Base Maps</CardTitle>
                        <Button size="sm" onClick={() => openEdit()}><Plus className="w-4 h-4 mr-2" /> Add Layer</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>URL Template</TableHead>
                                    <TableHead className="w-[100px]">Default</TableHead>
                                    <TableHead className="w-[100px]">Opacity</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mapConfig.tileLayers.map(layer => (
                                    <TableRow key={layer.id}>
                                        <TableCell className="font-medium">
                                            {layer.name}
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate" title={layer.url}>
                                            {layer.url}
                                        </TableCell>
                                        <TableCell>
                                            {layer.isDefaultVisible ? (
                                                <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">Active</span>
                                            ) : (
                                                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">Inactive</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-xs">{(layer.defaultOpacity ?? 1) * 100}%</span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(layer)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                                    onClick={() => handleDeleteLayer(layer.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {activeTab === 'styles' && (
                <div className="grid grid-cols-12 gap-6 h-[600px]">
                    {/* Layer List */}
                    <div className="col-span-4 border-r pr-4 overflow-y-auto">
                        <Label className="text-xs font-bold text-muted-foreground uppercase mb-2 block">Feature Layers</Label>
                        {schemas.filter(s => s.geometryType !== 'none').map(s => (
                            <div 
                                key={s.id} 
                                onClick={() => setSelectedStyleSchemaId(s.id)}
                                className={cn(
                                    "flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors mb-2",
                                    selectedStyleSchemaId === s.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted border border-transparent"
                                )}
                            >
                                <div className="w-4 h-4 rounded-full shadow-sm" style={{background: s.color}} />
                                <span className="font-medium text-sm">{s.name}</span>
                            </div>
                        ))}
                    </div>
                    
                    {/* Editor */}
                    <div className="col-span-8 overflow-y-auto pl-2 pr-1">
                        {selectedSchema ? (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <span className="w-3 h-3 rounded-full" style={{background: selectedSchema.color}} />
                                        {selectedSchema.name} Styling
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {/* Base Color */}
                                    <div className="space-y-2">
                                        <Label>Default Color</Label>
                                        <ColorPicker color={selectedSchema.color} onChange={(c) => updateSchema({...selectedSchema, color: c})} />
                                    </div>

                                    <div className="h-px bg-border my-4" />

                                    {/* Thematic Styling */}
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="text-base">Thematic Styling</Label>
                                                <p className="text-xs text-muted-foreground">Color features based on field values.</p>
                                            </div>
                                            <Switch 
                                                checked={selectedSchema.subLayerConfig?.enabled || false}
                                                onCheckedChange={(c) => updateSubLayerConfig(selectedSchema, 'enabled', c)}
                                            />
                                        </div>
                                        
                                        {selectedSchema.subLayerConfig?.enabled && (
                                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 border p-4 rounded-md bg-muted/20">
                                                <div className="space-y-2">
                                                    <div className="flex justify-between">
                                                        <Label>Drive Style by Field</Label>
                                                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => generateRulesFromOptions(selectedSchema)}>
                                                            Generate from Options
                                                        </Button>
                                                    </div>
                                                    <Combobox 
                                                        options={selectedSchema.fields.map(f => ({ label: f.label, value: f.name }))}
                                                        value={selectedSchema.subLayerConfig.field}
                                                        onChange={(val) => updateSubLayerConfig(selectedSchema, 'field', val)}
                                                        placeholder="Select Field"
                                                    />
                                                </div>

                                                <div className="space-y-2">
                                                    <Label>Styling Rules</Label>
                                                    <div className="border rounded-md divide-y bg-background">
                                                        {selectedSchema.subLayerConfig.rules.map((rule, idx) => (
                                                            <div key={idx} className="flex items-center gap-2 p-2">
                                                                <Input 
                                                                    placeholder="Value (Match)" 
                                                                    value={rule.value} 
                                                                    onChange={(e) => updateRule(selectedSchema, idx, 'value', e.target.value)}
                                                                    className="h-8 text-xs flex-1"
                                                                />
                                                                <Input 
                                                                    placeholder="Label (Legend)" 
                                                                    value={rule.label || ''} 
                                                                    onChange={(e) => updateRule(selectedSchema, idx, 'label', e.target.value)}
                                                                    className="h-8 text-xs flex-1"
                                                                />
                                                                <div className="shrink-0">
                                                                    <ColorPicker 
                                                                        color={rule.color} 
                                                                        onChange={(c) => updateRule(selectedSchema, idx, 'color', c)} 
                                                                    />
                                                                </div>
                                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => removeRule(selectedSchema, idx)}>
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button variant="ghost" className="w-full h-9 text-xs border-t rounded-t-none" onClick={() => addRule(selectedSchema)}>
                                                            <Plus className="w-3 h-3 mr-2" /> Add Rule
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 border-2 border-dashed rounded-lg">
                                <Palette className="w-12 h-12 mb-2" />
                                <p>Select a layer to configure styles</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingLayer.id ? 'Edit Layer' : 'Add Layer'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Name <span className="text-red-500">*</span></Label>
                            <Input value={editingLayer.name || ''} onChange={e => setEditingLayer({...editingLayer, name: e.target.value})} placeholder="e.g. OpenStreetMap" />
                        </div>
                        <div className="space-y-2">
                            <Label>URL Template <span className="text-red-500">*</span></Label>
                            <Input value={editingLayer.url || ''} onChange={e => setEditingLayer({...editingLayer, url: e.target.value})} placeholder="https://{s}.tile.osm.org/{z}/{x}/{y}.png" />
                            <p className="text-xs text-muted-foreground">Use placeholders like {'{s}'}, {'{z}'}, {'{x}'}, {'{y}'}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Attribution</Label>
                            <Input value={editingLayer.attribution || ''} onChange={e => setEditingLayer({...editingLayer, attribution: e.target.value})} placeholder="© OpenStreetMap contributors" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Subdomains</Label>
                                <Input value={editingLayer.subdomains || ''} onChange={e => setEditingLayer({...editingLayer, subdomains: e.target.value})} placeholder="abc" />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Zoom</Label>
                                <Input type="number" value={editingLayer.maxZoom || ''} onChange={e => setEditingLayer({...editingLayer, maxZoom: Number(e.target.value)})} placeholder="19" />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 border-t pt-4">
                            <div className="flex flex-col gap-2">
                                <Label className="text-sm">Active by Default</Label>
                                <div className="flex items-center gap-2">
                                    <Switch 
                                        checked={editingLayer.isDefaultVisible || false}
                                        onCheckedChange={(c) => setEditingLayer({...editingLayer, isDefaultVisible: c})}
                                    />
                                    <span className="text-xs text-muted-foreground">{editingLayer.isDefaultVisible ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between">
                                    <Label className="text-sm">Default Opacity</Label>
                                    <span className="text-xs text-muted-foreground">{Math.round((editingLayer.defaultOpacity ?? 1) * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.1"
                                    className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                                    value={editingLayer.defaultOpacity ?? 1}
                                    onChange={(e) => setEditingLayer({...editingLayer, defaultOpacity: parseFloat(e.target.value)})}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveLayer}>Save Layer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// --- Main Backoffice Component ---

export const Backoffice: React.FC = () => {
    const { t } = useTranslation();
    const { hasPermission, schemas, addSchema, updateSchema, deleteSchema, currentUser, preferences, updatePreferences, mapConfig, updateMapConfig } = useAppStore();
    const [activeSection, setActiveSection] = useState('general');
    
    // Schema Editor State
    const [editingSchema, setEditingSchema] = useState<TableSchema | null>(null);

    // Initial check for permissions
    useEffect(() => {
        // Redirect logic if needed, but for now Backoffice is protected by main App.tsx
    }, []);

    const handleSchemaSave = (schema: TableSchema) => {
        if (schema.id) {
            updateSchema(schema);
        } else {
            addSchema({ ...schema, id: genId() });
        }
        setEditingSchema(null);
    };

    const handleSchemaDelete = (id: string) => {
        if (confirm("Are you sure you want to delete this table? All data will be lost.")) {
            deleteSchema(id);
        }
    };

    const handleNewSchema = () => {
        setEditingSchema({
            id: '',
            name: '',
            description: '',
            geometryType: 'point',
            color: '#000000',
            fields: [],
            visibleInData: true,
            visibleInMap: true,
            mapDisplayMode: 'tooltip'
        });
    };

    const renderContent = () => {
        if (editingSchema) {
            return (
                <SchemaEditor 
                    schema={editingSchema} 
                    onSave={handleSchemaSave} 
                    onCancel={() => setEditingSchema(null)} 
                />
            );
        }

        switch (activeSection) {
            case 'general':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-medium">{t('cfg.general')}</h3>
                            <p className="text-sm text-muted-foreground">Application-wide preferences and settings.</p>
                        </div>
                        <div className="grid gap-6">
                            <Card>
                                <CardHeader><CardTitle>Appearance</CardTitle></CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Theme</Label>
                                            <Combobox 
                                                options={[{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}, {value: 'system', label: 'System'}]}
                                                value={preferences.theme}
                                                onChange={v => updatePreferences({ theme: v as any })}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Language</Label>
                                            <Combobox 
                                                options={LANGUAGES}
                                                value={preferences.language}
                                                onChange={v => updatePreferences({ language: v })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Primary Color</Label>
                                        <ColorPicker color={preferences.primaryColor} onChange={c => updatePreferences({ primaryColor: c })} />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                );

            case 'map_config':
                return <MapConfigView />;

            case 'database':
                return <DatabaseAdminView />;

            case 'logs':
                return <UsageStatisticsView />;

            case 'schemas':
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-medium">{t('cfg.tables')}</h3>
                                <p className="text-sm text-muted-foreground">Manage data structures and layers.</p>
                            </div>
                            <Button onClick={handleNewSchema}><Plus className="w-4 h-4 mr-2" /> {t('schema.create')}</Button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {schemas.map(s => (
                                <Card key={s.id} className="cursor-pointer hover:shadow-md transition-shadow group relative" onClick={() => setEditingSchema(s)}>
                                    <CardHeader className="pb-2">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{background: s.color}} />
                                                <CardTitle className="text-base">{s.name}</CardTitle>
                                            </div>
                                            <div className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">{s.geometryType}</div>
                                        </div>
                                        <CardDescription>{s.description || 'No description'}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-sm text-muted-foreground">{s.fields.length} Fields defined</div>
                                    </CardContent>
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleSchemaDelete(s.id); }}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                );

            case 'dashboards':
                return <DashboardEditor />;

            case 'calendars':
                return <CalendarEditor />;
            
            case 'shortcuts':
                return <ShortcutsConfigView />;

            case 'users':
                return <UsersSecurityView />;

            default:
                return <div className="p-8 text-center text-muted-foreground">Module under construction.</div>;
        }
    };

    return (
        <div className="flex h-full bg-background">
            {/* Sidebar */}
            <div className="w-64 border-r bg-muted/10 flex flex-col shrink-0">
                <div className="p-4 border-b bg-background/50 backdrop-blur">
                    <h2 className="font-semibold text-lg tracking-tight flex items-center gap-2">
                        <Settings className="w-5 h-5 text-primary" />
                        Configuration
                    </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-1">
                    <NavGroup title="System">
                        <NavItem 
                            id="general" label={t('cfg.general')} icon={Settings} 
                            active={activeSection === 'general'} onClick={() => setActiveSection('general')} 
                        />
                        <NavItem 
                            id="database" label="Database Admin" icon={Database} 
                            active={activeSection === 'database'} onClick={() => setActiveSection('database')} 
                        />
                        <NavItem 
                            id="logs" label="System Logs" icon={Activity} 
                            active={activeSection === 'logs'} onClick={() => setActiveSection('logs')} 
                        />
                    </NavGroup>

                    <NavGroup title="Modules">
                        <NavItem 
                            id="map_config" label="Map Configuration" icon={MapIcon} 
                            active={activeSection === 'map_config'} onClick={() => setActiveSection('map_config')} 
                        />
                        <NavItem 
                            id="schemas" label={t('cfg.tables')} icon={TableProperties} 
                            active={activeSection === 'schemas'} onClick={() => setActiveSection('schemas')} 
                        />
                        <NavItem 
                            id="dashboards" label={t('cfg.dash')} icon={LayoutDashboard} 
                            active={activeSection === 'dashboards'} onClick={() => setActiveSection('dashboards')} 
                        />
                        <NavItem 
                            id="calendars" label={t('cfg.cals')} icon={Calendar} 
                            active={activeSection === 'calendars'} onClick={() => setActiveSection('calendars')} 
                        />
                    </NavGroup>

                    <NavGroup title="Access & Tools">
                        <NavItem 
                            id="users" label={t('cfg.users')} icon={Users} 
                            active={activeSection === 'users'} onClick={() => setActiveSection('users')} 
                        />
                        <NavItem 
                            id="shortcuts" label={t('cfg.shortcuts')} icon={Zap} 
                            active={activeSection === 'shortcuts'} onClick={() => setActiveSection('shortcuts')} 
                        />
                    </NavGroup>
                </div>
                <div className="p-4 border-t text-xs text-muted-foreground bg-muted/20">
                    <div>GeoNexus v1.2.0</div>
                    <div>Logged in as: <span className="font-medium text-foreground">{currentUser?.username}</span></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-slate-900/50">
                <div className="max-w-7xl mx-auto h-full">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
