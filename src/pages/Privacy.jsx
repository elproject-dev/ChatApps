// @ts-nocheck
import React from 'react';

export default function Privacy() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Privasi</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-4">
            <p className="text-muted-foreground text-sm">
              Halaman privasi sedang dalam tahap pengembangan.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
