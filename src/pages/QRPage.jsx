// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { contactOperations, userOperations } from '@/api/supabaseHelpers';
import { QRCodeSVG } from 'qrcode.react';
import { Capacitor } from '@capacitor/core';
import { X, ScanLine, CheckCircle, AlertCircle, UserPlus, Camera } from 'lucide-react';
import Avatar from '../components/chat/Avatar';
import { toast } from 'sonner';

export default function QRPage() {
  const { user: authUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const mode = searchParams.get('mode') || 'show'; // show | scan
  const [status, setStatus] = useState('preparing'); // preparing | scanning | success | error | no_permission
  const [scannedUser, setScannedUser] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const scannerRef = useRef(null);

  const qrData = JSON.stringify({ type: 'chatapps-add-contact', email: authUser?.email, name: authUser?.full_name || '' });

  // --- Scan logic ---
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

      document.querySelector('body').classList.add('scanner-active');
      setStatus('scanning');

      const result = await BarcodeScanner.startScan();
      document.querySelector('body').classList.remove('scanner-active');

      if (result.hasContent) {
        await BarcodeScanner.stopScan();
        processScanResult(result.content);
      } else {
        await BarcodeScanner.stopScan();
        setStatus('error');
      }
    } catch (e) {
      document.querySelector('body')?.classList.remove('scanner-active');
      try { await (await import('@capacitor-community/barcode-scanner')).BarcodeScanner.stopScan(); } catch {}
      console.error('Scan failed:', e);
      setStatus('error');
    }
  };

  const processScanResult = async (content) => {
    try {
      const parsed = JSON.parse(content);
      if (parsed.type === 'chatapps-add-contact' && parsed.email) {
        if (parsed.email === authUser?.email) {
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
          if (userData.email === authUser?.email) {
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
      await contactOperations.add(authUser.email, scannedUser.email);
      toast.success(`${scannedUser.full_name || scannedUser.email} ditambahkan ke kontak!`);
      setTimeout(() => navigate('/profile'), 800);
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

  useEffect(() => {
    if (mode === 'scan') {
      startScan();
    }

    // Handle Android hardware back button
    let backHandler = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/app').then(({ App }) => {
        backHandler = App.addListener('backButton', () => {
          navigate('/profile');
        });
      }).catch(() => {});
    }

    return () => {
      document.querySelector('body')?.classList.remove('scanner-active');
      // Stop camera when leaving page
      if (Capacitor.isNativePlatform()) {
        import('@capacitor-community/barcode-scanner').then(({ BarcodeScanner }) => {
          BarcodeScanner.stopScan();
        }).catch(() => {});
      }
      // Remove back button listener
      if (backHandler) backHandler.then(h => h.remove()).catch(() => {});
    };
  }, [mode]);

  // --- Show QR mode ---
  if (mode === 'show') {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <h2 className="text-white text-lg font-bold">QR Code Saya</h2>
          <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-white/10">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="bg-white p-6 rounded-3xl shadow-2xl mb-6">
            <QRCodeSVG value={qrData} size={220} level="M" />
          </div>
          <h3 className="text-white text-xl font-bold">{authUser?.full_name || 'Pengguna'}</h3>
          <p className="text-white/60 text-sm mt-1">{authUser?.email}</p>
          <p className="text-white/40 text-xs mt-4">Minta teman untuk memindai QR code ini</p>
        </div>

        {/* Switch to scan */}
        <div className="px-6 pb-8">
          <button
            onClick={() => setSearchParams({ mode: 'scan' })}
            className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20 transition-colors"
          >
            <ScanLine className="w-5 h-5" />
            Pindai QR Teman
          </button>
        </div>
      </div>
    );
  }

  // --- Scan mode ---
  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'transparent' }}>
      {/* Header - solid black */}
      <div className="bg-black flex items-center justify-between px-4 pt-12 pb-3 shrink-0">
        <h2 className="text-white text-lg font-bold">Pindai QR Code</h2>
        <button onClick={() => navigate('/profile')} className="p-2 rounded-full hover:bg-white/10">
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Scanner Area - same container for SVG overlay and scanner frame */}
      <div className="flex-1 relative">

        {status === 'preparing' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
            <div className="w-12 h-12 border-2 border-white border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-white/70 text-sm">Menyiapkan kamera...</p>
          </div>
        )}

        {status === 'scanning' && (
          <>
            {/* Semi-transparent overlay with cutout - same container as scanner */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
              <defs>
                <mask id="scan-cutout">
                  <rect width="100%" height="100%" fill="white" />
                  <rect x="50%" y="50%" width="240" height="240" transform="translate(-120,-120)" fill="black" />
                </mask>
              </defs>
              <rect width="100%" height="100%" fill="rgba(0,0,0,0.6)" mask="url(#scan-cutout)" />
            </svg>

            {/* Scanner frame - same centering as SVG cutout */}
            <div
              ref={scannerRef}
              className="absolute w-[240px] h-[240px]"
              style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 2 }}
            >
              {/* Corner markers - L shape */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white" />

              {/* Scanning line animation */}
              <div className="absolute left-3 right-3 h-0.5 bg-primary/80 rounded-full animate-scan-line" />
            </div>

          </>
        )}

        {status === 'no_permission' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center text-center bg-black/80 rounded-3xl p-8">
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
          </div>
        )}

        {status === 'success' && scannedUser && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center text-center bg-black/80 rounded-3xl p-8">
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
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="flex flex-col items-center text-center bg-black/80 rounded-3xl p-8">
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
          </div>
        )}
      </div>

      {/* Bottom hint - solid black */}
      <div className="bg-black px-6 pb-8 pt-4 text-center shrink-0">
        <p className="text-white/50 text-sm">Minta teman menampilkan QR Code dari Profil mereka</p>
      </div>
    </div>
  );
}
