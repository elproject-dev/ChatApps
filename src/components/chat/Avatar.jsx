import React from 'react';
import { User } from 'lucide-react';

export default function Avatar({ src = undefined, name, size = 'md', isOnline = false }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-11 h-11 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-24 h-24 text-2xl'
  };

  const dotSizes = {
    sm: 'w-2 h-2 border',
    md: 'w-3 h-3 border-2',
    lg: 'w-4 h-4 border-2',
    xl: 'w-5 h-5 border-2'
  };

  const initials = name
    ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const colors = [
    'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 
    'bg-orange-500', 'bg-pink-500', 'bg-teal-500', 'bg-indigo-500'
  ];

  const colorIndex = name ? name.charCodeAt(0) % colors.length : 0;

  return (
    <div className="relative flex-shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover`}
        />
      ) : (
        <div className={`${sizes[size]} ${colors[colorIndex]} rounded-full flex items-center justify-center text-white font-semibold`}>
          {initials}
        </div>
      )}
      {isOnline && (
        <div className={`absolute bottom-0 right-0 ${dotSizes[size]} bg-emerald-400 rounded-full border-card`} />
      )}
    </div>
  );
}