import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import BottomNav from './chat/BottomNav';

export default function Layout() {
  const location = useLocation();
  const isChatRoom = location.pathname.startsWith('/chat/');

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <Outlet />
      {!isChatRoom && <BottomNav />}
    </div>
  );
}