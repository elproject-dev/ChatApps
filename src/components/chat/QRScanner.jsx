// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, UserPlus, Camera } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { contactOperations, userOperations } from '@/api/supabaseHelpers';
import { toast } from 'sonner';
import Avatar from './Avatar';

export default function QRScanner({ onClose, currentUserEmail }) {
  const [status, setStatus] = useState('preparing'); // preparing | scanning | success | error | no_permission
  const [scannedUser, setScannedUser] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const scannerRef = useRef(null);

  const startScan = async () => {
    if (!Capacitor.isNativePlatform()) {
      setStatus('scanning');
      const result = prompt('Masukkan email kontak atau data QR:');
      if (result) {
        processScanResult(result);
      } else {
        setStatus('error');
      }
      return;
    }

    try {
      const { BarcodeScanner } = await import('@capacitor-community/barcode-scanner');
      const permStatus = await BarcodeScanner.checkPermission({ force: true });
      if (!permStatus.granted) {
        setStatus('no_permission');
        return;
      }

      // Make body transparent so camera shows through the cutout area
      document.querySelector('body').classList.add('scanner-active');
      setStatus('scanning');

      const result = await BarcodeScanner.startScan();
      document.querySelector('body').classList.remove('scanner-active');

      if (result.hasContent) {
        processScanResult(result.content);
      } else {
        setStatus('error');
      }
    } catch (e) {
      document.querySelector('body')?.classList.remove('scanner-active');
      console.error('Scan failed:', e);
      setStatus('error');
    }
  };

  const processScanResult = async (content) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'chatapps-add-contact' && parsed.email) {
        if (parsed.email === currentUserEmail) {
          toast.error('Tidak bisa menambahkan diri sendiri');
          setStatus('error');
          return;
        }
        const userData = await userOperations.getById(parsed.email);
        setScannedUser(userData || { email: parsed.email, full_name: parsed.name || parsed.email });
        setStatus('success');
      } else {
        toast.error('QR code tidak valid');
        setStatus('error');
      }
    } catch {
      if (content.includes('@')) {
        const userData = await userOperations.getById(content);
        if (userData) {
          if (userData.email === currentUserEmail) {
            toast.error('Tidak bisa menambahkan diri sendiri');
            setStatus('error');
            return;
          }
          setScannedUser(userData);
          setStatus('success');
        } else {
          toast.error('Pengguna tidak ditemukan');
          setStatus('error');
        }
      } else {
        toast.error('QR code tidak valid');
        setStatus('error');
      }
    }
  };

  const handleAddContact = async () => {
    if (!scannedUser) return;
    setIsAdding(true);
    try {
      await contactOperations.add(currentUserEmail, scannedUser.email);
      toast.success(`${scannedUser.full_name || scannedUser.email} ditambahkan ke kontak!`);
      setTimeout(() => onClose(), 800);
    } catch (e) {
      toast.error('Gagal menambahkan kontak');
    }
    setIsAdding(false);
  };

  const handleRetry = () => {
    setScannedUser(null);
    setStatus('preparing');
    startScan();
  };

  const handleClose = () => {
    document.querySelector('body')?.classList.remove('scanner-active');
    onClose();
  };

  useEffect(() => {
    startScan();
    return () => {
      document.querySelector('body')?.classList.remove('scanner-active');
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      {/* Header - opaque */}
      <div className="flex items-center justify-between px-4 pt-12 pb-3 bg-black/90 relative z-10">
        <h2 className="text-white text-lg font-bold">Pindai QR Code</h2>
        <button onClick={handleClose} className="p-2 rounded-full hover:bg-white/10">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative">

        {status === 'preparing' && (
          <div className="flex flex-col items-center bg-black/90 rounded-3xl p-8">
            <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/70 text-sm">Menyiapkan kamera...</p>
          </div>
        )}

        {status === 'scanning' && (
          <div className="relative w-[280px] h-[320px] flex flex-col items-center">
            {/* Top dark block */}
            <div className="w-full bg-black/95 rounded-t-3xl" style={{ height: '20px' }} />
            {/* Middle row: left dark + scanner + right dark */}
            <div className="flex flex-1 w-full">
              <div className="bg-black/95" style={{ width: '20px' }} />
              {/* Scanner frame - transparent so camera shows through */}
              <div
                ref={scannerRef}
                className="relative flex-1 rounded-2xl"
                style={{ background: 'transparent' }}
              >
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />

                {/* Scanning line animation */}
                <div className="absolute left-3 right-3 h-0.5 bg-primary/80 rounded-full animate-scan-line" />
              </div>
              <div className="bg-black/95" style={{ width: '20px' }} />
            </div>
            {/* Bottom dark block with text */}
            <div className="w-full bg-black/95 rounded-b-3xl flex items-center justify-center" style={{ height: '60px' }}>
              <p className="text-white/70 text-sm text-center">
                Arahkan kamera ke QR code teman
              </p>
            </div>
          </div>
        )}

        {status === 'no_permission' && (
          <div className="flex flex-col items-center text-center bg-black/90 rounded-3xl p-8">
            <Camera className="w-14 h-14 text-white/30 mb-4" />
            <p className="text-white text-lg font-semibold mb-2">Akses Kamera Ditolak</p>
            <p className="text-white/60 text-sm mb-6">Izinkan akses kamera di pengaturan untuk memindai QR code</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {status === 'success' && scannedUser && (
          <div className="flex flex-col items-center text-center bg-black/90 rounded-3xl p-8">
            <CheckCircle className="w-14 h-14 text-green-400 mb-4" />
            <Avatar
              name={scannedUser.full_name || scannedUser.email}
              src={scannedUser.avatar_url}
              size="xl"
            />
            <h3 className="text-white text-xl font-bold mt-4">
              {scannedUser.full_name || scannedUser.email}
            </h3>
            <p className="text-white/60 text-sm mt-1">{scannedUser.email}</p>
            <button
              onClick={handleAddContact}
              disabled={isAdding}
              className="mt-6 flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-xl font-medium disabled:opacity-50"
            >
              <UserPlus className="w-5 h-5" />
              {isAdding ? 'Menambahkan...' : 'Tambah Kontak'}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center text-center bg-black/90 rounded-3xl p-8">
            <AlertCircle className="w-14 h-14 text-red-400 mb-4" />
            <p className="text-white text-lg font-semibold mb-2">Gagal Memindai</p>
            <p className="text-white/60 text-sm mb-6">QR code tidak valid atau kamera bermasalah</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium"
            >
              Pindai Ulang
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint - opaque */}
      <div className="px-6 pb-8 pt-4 text-center bg-black/90 relative z-10">
        <p className="text-white/30 text-xs">Minta teman menampilkan QR Code dari Profil mereka</p>
      </div>
    </div>
  );
}
