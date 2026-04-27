import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { format, isToday, isYesterday } from 'date-fns';
import { CheckCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { userOperations, conversationOperations } from '@/api/supabaseHelpers';
import { supabase } from '@/api/supabaseClient';
import Avatar from './Avatar';
import TypingIndicator from './TypingIndicator';
// @ts-ignore
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Kemarin';
  return format(date, 'dd/MM/yy');
}

export default function ChatListItem({ conversation, currentUser, onDelete }) {
  const otherEmail = conversation.participants?.find(p => p !== currentUser?.email);
  const unread = conversation.unread_count?.[currentUser?.email] || 0;
  const isLastMsgMine = conversation.last_message_sender === currentUser?.email;
  const isLastMsgRead = isLastMsgMine && conversation.unread_count?.[otherEmail] === 0;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pressTimer, setPressTimer] = useState(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  // Listen for typing indicator from other user
  useEffect(() => {
    const channel = supabase.channel(`chat:${conversation.id}`);
    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload?.email === otherEmail) {
          setIsTyping(true);
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setIsTyping(false), 3000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(typingTimeoutRef.current);
    };
  }, [conversation.id, otherEmail]);

  // Fetch other user data to get avatar and name
  const { data: otherUser } = useQuery({
    queryKey: ['user', otherEmail],
    queryFn: () => userOperations.getById(otherEmail),
    enabled: !!otherEmail && !conversation.is_group,
  });

  const handlePressStart = () => {
    const timer = setTimeout(() => {
      setShowDeleteDialog(true);
    }, 500);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

  const handleDelete = async () => {
    await conversationOperations.delete(conversation.id);
    setShowDeleteDialog(false);
    if (onDelete) onDelete();
  };

  // Use custom name from user data, fallback to conversation participant_names, then email
  const otherName = otherUser?.full_name || conversation.participant_names?.[otherEmail] || otherEmail || 'Unknown';

  return (
    <>
      <Link
        to={`/chat/${conversation.id}`}
        state={{ contact: otherUser }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60 active:bg-muted transition-colors cursor-pointer"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
      <Avatar name={otherName} size="md" src={conversation.is_group ? conversation.group_avatar : otherUser?.avatar_url} isOnline={!conversation.is_group && otherUser?.is_online} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground truncate">
            {conversation.is_group ? conversation.group_name : otherName}
          </h3>
          <span className={`text-[11px] flex-shrink-0 ${unread > 0 ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
            {formatTime(conversation.last_message_time || conversation.updated_at)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          {isTyping ? (
            <TypingIndicator size="sm" />
          ) : (
            <>
              {isLastMsgMine && conversation.last_message && (
                <CheckCheck className={`w-4 h-4 flex-shrink-0 ${isLastMsgRead ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
              <p className="text-xs text-muted-foreground truncate">
                {conversation.last_message || 'Mulai percakapan...'}
              </p>
            </>
          )}
          {unread > 0 && (
            <span className="ml-auto flex-shrink-0 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </Link>

      {/* @ts-ignore */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        {/* @ts-ignore */}
        <AlertDialogContent>
          {/* @ts-ignore */}
          <AlertDialogHeader>
            {/* @ts-ignore */}
            <AlertDialogTitle>Hapus Chat</AlertDialogTitle>
            {/* @ts-ignore */}
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus percakapan ini? Pesan tidak dapat dipulihkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {/* @ts-ignore */}
          <AlertDialogFooter>
            {/* @ts-ignore */}
            <AlertDialogCancel>Batal</AlertDialogCancel>
            {/* @ts-ignore */}
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}