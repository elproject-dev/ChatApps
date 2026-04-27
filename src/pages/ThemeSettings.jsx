// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Sun, Moon, Check, Palette, RotateCcw } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';

export default function ThemeSettings() {
  const { isDark, toggleTheme, customPrimary, setPrimaryHSL, resetPrimary } = useTheme();

  const [hue, setHue] = useState(customPrimary?.h ?? (isDark ? 152 : 180));
  const [sat, setSat] = useState(customPrimary?.s ?? (isDark ? 55 : 61));
  const [light, setLight] = useState(customPrimary?.l ?? (isDark ? 45 : 40));

  // Sync when customPrimary changes externally
  useEffect(() => {
    if (customPrimary) {
      setHue(customPrimary.h);
      setSat(customPrimary.s);
      setLight(customPrimary.l);
    }
  }, [customPrimary]);

  const applyCustom = () => {
    setPrimaryHSL(hue, sat, light);
  };

  const handleReset = () => {
    resetPrimary();
    setHue(isDark ? 152 : 180);
    setSat(isDark ? 55 : 61);
    setLight(isDark ? 45 : 40);
  };

  // Preview color
  const previewColor = `hsl(${hue}, ${sat}%, ${light}%)`;

  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Tema</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Theme Mode */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          {/* Light Theme */}
          <button
            onClick={() => { if (isDark) toggleTheme(); }}
            className={`w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/60 transition-colors border-b border-border ${
              !isDark ? 'bg-muted/30' : ''
            }`}
          >
            <div className="p-2 rounded-xl bg-white shadow-sm">
              <Sun className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Tema Terang</p>
              <p className="text-xs text-muted-foreground">Mode terang untuk penggunaan siang hari</p>
            </div>
            {!isDark && <Check className="w-5 h-5 text-primary" />}
          </button>

          {/* Dark Theme */}
          <button
            onClick={() => { if (!isDark) toggleTheme(); }}
            className={`w-full flex items-center gap-4 px-4 py-4 text-left hover:bg-muted/60 transition-colors ${
              isDark ? 'bg-muted/30' : ''
            }`}
          >
            <div className="p-2 rounded-xl bg-white shadow-sm">
              <Moon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Tema Gelap</p>
              <p className="text-xs text-muted-foreground">Mode gelap untuk kenyamanan mata</p>
            </div>
            {isDark && <Check className="w-5 h-5 text-primary" />}
          </button>
        </div>

        {/* Custom Primary Color HSL Editor */}
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Palette className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Warna Aksen</h2>
          </div>

          <div className="px-4 py-4 space-y-5">
            {/* Preview */}
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl shadow-md border border-border"
                style={{ backgroundColor: previewColor }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Preview</p>
                <p className="text-xs text-muted-foreground">HSL({hue}, {sat}%, {light}%)</p>
              </div>
              {customPrimary && (
                <button
                  onClick={handleReset}
                  className="p-2 rounded-full hover:bg-muted transition-colors"
                  title="Reset ke default"
                >
                  <RotateCcw className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Hue Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-muted-foreground font-medium">Hue</label>
                <span className="text-xs text-muted-foreground">{hue}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(0,${sat}%,${light}%), hsl(60,${sat}%,${light}%), hsl(120,${sat}%,${light}%), hsl(180,${sat}%,${light}%), hsl(240,${sat}%,${light}%), hsl(300,${sat}%,${light}%), hsl(360,${sat}%,${light}%))`,
                }}
              />
            </div>

            {/* Saturation Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-muted-foreground font-medium">Saturasi</label>
                <span className="text-xs text-muted-foreground">{sat}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sat}
                onChange={(e) => setSat(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(${hue},0%,${light}%), hsl(${hue},100%,${light}%))`,
                }}
              />
            </div>

            {/* Lightness Slider */}
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs text-muted-foreground font-medium">Kecerahan</label>
                <span className="text-xs text-muted-foreground">{light}%</span>
              </div>
              <input
                type="range"
                min="5"
                max="95"
                value={light}
                onChange={(e) => setLight(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, hsl(${hue},${sat}%,5%), hsl(${hue},${sat}%,50%), hsl(${hue},${sat}%,95%))`,
                }}
              />
            </div>

            {/* Apply Button */}
            <button
              onClick={applyCustom}
              className="w-full py-3 rounded-xl font-medium transition-opacity hover:opacity-90"
              style={{ backgroundColor: previewColor, color: light > 55 ? '#1a1a2e' : '#ffffff' }}
            >
              Terapkan Warna
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
