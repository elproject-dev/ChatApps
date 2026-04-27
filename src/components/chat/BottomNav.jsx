import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, Users, CircleUser } from 'lucide-react';

const navItems = [
  { path: '/', icon: MessageCircle, label: 'Chat' },
  { path: '/contacts', icon: Users, label: 'Kontak' },
  { path: '/profile', icon: CircleUser, label: 'Profil' },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-border z-50 safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(path);
          
          return (
            <Link
              key={path}
              to={path}
              className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl transition-all ${
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}