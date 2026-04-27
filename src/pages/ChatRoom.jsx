// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationOperations, messageOperations, userOperations } from '@/api/supabaseHelpers';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { ArrowLeft, Phone, Video, MoreVertical, X, Download } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import MessageBubble from '../components/chat/MessageBubble';
import ChatInput from '../components/chat/ChatInput';
import Avatar from '../components/chat/Avatar';
import TypingIndicator from '../components/chat/TypingIndicator';
import CallScreen from '../components/call/CallScreen';
import { initiateCall } from '@/lib/webrtc';

import { Capacitor } from '@capacitor/core';

function formatLastSeen(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'baru saja';
  if (diffMins < 60) return `${diffMins} menit lalu`;
  if (isToday(date)) return `hari ini ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `kemarin ${format(date, 'HH:mm')}`;
  return format(date, 'dd/MM/yy HH:mm');
}

export default function ChatRoom() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const location = useLocation();
  const initialContact = location.state?.contact;
  const [otherOnline, setOtherOnline] = useState(initialContact?.is_online || false);
  const [otherLastSeen, setOtherLastSeen] = useState(initialContact?.last_seen || null);
  const [showProfile, setShowProfile] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const typingTimeoutRef = useRef(null);

  // Handle Android hardware back button - close preview if open
  useEffect(() => {
    const handleClosePreview = () => {
      if (previewImage) {
        setPreviewImage(null);
      } else if (showProfile) {
        setShowProfile(false);
      }
    };

    // Native: listen for custom event from App.jsx
    if (Capacitor.isNativePlatform()) {
      window.addEventListener('closeImagePreview', handleClosePreview);
    }

    // Web: intercept browser back button when preview is open
    if (previewImage) {
      // Push a state so back button triggers popstate instead of navigating away
      window.history.pushState(null, '');
      const onPopState = () => {
        setPreviewImage(null);
      };
      window.addEventListener('popstate', onPopState);
      return () => {
        window.removeEventListener('popstate', onPopState);
        if (Capacitor.isNativePlatform()) {
          window.removeEventListener('closeImagePreview', handleClosePreview);
        }
      };
    }

    return () => {
      if (Capacitor.isNativePlatform()) {
        window.removeEventListener('closeImagePreview', handleClosePreview);
      }
    };
  }, [previewImage, showProfile]);

  const { data: conversation } = useQuery({
    queryKey: ['conversation', id],
    queryFn: async () => {
      const convs = await conversationOperations.filter({ id });
      return convs[0];
    },
    enabled: !!id,
  });

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', id],
    queryFn: () => messageOperations.filter({ conversation_id: id }, 'created_at', 100),
    enabled: !!id,
    refetchInterval: 2000,
  });

  const otherEmail = conversation?.participants?.find(p => p !== currentUser?.email);

  // Fetch other user data to get avatar and name
  // Use initialContact as placeholder to avoid flash
  const { data: otherUser } = useQuery({
    queryKey: ['user', otherEmail],
    queryFn: () => userOperations.getById(otherEmail),
    enabled: !!otherEmail,
    placeholderData: initialContact,
  });

  // Use custom name from user data, fallback to conversation participant_names, then email
  const otherName = otherUser?.full_name || initialContact?.full_name || conversation?.participant_names?.[otherEmail] || otherEmail || 'Chat';

  // Mark messages as read when entering chat
  useEffect(() => {
    if (messages.length > 0 && currentUser) {
      const unreadMessages = messages.filter(
        msg => msg.sender_email !== currentUser.email && !msg.read_by?.includes(currentUser.email)
      );

      unreadMessages.forEach(async (msg) => {
        await messageOperations.update(msg.id, {
          read_by: [...(msg.read_by || []), currentUser.email]
        });
      });
    }
  }, [messages, currentUser, id]);

  // Listen for other user's online status via realtime
  useEffect(() => {
    if (!otherEmail) return;

    // Subscribe to users table changes for the other user
    const channel = supabase
      .channel(`user-status:${otherEmail}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `email=eq.${otherEmail}`,
        },
        (payload) => {
          setOtherOnline(payload.new.is_online);
          setOtherLastSeen(payload.new.last_seen);
        }
      )
      .subscribe();

    // Also fetch initial status
    userOperations.getById(otherEmail).then((data) => {
      if (data) {
        setOtherOnline(data.is_online);
        setOtherLastSeen(data.last_seen);
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [otherEmail]);

  // Realtime subscription for messages + typing indicator
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['messages', id] });
        }
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.email !== currentUser?.email) {
          setOtherTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setOtherTyping(false), 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [queryClient, id, currentUser]);

  // Broadcast typing status
  const broadcastTyping = () => {
    const channel = supabase.channel(`chat:${id}`);
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { email: currentUser?.email },
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (msgData) => {
    if (!currentUser) return;
    
    const messageData = {
      conversation_id: id,
      sender_email: currentUser.email,
      sender_name: currentUser.full_name || currentUser.email,
      ...msgData,
      read_by: [currentUser.email],
    };

    await messageOperations.create(messageData);

    await conversationOperations.update(id, {
      last_message: msgData.content || (msgData.message_type === 'image' ? '📷 Foto' : msgData.message_type === 'audio' ? '🎵 Audio' : msgData.message_type === 'video' ? '🎥 Video' : '📎 File'),
      last_message_time: new Date().toISOString(),
      last_message_sender: currentUser.email,
    });

    // Send push notification directly via edge function
    try {
      const { SUPABASE_URL } = await import('@/config');
      fetch(`${SUPABASE_URL}/functions/v1/push-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record: messageData }),
      }).catch(() => {});
    } catch (_) {}

    queryClient.invalidateQueries({ queryKey: ['messages', id] });
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  };

  const handleStartCall = async () => {
    if (!currentUser || !otherEmail || !id) return;
    try {
      const callData = await initiateCall(currentUser.email, otherEmail, id);
      setActiveCall(callData);

      // Send push notification for the call (so callee gets notified even in background)
      try {
        const { SUPABASE_URL } = await import('@/config');
        fetch(`${SUPABASE_URL}/functions/v1/push-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            record: {
              conversation_id: id,
              sender_email: currentUser.email,
              sender_name: currentUser.full_name || currentUser.email,
              msg_type: 'call',
              call_id: callData.id,
              callee_email: otherEmail,
            },
          }),
        }).catch(() => {});
      } catch (_) {}
    } catch (error) {
      console.error('Failed to start call:', error);
      alert('Gagal memulai panggilan: ' + error.message);
    }
  };

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  messages.forEach(msg => {
    const date = msg.created_at ? new Date(msg.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
    if (date !== lastDate) {
      groupedMessages.push({ type: 'date', date });
      lastDate = date;
    }
    groupedMessages.push({ type: 'message', data: msg });
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground shadow-md">
        <div className="flex items-center gap-3 px-2 pt-10 pb-3">
          <button onClick={() => setShowProfile(true)} className="relative flex-shrink-0">
            <Avatar name={otherName} size="sm" src={otherUser?.avatar_url || initialContact?.avatar_url} isOnline={otherOnline} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold truncate">{otherName}</h2>
            <p className="text-[11px] text-primary-foreground/70">
              {otherTyping ? 'sedang mengetik...' : otherOnline ? 'online' : (otherLastSeen ? `terakhir dilihat ${formatLastSeen(otherLastSeen)}` : 'offline')}
            </p>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleStartCall}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          groupedMessages.map((item, idx) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${idx}`} className="flex justify-center my-3">
                  <span className="text-[11px] text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {item.date}
                  </span>
                </div>
              );
            }
            return (
              <MessageBubble
                key={item.data.id}
                message={item.data}
                isMine={item.data.sender_email === currentUser?.email}
                currentUserEmail={currentUser?.email}
                onImageClick={(url) => setPreviewImage(url)}
              />
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator above input */}
      {otherTyping && (
        <div className="flex justify-end px-4 -mt-10 pb-1">
          <TypingIndicator size="md" />
        </div>
      )}

      {/* Input */}
      <ChatInput onSend={handleSend} disabled={false} onTyping={broadcastTyping} />

      {/* Profile overlay */}
      {showProfile && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={() => setShowProfile(false)}>
          <div className="flex justify-end px-4 pt-12 pb-3">
            <button onClick={() => setShowProfile(false)} className="p-2 rounded-full hover:bg-white/10">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8" onClick={(e) => e.stopPropagation()}>
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt={otherName} className="w-56 h-56 rounded-full object-cover mb-4" />
            ) : (
              <div className="w-56 h-56 rounded-full bg-primary flex items-center justify-center text-white text-5xl font-bold mb-4">
                {otherName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <h3 className="text-white text-2xl font-bold">{otherName}</h3>
            <p className="text-white/60 text-sm mt-1">
              {otherOnline ? '🟢 Online' : (otherLastSeen ? `Terakhir dilihat ${formatLastSeen(otherLastSeen)}` : '⚫ Offline')}
            </p>
          </div>

          <div className="px-6 pb-8 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="bg-card rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Email</p>
              <p className="text-foreground text-sm font-medium">{otherEmail}</p>
            </div>
            {otherUser?.phone && (
              <div className="bg-card rounded-lg p-3">
                <p className="text-muted-foreground text-xs">Telepon</p>
                <p className="text-foreground text-sm font-medium">{otherUser.phone}</p>
              </div>
            )}
            <div className="bg-card rounded-lg p-3">
              <p className="text-muted-foreground text-xs">Status</p>
              <p className="text-foreground text-sm font-medium">{otherUser?.status_text || 'Hey there! I am using ChatApps'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Image preview overlay */}
      {previewImage && (
        <div
          data-image-preview
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onClick={() => setPreviewImage(null)}
        >
          <div className="flex items-center justify-between px-4 pt-12 pb-3">
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  if (Capacitor.isNativePlatform()) {
                    const { registerPlugin } = await import('@capacitor/core');
                    const SaveToGallery = registerPlugin('SaveToGallery');
                    await SaveToGallery.saveImage({ url: previewImage, fileName: `chat_image_${Date.now()}.jpg` });
                    alert('Gambar berhasil disimpan ke galeri!');
                  } else {
                    const a = document.createElement('a');
                    a.href = previewImage;
                    a.download = `chat_image_${Date.now()}.jpg`;
                    a.target = '_blank';
                    a.click();
                  }
                } catch (e) {
                  console.error('Download failed:', e);
                  alert('Gagal menyimpan gambar');
                }
              }}
              className="p-2 rounded-full hover:bg-white/10"
            >
              <Download className="w-6 h-6 text-white" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }} className="p-2 rounded-full hover:bg-white/10">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="preview" className="max-w-full max-h-[80vh] rounded-xl object-contain" />
          </div>
        </div>
      )}

      {/* Active call overlay */}
      {activeCall && (
        <CallScreen
          callData={activeCall}
          currentUserEmail={currentUser?.email}
          onCallEnd={() => setActiveCall(null)}
        />
      )}
    </div>
  );
}
