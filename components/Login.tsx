import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Map, Lock, User, Globe, Layers, Eye, EyeOff, ChevronDown, Zap } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { cn } from '../lib/utils';
import { useAppStore } from '../store';
import { LANGUAGES } from '../constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface LoginProps {
  onLogin: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t, lang } = useTranslation();
  const { updatePreferences, users, setCurrentUser } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: { username?: string; password?: string } = {};
    const requiredText = t('schema.required') || 'Required';

    if (!username.trim()) {
      newErrors.username = `${t('login.username')} - ${requiredText}`;
    }
    if (!password.trim()) {
      newErrors.password = `${t('login.password')} - ${requiredText}`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      // Find user by username or email and match password
      const user = users.find(u => 
        (u.username === username || u.email === username) && 
        u.password === password
      );

      if (user) {
        setCurrentUser(user);
        onLogin();
      } else {
        setErrors({ general: t('login.error') });
        setIsLoading(false);
      }
    }, 600);
  };

  const handleDemoLogin = () => {
    setUsername('admin');
    setPassword('admin');
    setErrors({});
    setIsLoading(true);
    setTimeout(() => {
       const admin = users.find(u => u.username === 'admin');
       if (admin) {
           setCurrentUser(admin);
           onLogin();
       } else {
           // Fallback if admin user was deleted/modified
           setErrors({ general: "Demo user not found." });
           setIsLoading(false);
       }
    }, 800);
  };

  const clearError = (field: 'username' | 'password') => {
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <div className="flex min-h-screen w-full relative overflow-hidden bg-slate-950">
      {/* Background Effects */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_100%_200px,#3b82f640,transparent)]" />
        <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_800px_at_0%_300px,#8b5cf640,transparent)]" />
      </div>

      {/* Language Selector */}
      <div className="absolute top-6 right-6 z-50 animate-in fade-in slide-in-from-top-4 duration-700">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-slate-400 hover:text-white hover:bg-white/5 gap-2 border border-transparent hover:border-white/10 transition-all rounded-full px-4">
                <Globe className="w-4 h-4" />
                <span className="uppercase text-xs font-semibold tracking-wider">{lang}</span>
                <ChevronDown className="w-3 h-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-slate-900/90 border-slate-700 text-slate-200 backdrop-blur-md">
              {LANGUAGES.map((l) => (
                <DropdownMenuItem 
                  key={l.value} 
                  onClick={() => updatePreferences({ language: l.value })}
                  className="hover:bg-slate-800 cursor-pointer focus:bg-slate-800 focus:text-white"
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
       </div>

      {/* Main Container */}
      <div className="relative z-10 w-full flex flex-col lg:flex-row h-screen">
        
        {/* Left Side: Hero / Brand Info (Hidden on mobile) */}
        <div className="hidden lg:flex flex-1 flex-col justify-center px-20 text-white">
          <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 shadow-2xl shadow-blue-900/50 animate-in fade-in slide-in-from-left-4 duration-700">
             <Globe className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-100 to-blue-400 animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
            {t('login.title')}
          </h1>
          <p className="text-xl text-slate-300 max-w-lg leading-relaxed mb-8 animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
            {t('login.subtitle')}
          </p>
          <div className="grid grid-cols-2 gap-4 max-w-md animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
             <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                <Layers className="w-6 h-6 text-blue-400 group-hover:scale-110 transition-transform" />
                <div className="text-sm">
                   <div className="font-semibold text-slate-100">Layer Management</div>
                   <div className="text-slate-400 text-xs">Advanced GIS layers</div>
                </div>
             </div>
             <div className="flex items-center gap-3 bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 hover:bg-white/10 transition-colors group cursor-default">
                <Map className="w-6 h-6 text-violet-400 group-hover:scale-110 transition-transform" />
                <div className="text-sm">
                   <div className="font-semibold text-slate-100">Spatial Analysis</div>
                   <div className="text-slate-400 text-xs">Real-time insights</div>
                </div>
             </div>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="flex-1 flex items-center justify-center p-6 bg-slate-900/50 lg:bg-transparent backdrop-blur-sm lg:backdrop-blur-none">
          <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in-95 duration-500">
            <div className="lg:hidden flex flex-col items-center text-center space-y-2 mb-8">
               <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                 <Globe className="text-white w-6 h-6" />
               </div>
               <h2 className="text-2xl font-bold text-white">{t('login.title')}</h2>
            </div>

            <Card className="border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl ring-1 ring-white/10">
              <CardHeader className="space-y-1 pb-6">
                <CardTitle className="text-2xl font-bold text-center text-white">{t('login.welcome')}</CardTitle>
                <CardDescription className="text-center text-slate-400">
                  {t('login.instruction')}
                </CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username" className={cn("text-slate-200", errors.username && "text-red-400")}>{t('login.username')}</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className={cn("h-5 w-5 transition-colors", errors.username ? "text-red-400" : "text-slate-500 group-focus-within:text-blue-500")} />
                      </div>
                      <Input 
                        id="username" 
                        type="text" 
                        placeholder="Enter your username" 
                        value={username}
                        onChange={(e) => { setUsername(e.target.value); clearError('username'); }}
                        className={cn(
                          "pl-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 transition-all", 
                          errors.username && "border-red-500 focus-visible:ring-red-500"
                        )}
                        autoComplete="off"
                      />
                    </div>
                    {errors.username && (
                      <p className="text-xs text-red-400 font-medium animate-in slide-in-from-top-1">{errors.username}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className={cn("text-slate-200", errors.password && "text-red-400")}>{t('login.password')}</Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className={cn("h-5 w-5 transition-colors", errors.password ? "text-red-400" : "text-slate-500 group-focus-within:text-blue-500")} />
                      </div>
                      <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••" 
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                        className={cn(
                          "pl-10 pr-10 bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 focus:border-blue-500 transition-all", 
                          errors.password && "border-red-500 focus-visible:ring-red-500"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-xs text-red-400 font-medium animate-in slide-in-from-top-1">{errors.password}</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        id="remember" 
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-900"
                      />
                      <label htmlFor="remember" className="text-sm font-medium leading-none text-slate-400 cursor-pointer select-none">Remember me</label>
                    </div>
                    <button type="button" className="text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                  
                  {errors.general && (
                    <div className="bg-red-500/10 p-3 rounded-md flex items-center gap-2 text-sm text-red-400 animate-in fade-in slide-in-from-top-1 border border-red-500/20">
                      <span className="font-medium">Error:</span> {errors.general}
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-md p-3 text-xs text-blue-300 text-center mt-4 space-y-3">
                    <div>
                        Demo Credentials: <span className="font-mono font-bold text-blue-200">admin</span> / <span className="font-mono font-bold text-blue-200">admin</span>
                    </div>
                    <Button 
                        type="button" 
                        variant="outline" 
                        size="sm" 
                        onClick={handleDemoLogin} 
                        className="w-full h-8 text-xs border-blue-500/30 hover:bg-blue-500/20 hover:text-blue-200 bg-blue-500/5 text-blue-300 transition-colors"
                        disabled={isLoading}
                    >
                        <Zap className="w-3 h-3 mr-2" />
                        Auto Login (Demo Mode)
                    </Button>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 pb-6">
                  <Button className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white border-0 shadow-lg shadow-blue-900/20 h-11 font-medium transition-all hover:scale-[1.01]" disabled={isLoading}>
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>{t('login.authenticating')}</span>
                      </div>
                    ) : t('login.btn')}
                  </Button>
                </CardFooter>
              </form>
            </Card>
            
            <p className="text-center text-xs text-slate-500">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};