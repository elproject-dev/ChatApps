// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      let result;
      if (isSignup) {
        result = await signup(email, password, fullName);
      } else {
        result = await login(email, password);
      }

      if (result.success) {
        toast.success(isSignup ? `Selamat datang, ${fullName}!` : 'Login berhasil!');
        navigate('/');
      } else {
        toast.error(result.error || 'Terjadi kesalahan');
      }
    } catch (error) {
      toast.error(error.message || 'Terjadi kesalahan');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8">
          <h1 className="text-2xl font-bold text-center mb-2">
            {isSignup ? 'Daftar Akun' : 'Masuk'}
          </h1>
          <p className="text-muted-foreground text-center mb-6">
            {isSignup ? 'Buat akun baru untuk mulai chatting' : 'Masuk ke akun Anda'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignup && (
              <div>
                <label className="text-sm font-medium text-foreground">Nama Lengkap</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  className="mt-1"
                />
              </div>
            )}
            
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="email@contoh.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Memproses...' : (isSignup ? 'Daftar' : 'Masuk')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsSignup(!isSignup)}
              className="text-sm text-primary hover:underline"
            >
              {isSignup ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
