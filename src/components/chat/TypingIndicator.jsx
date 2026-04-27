import React from 'react';

export default function TypingIndicator({ size = 'sm' }) {
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const gap = size === 'sm' ? 'gap-[3px]' : 'gap-1';
  const py = size === 'sm' ? 'py-1.5' : 'py-2';
  const px = size === 'sm' ? 'px-2.5' : 'px-3';

  return (
    <div className={`inline-flex items-center ${px} ${py} bg-muted rounded-full ${gap}`}>
      <span className={`${dotSize} bg-foreground/40 rounded-full animate-[typing_1.4s_infinite_ease-in-out]`} />
      <span className={`${dotSize} bg-foreground/40 rounded-full animate-[typing_1.4s_infinite_ease-in-out_0.2s]`} />
      <span className={`${dotSize} bg-foreground/40 rounded-full animate-[typing_1.4s_infinite_ease-in-out_0.4s]`} />
    </div>
  );
}
