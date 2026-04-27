// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationOperations } from '@/api/supabaseHelpers';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { Link } from 'react-router-dom';
import { MoreVertical, MessageSquarePlus } from 'lucide-react';
import ChatListItem from '../components/chat/ChatListItem';
import SearchBar from '../components/chat/SearchBar';
import EmptyState from '../components/chat/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ChatList() {
  const [search, setSearch] = useState('');
  const { user: currentUser, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationOperations.list('-updated_at', 50),
    retry: false,
    onError: (error) => {
      console.warn('Could not load conversations:', error.message);
    },
  });

  // Realtime subscription for conversations and message read status
  useEffect(() => {
    const channel = supabase
      .channel('conversations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          // Invalidate specific user query so ChatListItem refreshes is_online
          queryClient.invalidateQueries({ queryKey: ['user', payload.new.email] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filter conversations where current user is a participant
  const myConversations = conversations.filter(c =>
    c.participants?.includes(currentUser?.email)
  );

  const filtered = myConversations.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    const otherEmail = c.participants?.find(p => p !== currentUser?.email);
    const otherName = c.participant_names?.[otherEmail] || '';
    return otherName.toLowerCase().includes(q) || otherEmail?.toLowerCase().includes(q) ||
      (c.group_name || '').toLowerCase().includes(q);
  });

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">ChatApps</h1>
          <div className="flex items-center gap-1">
            <Link
              to="/contacts"
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <MessageSquarePlus className="w-5 h-5" />
            </Link>
            {/* @ts-ignore */}
            <DropdownMenu>
              {/* @ts-ignore */}
              <DropdownMenuTrigger asChild>
                <button className="p-2 rounded-full hover:bg-white/10 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
              </DropdownMenuTrigger>
              {/* @ts-ignore */}
              <DropdownMenuContent align="end">
                {/* @ts-ignore */}
                <DropdownMenuItem asChild>
                  <Link to="/profile">Profil Saya</Link>
                </DropdownMenuItem>
                {/* @ts-ignore */}
                <DropdownMenuItem
                  onClick={() => base44.auth.logout()}
                  className="text-destructive"
                >
                  Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Cari percakapan..." />

      {/* Conversation List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'Tidak ditemukan' : 'Belum ada percakapan'}
          description={search ? 'Coba kata kunci lain' : 'Mulai chat baru dengan menekan tombol + di atas'}
        />
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map(conv => {
            return (
              <ChatListItem
                key={conv.id}
                conversation={conv}
                currentUser={currentUser}
                onDelete={refetch}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}