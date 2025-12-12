import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Clapperboard, Sparkles, ArrowRight, Loader2, Mail, Lock, AlertCircle } from 'lucide-react';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getRedirectUrl = () => {
    // Pega a URL atual (seja localhost ou vercel)
    let url = window.location.origin;
    // Remove barra no final se existir para evitar duplicidade na verificação do Supabase
    return url.endsWith('/') ? url.slice(0, -1) : url;
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      
      const redirectUrl = getRedirectUrl();
      console.log('Tentando login Google. Redirecionar para:', redirectUrl);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Erro Google Auth:', error);
      setErrorMsg(error.message || 'Erro ao tentar fazer login com Google.');
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const redirectUrl = getRedirectUrl();

    try {
      if (isSignUp) {
        // Cadastro
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
          }
        });
        if (error) throw error;
        alert('Cadastro realizado! Verifique seu e-mail para confirmar a conta (se a confirmação estiver ativada) ou faça login.');
        setIsSignUp(false); // Volta para login após cadastro
      } else {
        // Login
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Erro na autenticação por e-mail.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0f172a] relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/20 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl p-8 md:p-10">
          
          {/* Logo Section */}
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-br from-brand-500 to-brand-600 p-3 rounded-2xl shadow-lg shadow-brand-500/30">
              <Clapperboard className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Header Text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {isSignUp ? 'Criar nova conta' : 'Bem-vindo de volta'}
            </h1>
            <p className="text-gray-400 text-sm">
              {isSignUp 
                ? 'Preencha os dados abaixo para começar' 
                : 'Gerencie seus vídeos com inteligência'}
            </p>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Google Login Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-50 text-gray-900 font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed mb-6"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-gray-600" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continuar com Google</span>
              </>
            )}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#0f172a] text-gray-400 bg-opacity-50 backdrop-blur-sm">
                ou use seu e-mail
              </span>
            </div>
          </div>

          {/* Email Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 ml-1">E-mail</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl leading-5 bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="seu@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-300 ml-1">Senha</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-white/10 rounded-xl leading-5 bg-white/5 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all sm:text-sm"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-brand-600/20 disabled:opacity-70 disabled:cursor-not-allowed mt-6"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Criar Conta' : 'Entrar'}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Toggle Sign Up / Sign In */}
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setErrorMsg(null);
              }}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isSignUp ? (
                <>Já tem uma conta? <span className="text-brand-400 font-medium">Faça login</span></>
              ) : (
                <>Não tem conta? <span className="text-brand-400 font-medium">Cadastre-se gratuitamente</span></>
              )}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-gray-500">
            <Sparkles className="w-3 h-3 text-brand-500" />
            <span>Ambiente Seguro & Criptografado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
