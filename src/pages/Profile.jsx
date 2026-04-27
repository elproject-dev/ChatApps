// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { userOperations, uploadFile } from '@/api/supabaseHelpers';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { ArrowLeft, Camera, Pencil, Check, LogOut, Shield, Bell, Moon, CircleHelp, X, QrCode, ScanLine } from 'lucide-react';
import { Link } from 'react-router-dom';
import Avatar from '../components/chat/Avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Profile() {
  const { user: authUser, logout, refreshUser } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(() => authUser?.full_name || '');
  const [statusText, setStatusText] = useState(() => authUser?.status_text || 'Hey there! I am using ChatApps');
  const [phone, setPhone] = useState(() => authUser?.phone || '');
  const [showPhoto, setShowPhoto] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (authUser) {
      setName(authUser.full_name || '');
      setStatusText(authUser.status_text || 'Hey there! I am using ChatApps');
      setPhone(authUser.phone || '');
    }
  }, [authUser?.full_name, authUser?.status_text, authUser?.phone]);

  const handleSave = async () => {
    try {
      await userOperations.update(authUser.email, { full_name: name, status_text: statusText, phone });
    } catch (err) {
      // User record might not exist yet, create it
      await userOperations.create({ email: authUser.email, full_name: name, status_text: statusText, phone, role: 'user', is_online: true });
    }
    await refreshUser();
    toast.success('Profil berhasil diperbarui!');
    setIsEditing(false);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { file_url } = await uploadFile(file);
    try {
      await userOperations.update(authUser.email, { avatar_url: file_url });
    } catch (err) {
      await userOperations.create({ email: authUser.email, full_name: authUser.full_name || authUser.email, avatar_url: file_url, phone: '', role: 'user', is_online: true });
    }
    await refreshUser();
    toast.success('Foto profil berhasil diubah!');
  };

  if (!authUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const menuItems = [
    { icon: QrCode, label: 'QR Code Saya', desc: 'Tampilkan QR untuk ditambahkan', path: '/qr?mode=show' },
    { icon: ScanLine, label: 'Pindai QR', desc: 'Tambah kontak dari QR code', path: '/qr?mode=scan' },
    { icon: Bell, label: 'Notifikasi', desc: 'Suara & popup pesan', path: '/notifications' },
    { icon: Shield, label: 'Privasi', desc: 'Foto profil, status, terakhir dilihat', path: '/privacy' },
    { icon: Moon, label: 'Tema', desc: isDark ? 'Gelap' : 'Terang', path: '/theme' },
    { icon: CircleHelp, label: 'Bantuan', desc: 'FAQ, hubungi kami', path: '/help' },
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Profil</h1>
        </div>
      </div>

      <div className="bg-primary text-primary-foreground pb-6">
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <button onClick={() => authUser?.avatar_url && setShowPhoto(true)} className="relative">
              <Avatar
                name={authUser?.full_name || 'Pengguna'}
                src={authUser?.avatar_url}
                size="xl"
              />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-2 bg-primary rounded-full border-2 border-primary-foreground shadow-lg hover:bg-primary/80 transition-colors"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <h2 className="text-lg font-bold">{name || 'Pengguna'}</h2>
          <p className="text-sm text-primary-foreground/70">{authUser?.email}</p>
        </div>
      </div>

      {/* Edit Section */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">Info Pribadi</span>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="text-primary text-sm font-medium flex items-center gap-1"
            >
              {isEditing ? <><Check className="w-4 h-4" /> Simpan</> : <><Pencil className="w-4 h-4" /> Edit</>}
            </button>
          </div>
          
          <div className="px-4 py-3 space-y-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium">Nama</label>
              {isEditing ? (
                // @ts-ignore
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-foreground mt-0.5">{name || 'Belum diatur'}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              {isEditing ? (
                // @ts-ignore
                <Input
                  value={statusText}
                  onChange={(e) => setStatusText(e.target.value)}
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-foreground mt-0.5">{statusText}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">No. Telepon</label>
              {isEditing ? (
                // @ts-ignore
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+62..."
                  className="mt-1"
                />
              ) : (
                <p className="text-sm text-foreground mt-0.5">{phone || 'Belum diatur'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <div className="px-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {menuItems.map(({ icon: Icon, label, desc, onClick, path }, i) => (
            path ? (
              <Link
                key={label}
                to={path}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/60 transition-colors ${
                  i < menuItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="p-2 rounded-xl bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </Link>
            ) : (
              <button
                key={label}
                onClick={onClick}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/60 transition-colors ${
                  i < menuItems.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="p-2 rounded-xl bg-primary/10">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </button>
            )
          ))}
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-4">
        {/* @ts-ignore */}
        <Button
          variant="outline"
          className="w-full bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Keluar
        </Button>
      </div>

      {/* Photo viewer overlay */}
      {showPhoto && authUser?.avatar_url && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setShowPhoto(false)}>
          <div className="flex justify-end px-4 pt-12 pb-3">
            <button onClick={() => setShowPhoto(false)} className="p-2 rounded-full hover:bg-white/10">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-6" onClick={(e) => e.stopPropagation()}>
            <img src={authUser.avatar_url} alt={authUser.full_name} className="max-w-full max-h-[70vh] rounded-2xl object-contain" />
          </div>
          <div className="px-6 pb-8 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white text-lg font-bold">{authUser.full_name || 'Pengguna'}</h3>
          </div>
        </div>
      )}
    </div>
  );
}