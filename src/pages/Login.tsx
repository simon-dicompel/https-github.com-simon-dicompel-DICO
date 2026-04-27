import React, { useState } from 'react';
import { authService } from '../services/api';
import { User } from '../types';
import { Button } from '../components/Button';
import { Package, Lock, Mail } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  navigate: (page: string) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin, navigate }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await authService.login(email.trim(), password);
      if (user) {
        onLogin(user);
        navigate('dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erro de conexão. Tente novamente.');
      if (err.message.includes('inválidos')) {
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  };

  const darkInputClasses = "block w-full pl-10 bg-slate-800 border border-slate-700 rounded-lg py-3 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all shadow-sm";

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-10 border border-slate-100">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-slate-900 text-white shadow-xl mb-6">
            <Package className="h-8 w-8" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Login</h2>
          <p className="mt-2 text-sm text-slate-500 font-medium uppercase tracking-widest">Equipe Dicompel</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 text-red-600 text-[10px] p-3 rounded-xl border border-red-100 text-center font-black uppercase tracking-widest">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">E-mail Corporativo</label>
            <div className="relative">
              <Mail className="absolute inset-y-0 left-3 h-5 w-5 text-slate-500 my-auto" />
              <input type="email" required className={darkInputClasses} placeholder="seu.email@dicompel.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">Senha de Acesso</label>
            <div className="relative">
              <Lock className="absolute inset-y-0 left-3 h-5 w-5 text-slate-500 my-auto" />
              <input type="password" required className={darkInputClasses} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <Button type="submit" className="w-full h-14 text-sm font-bold uppercase tracking-widest shadow-lg" disabled={loading}>
            {loading ? 'Validando...' : 'Entrar no Painel'}
          </Button>

          <div className="text-center mt-6">
             <button type="button" onClick={() => navigate('catalog')} className="text-[10px] text-slate-400 font-black uppercase tracking-widest transition-colors hover:text-blue-600">
               ← Catálogo Público
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
