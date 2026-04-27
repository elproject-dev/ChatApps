// @ts-nocheck
import React from 'react';
import { Info, Code, Smartphone, MessageSquare, Bell } from 'lucide-react';

export default function Help() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Project Development</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* App Info Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Chat Apps v.1.0</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Versi Aplikasi</p>
                <p className="text-xs text-muted-foreground">v1.0.0 (Stable Release)</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Fitur Utama</p>
                <ul className="text-xs text-muted-foreground mt-1 space-y-1">
                  <li>• Pesan teks real-time</li>
                  <li>• Kirim gambar, audio, video, dan file</li>
                  <li>• Panggilan suara</li>
                  <li>• Notifikasi push dengan custom sound</li>
                  <li>• Status online/last seen</li>
                  <li>• Indikator typing</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Tech Stack Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Code className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Tech Stack</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Frontend</p>
              <p className="text-xs text-muted-foreground">React, Vite, TailwindCSS, Lucide Icons</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Backend</p>
              <p className="text-xs text-muted-foreground">Supabase (PostgreSQL, Realtime, Storage)</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Mobile</p>
              <p className="text-xs text-muted-foreground">Capacitor (Android), Firebase Cloud Messaging</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Voice/Video</p>
              <p className="text-xs text-muted-foreground">WebRTC (Simple-Peer)</p>
            </div>
          </div>
        </div>

        {/* Development Info Card */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-primary/5">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Informasi Pengembangan</h2>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Tanggal Rilis</p>
              <p className="text-xs text-muted-foreground">26 April 2026</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">Developer</p>
              <p className="text-xs text-muted-foreground">EL PROJECT DEVELOPMENT</p>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground mb-1">License</p>
              <p className="text-xs text-muted-foreground">Semua Hak Dilindungi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
