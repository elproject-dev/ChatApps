import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Smile } from 'lucide-react';
import { uploadFile } from '@/api/supabaseHelpers';
import EmojiPicker, { Theme } from 'emoji-picker-react';

export default function ChatInput({ onSend, disabled, onTyping }) {
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const pickerRef = useRef(null);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    checkDarkMode();
    
    // Optional: Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Close pickers when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);

  const onEmojiClick = (emojiData) => {
    setText((prev) => prev + emojiData.emoji);
  };

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
    <div className="sticky bottom-0 bg-card/95 backdrop-blur-xl border-t border-border px-3 py-2 z-40 safe-area-pb" ref={pickerRef}>
      {showEmojiPicker && (
        <div className="absolute bottom-20 left-0 right-0 flex justify-center z-50 animate-in slide-in-from-bottom-2 duration-200">
          <div className="shadow-2xl rounded-2xl overflow-hidden border border-border mx-6 w-full max-w-[320px]">
            <EmojiPicker
              onEmojiClick={onEmojiClick}
              width="100%"
              height={320}
              theme={isDarkMode ? Theme.DARK : Theme.LIGHT}
              searchDisabled
              skinTonesDisabled
              previewConfig={{ showPreview: false }}
            />
          </div>
        </div>
      )}
      <div className="flex items-end gap-2 w-full max-w-lg mx-auto overflow-hidden">
        <div className="flex-1 flex items-end bg-muted rounded-2xl px-2 py-1 gap-1 shadow-inner min-w-0">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className={`p-2 transition-colors flex-shrink-0 ${
              showEmojiPicker ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smile className="w-5 h-5" />
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
            className="flex-1 bg-transparent border-none outline-none resize-none text-[15px] py-2 max-h-32 placeholder:text-muted-foreground min-w-0 w-full"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
          >
            <Paperclip className="w-5 h-5" />
          </button>

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
          className="w-10 h-10 flex items-center justify-center bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg flex-shrink-0 mb-0.5"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}