import React, { useState, useRef } from 'react';
import { Send, Paperclip } from 'lucide-react';
import { uploadFile } from '@/api/supabaseHelpers';

export default function ChatInput({ onSend, disabled, onTyping }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;
    setIsSending(true);
    await onSend({ content: trimmed, message_type: 'text' });
    setText('');
    setIsSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSending(true);
    try {
      const { file_url } = await uploadFile(file, 'chat-media');
      const isImage = file.type.startsWith('image/');
      const isAudio = file.type.startsWith('audio/');
      const isVideo = file.type.startsWith('video/');
      await onSend({
        content: isImage ? '' : file.name,
        message_type: isImage ? 'image' : isAudio ? 'audio' : isVideo ? 'video' : 'file',
        file_url,
      });
    } finally {
      setIsSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border px-3 py-2 z-40">
      <div className="flex items-end gap-2 max-w-lg mx-auto">
        <div className="flex-1 flex items-end bg-muted rounded-2xl px-3 py-1.5 gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mb-0.5"
          >
            <Paperclip className="w-5 h-5" />
          </button>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (onTyping) {
                onTyping();
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pesan..."
            rows={1}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm py-1.5 max-h-24 placeholder:text-muted-foreground"
            style={{ minHeight: '24px' }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          className="p-2.5 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-lg shadow-primary/25"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}