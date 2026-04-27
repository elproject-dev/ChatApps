// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Bell, Volume2, VolumeX, Check, Vibrate, Music } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { toast } from 'sonner';

const PREF_SOUND_ENABLED = 'notif_sound_enabled';
const PREF_VIBRATION_ENABLED = 'notif_vibration_enabled';
const PREF_SELECTED_SOUND = 'notif_selected_sound';

export default function NotificationSettings() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [selectedSound, setSelectedSound] = useState('notif');
  const [loaded, setLoaded] = useState(false);

  const sounds = [
    { id: 'notif', name: 'Default', description: 'Nada notifikasi default', icon: Music },
    { id: 'chime', name: 'Chime', description: 'Nada lonceng lembut', icon: Music },
    { id: 'alert', name: 'Alert', description: 'Nada peringatan', icon: Music },
    { id: 'silent', name: 'Silent', description: 'Tanpa suara', icon: VolumeX },
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { value: soundVal } = await Preferences.get({ key: PREF_SOUND_ENABLED });
      const { value: vibVal } = await Preferences.get({ key: PREF_VIBRATION_ENABLED });
      const { value: selectedVal } = await Preferences.get({ key: PREF_SELECTED_SOUND });

      if (soundVal !== null) setSoundEnabled(soundVal === 'true');
      if (vibVal !== null) setVibrationEnabled(vibVal === 'true');
      if (selectedVal !== null) setSelectedSound(selectedVal);
    } catch (e) {
      console.error('Failed to load notification settings:', e);
    }
    setLoaded(true);
  };

  const handleToggleSound = async () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    try {
      await Preferences.set({ key: PREF_SOUND_ENABLED, value: String(newVal) });
      toast.success(newVal ? 'Suara notifikasi diaktifkan' : 'Suara notifikasi dimatikan');
    } catch (e) {
      console.error('Failed to save sound setting:', e);
    }
  };

  const handleToggleVibration = async () => {
    const newVal = !vibrationEnabled;
    setVibrationEnabled(newVal);
    try {
      await Preferences.set({ key: PREF_VIBRATION_ENABLED, value: String(newVal) });
      toast.success(newVal ? 'Getaran notifikasi diaktifkan' : 'Getaran notifikasi dimatikan');
    } catch (e) {
      console.error('Failed to save vibration setting:', e);
    }
  };

  const handleSelectSound = async (soundId) => {
    setSelectedSound(soundId);
    try {
      await Preferences.set({ key: PREF_SELECTED_SOUND, value: soundId });
      toast.success('Nada notifikasi diubah');
    } catch (e) {
      console.error('Failed to save sound selection:', e);
    }
  };

  if (!loaded) return null;

  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Notifikasi</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Sound Toggle */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                {soundEnabled ? <Volume2 className="w-5 h-5 text-primary" /> : <VolumeX className="w-5 h-5 text-primary" />}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Suara Notifikasi</p>
                <p className="text-xs text-muted-foreground">Aktifkan suara pesan masuk</p>
              </div>
            </div>
            <button
              onClick={handleToggleSound}
              className={`w-12 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${soundEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Vibration Toggle */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Vibrate className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Getaran</p>
                <p className="text-xs text-muted-foreground">Getar saat pesan masuk</p>
              </div>
            </div>
            <button
              onClick={handleToggleVibration}
              className={`w-12 h-6 rounded-full transition-colors ${vibrationEnabled ? 'bg-primary' : 'bg-muted'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${vibrationEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </div>

        {/* Sound Selection */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold text-foreground">Pilih Nada Notifikasi</p>
          </div>
          {sounds.map((sound, index) => (
            <button
              key={sound.id}
              onClick={() => handleSelectSound(sound.id)}
              className={`w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-muted/60 transition-colors ${
                index < sounds.length - 1 ? 'border-b border-border' : ''
              }`}
            >
              <div className="p-2 rounded-xl bg-primary/10">
                <sound.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{sound.name}</p>
                <p className="text-xs text-muted-foreground">{sound.description}</p>
              </div>
              {selectedSound === sound.id && <Check className="w-5 h-5 text-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
