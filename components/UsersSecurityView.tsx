
import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { User, UserRole } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Combobox } from './ui/combobox';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { useToast } from './ui/use-toast';
import { PERMISSIONS_LIST } from '../constants';
import { Users, Shield, Plus, Edit, Trash2, Key, ChevronLeft, ChevronRight, Eye, RefreshCw, Copy } from 'lucide-react';
import { cn } from '../lib/utils';

const genId = () => Math.random().toString(36).substr(2, 9);

export const UsersSecurityView: React.FC = () => {
    const { users, roles, addUser, updateUser, deleteUser, addRole, updateRole, deleteRole, hasPermission } = useAppStore();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');

    // Pagination State
    const [userPage, setUserPage] = useState(1);
    const [rolePage, setRolePage] = useState(1);
    const ITEMS_PER_PAGE = 10;

    // User Dialog State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<Partial<User>>({});
    const [userPassword, setUserPassword] = useState('');
    const [showPasswordFields, setShowPasswordFields] = useState(false);

    // Role Dialog State
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Partial<UserRole>>({});

    // Delete Confirmation
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleteType, setDeleteType] = useState<'user' | 'role' | null>(null);

    // Helpers
    const isUserAdmin = (u: User) => {
        const r = roles.find(role => role.id === u.roleId);
        return r?.permissions.includes('sys_admin') || u.username === 'admin';
    };

    // --- User Logic ---
    const handleAddUser = () => {
        setEditingUser({ id: '', username: '', email: '', roleId: roles[0]?.id });
        setUserPassword(''); // Reset password field
        setShowPasswordFields(true); // Always show for new users
        setIsUserModalOpen(true);
    };

    const handleEditUser = (user: User) => {
        setEditingUser({ ...user });
        setUserPassword('');
        setShowPasswordFields(false); // Hide by default for edit
        setIsUserModalOpen(true);
    };

    const handleDeleteRequest = (id: string, type: 'user' | 'role') => {
        // Validation: Prevent deleting last admin
        if (type === 'user') {
            const user = users.find(u => u.id === id);
            if (user && isUserAdmin(user)) {
                const adminCount = users.filter(u => isUserAdmin(u)).length;
                if (adminCount <= 1) {
                    toast({ title: "Action Denied", description: "Cannot delete the last administrator.", variant: "destructive" });
                    return;
                }
            }
        }
        // Validation: Prevent deleting system roles
        if (type === 'role') {
            const role = roles.find(r => r.id === id);
            if (role?.isSystem) {
                toast({ title: "Action Denied", description: "Cannot delete system roles.", variant: "destructive" });
                return;
            }
        }

        setDeleteConfirmId(id);
        setDeleteType(type);
    };

    const confirmDelete = () => {
        if (!deleteConfirmId) return;
        if (deleteType === 'user') {
            deleteUser(deleteConfirmId);
            toast({ title: "User Deleted", variant: "success" });
        } else if (deleteType === 'role') {
            deleteRole(deleteConfirmId);
            toast({ title: "Role Deleted", variant: "success" });
        }
        setDeleteConfirmId(null);
        setDeleteType(null);
    };

    const handleSaveUser = () => {
        if (!editingUser.username || !editingUser.email || !editingUser.roleId) {
            toast({ title: "Validation Error", description: "Username, Email, and Role are required.", variant: "destructive" });
            return;
        }

        // New User Password Validation
        if (!editingUser.id && !userPassword) {
            toast({ title: "Validation Error", description: "Password is required for new users.", variant: "destructive" });
            return;
        }

        // Prevent Demoting Last Admin
        if (editingUser.id) {
            const originalUser = users.find(u => u.id === editingUser.id);
            if (originalUser && isUserAdmin(originalUser)) {
                // Check if role is changing to non-admin
                const newRole = roles.find(r => r.id === editingUser.roleId);
                if (!newRole?.permissions.includes('sys_admin')) {
                    const adminCount = users.filter(u => isUserAdmin(u)).length;
                    if (adminCount <= 1) {
                        toast({ title: "Action Denied", description: "Cannot remove admin privileges from the last administrator.", variant: "destructive" });
                        return;
                    }
                }
            }
        }

        const userData = { ...editingUser } as User;
        // Only update password if provided
        if (userPassword) {
            userData.password = userPassword;
        }

        if (userData.id) {
            updateUser(userData);
            toast({ title: "User Updated", variant: "success" });
        } else {
            userData.id = genId();
            userData.createdAt = new Date().toISOString();
            addUser(userData);
            toast({ title: "User Created", variant: "success" });
        }
        setIsUserModalOpen(false);
    };

    const handleGenerateResetLink = () => {
        const link = `https://geonexus.app/reset-password?token=${genId()}`;
        navigator.clipboard.writeText(link);
        toast({ title: "Link Copied", description: "Password reset link copied to clipboard.", variant: "success" });
    };

    // --- Role Logic ---
    const handleAddRole = () => {
        setEditingRole({ id: '', name: '', description: '', permissions: [] });
        setIsRoleModalOpen(true);
    };

    const handleEditRole = (role: UserRole) => {
        setEditingRole({ ...role });
        setIsRoleModalOpen(true);
    };

    const handleSaveRole = () => {
        if (!editingRole.name) {
            toast({ title: "Error", description: "Role name is required.", variant: "destructive" });
            return;
        }
        const roleData = editingRole as UserRole;
        if (roleData.id) {
            updateRole(roleData);
            toast({ title: "Role Updated" });
        } else {
            roleData.id = genId();
            addRole(roleData);
            toast({ title: "Role Created" });
        }
        setIsRoleModalOpen(false);
    };

    const togglePermission = (perm: string) => {
        if (editingRole.isSystem && editingRole.id) return; // Prevent editing system roles perm
        const current = editingRole.permissions || [];
        const next = current.includes(perm as any) 
            ? current.filter(p => p !== perm)
            : [...current, perm];
        setEditingRole({ ...editingRole, permissions: next as any });
    };

    // Pagination Logic
    const userTotalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
    const paginatedUsers = users.slice((userPage - 1) * ITEMS_PER_PAGE, userPage * ITEMS_PER_PAGE);

    const roleTotalPages = Math.ceil(roles.length / ITEMS_PER_PAGE);
    const paginatedRoles = roles.slice((rolePage - 1) * ITEMS_PER_PAGE, rolePage * ITEMS_PER_PAGE);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium flex items-center gap-2"><Shield className="w-5 h-5" /> Users & Security</h3>
                <div className="flex bg-muted p-1 rounded-md">
                    <button
                        onClick={() => setActiveTab('users')}
                        className={cn("px-3 py-1.5 text-sm font-medium rounded-sm transition-all", activeTab === 'users' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        Users
                    </button>
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={cn("px-3 py-1.5 text-sm font-medium rounded-sm transition-all", activeTab === 'roles' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        Roles
                    </button>
                </div>
            </div>

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex justify-end">
                        <Button onClick={handleAddUser}><Plus className="w-4 h-4 mr-2" /> Add User</Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedUsers.map(user => {
                                        const role = roles.find(r => r.id === user.roleId);
                                        return (
                                            <TableRow key={user.id}>
                                                <TableCell className="font-medium flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                        {user.username.substring(0,2)}
                                                    </div>
                                                    {user.username}
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border">
                                                        {role?.name || 'Unknown'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUser(user)}>
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRequest(user.id, 'user')}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    {userTotalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.max(1, p-1))} disabled={userPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="text-sm flex items-center">{userPage} / {userTotalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setUserPage(p => Math.min(userTotalPages, p+1))} disabled={userPage === userTotalPages}><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    )}
                </div>
            )}

            {/* ROLES TAB */}
            {activeTab === 'roles' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-2">
                    <div className="flex justify-end">
                        <Button onClick={handleAddRole}><Plus className="w-4 h-4 mr-2" /> Add Role</Button>
                    </div>
                    <Card>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Role Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Permissions</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {paginatedRoles.map(role => (
                                        <TableRow key={role.id}>
                                            <TableCell className="font-medium">
                                                {role.name}
                                                {role.isSystem && <span className="ml-2 text-[10px] uppercase font-bold text-muted-foreground bg-muted px-1 rounded">System</span>}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{role.description}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                                                    {role.permissions.length} access rules
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    {role.isSystem ? (
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditRole(role)} title="View Details">
                                                            <Eye className="w-4 h-4 mr-1" /> View
                                                        </Button>
                                                    ) : (
                                                        <>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditRole(role)}>
                                                                <Edit className="w-4 h-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteRequest(role.id, 'role')}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                    {roleTotalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setRolePage(p => Math.max(1, p-1))} disabled={rolePage === 1}><ChevronLeft className="w-4 h-4" /></Button>
                            <span className="text-sm flex items-center">{rolePage} / {roleTotalPages}</span>
                            <Button variant="outline" size="sm" onClick={() => setRolePage(p => Math.min(roleTotalPages, p+1))} disabled={rolePage === roleTotalPages}><ChevronRight className="w-4 h-4" /></Button>
                        </div>
                    )}
                </div>
            )}

            {/* USER DIALOG */}
            <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUser.id ? 'Edit User' : 'New User'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input value={editingUser.username || ''} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input value={editingUser.email || ''} onChange={e => setEditingUser({ ...editingUser, email: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Combobox 
                                options={roles.map(r => ({ value: r.id, label: r.name }))}
                                value={editingUser.roleId}
                                onChange={val => setEditingUser({ ...editingUser, roleId: val })}
                            />
                        </div>
                        
                        <div className="border-t pt-4">
                            <div className="flex items-center justify-between mb-2">
                                <Label className="flex items-center gap-2"><Key className="w-4 h-4" /> Password Management</Label>
                                {editingUser.id && (
                                    <Switch checked={showPasswordFields} onCheckedChange={setShowPasswordFields} />
                                )}
                            </div>
                            
                            {showPasswordFields ? (
                                <div className="space-y-2 animate-in fade-in zoom-in-95">
                                    <Input 
                                        type="password" 
                                        placeholder={editingUser.id ? "New Password" : "Password"}
                                        value={userPassword} 
                                        onChange={e => setUserPassword(e.target.value)} 
                                    />
                                    {editingUser.id && (
                                        <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={handleGenerateResetLink}>
                                            <RefreshCw className="w-3 h-3 mr-2" /> Generate Reset Link
                                        </Button>
                                    )}
                                </div>
                            ) : (
                                editingUser.id && <p className="text-xs text-muted-foreground">Toggle switch to change password.</p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUserModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveUser}>Save User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ROLE DIALOG */}
            <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRole.isSystem ? 'Role Details (System)' : (editingRole.id ? 'Edit Role' : 'New Role')}</DialogTitle>
                        {editingRole.isSystem && <DialogDescription>System roles cannot be modified.</DialogDescription>}
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Role Name</Label>
                            <Input 
                                value={editingRole.name || ''} 
                                onChange={e => setEditingRole({ ...editingRole, name: e.target.value })} 
                                disabled={editingRole.isSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input 
                                value={editingRole.description || ''} 
                                onChange={e => setEditingRole({ ...editingRole, description: e.target.value })} 
                                disabled={editingRole.isSystem}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Permissions</Label>
                            <div className="border rounded-md divide-y max-h-60 overflow-y-auto">
                                {PERMISSIONS_LIST.map(perm => {
                                    const isChecked = editingRole.permissions?.includes(perm.value as any);
                                    return (
                                        <div key={perm.value} className="flex items-start gap-3 p-3 hover:bg-muted/50">
                                            <input 
                                                type="checkbox" 
                                                className="mt-1 rounded border-gray-300 text-primary focus:ring-primary"
                                                checked={isChecked}
                                                onChange={() => togglePermission(perm.value)}
                                                disabled={editingRole.isSystem}
                                            />
                                            <div>
                                                <div className="text-sm font-medium">{perm.label}</div>
                                                <div className="text-xs text-muted-foreground">{perm.description}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRoleModalOpen(false)}>Close</Button>
                        {!editingRole.isSystem && <Button onClick={handleSaveRole}>Save Role</Button>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRM DIALOG */}
            <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this {deleteType}? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
