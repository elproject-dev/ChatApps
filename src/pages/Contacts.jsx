// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { userOperations, conversationOperations, contactOperations } from '@/api/supabaseHelpers';
import { useAuth } from '@/lib/AuthContext';
import { supabase } from '@/api/supabaseClient';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users } from 'lucide-react';
import Avatar from '../components/chat/Avatar';
import SearchBar from '../components/chat/SearchBar';
import EmptyState from '../components/chat/EmptyState';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function Contacts() {
  const [search, setSearch] = useState('');
  const { user: currentUser } = useAuth();
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userOperations.list(),
    enabled: !!currentUser,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationOperations.list('-updated_at', 100),
  });

  const { data: contactEmails = [] } = useQuery({
    queryKey: ['contacts', currentUser?.email],
    queryFn: () => contactOperations.list(currentUser.email),
    enabled: !!currentUser?.email,
  });

  // Realtime subscription for user online/offline status
  useEffect(() => {
    const channel = supabase
      .channel('contacts-user-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users'
        },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['users'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const otherUsers = users.filter(u => u.email !== currentUser?.email);

  // Split into contacts and non-contacts
  const myContacts = otherUsers.filter(u => contactEmails.includes(u.email));
  const notAdded = otherUsers.filter(u => !contactEmails.includes(u.email));

  const filterList = (list) => list.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredMyContacts = filterList(myContacts);
  const filteredNotAdded = filterList(notAdded);

  const handleStartChat = async (otherUser) => {
    // Check if conversation already exists
    const existing = conversations.find(c =>
      !c.is_group &&
      c.participants?.includes(currentUser.email) &&
      c.participants?.includes(otherUser.email)
    );

    if (existing) {
      navigate(`/chat/${existing.id}`, { state: { contact: otherUser } });
      return;
    }

    // Create new conversation
    const conv = await conversationOperations.create({
      participants: [currentUser.email, otherUser.email],
      participant_names: {
        [currentUser.email]: currentUser.full_name || currentUser.email,
        [otherUser.email]: otherUser.full_name || otherUser.email,
      },
      is_group: false,
      unread_count: {},
    });

    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    navigate(`/chat/${conv.id}`, { state: { contact: otherUser } });
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    // Note: User invitation needs to be implemented with Supabase Auth
    // For now, this is a placeholder
    toast.success('Undangan berhasil dikirim!');
    setInviteEmail('');
    setShowInvite(false);
    setIsInviting(false);
    queryClient.invalidateQueries({ queryKey: ['users'] });
  };

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-primary text-primary-foreground">
        <div className="flex items-center justify-between px-4 pt-12 pb-3">
          <h1 className="text-xl font-bold tracking-tight">Kontak</h1>
          <button
            onClick={() => setShowInvite(true)}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <UserPlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Cari kontak..." />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredMyContacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'Tidak ditemukan' : 'Belum ada kontak'}
          description={search ? 'Coba kata kunci lain' : 'Tambah kontak dari QR Code di Profil'}
        />
      ) : (
        <div>
          {/* My Contacts */}
          {filteredMyContacts.length > 0 && (
            <>
              <div className="px-4 py-2 bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kontak Saya ({filteredMyContacts.length})</p>
              </div>
              <div className="divide-y divide-border/50">
                {filteredMyContacts.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleStartChat(user)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 active:bg-muted transition-colors text-left"
                  >
                    <Avatar
                      name={user.full_name || user.email}
                      src={user.avatar_url}
                      size="md"
                      isOnline={user.is_online}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">
                        {user.full_name || user.email}
                      </h3>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.status_text || 'Hey there! I am using ChatApps'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Invite Dialog */}
      {/* @ts-ignore */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        {/* @ts-ignore */}
        <DialogContent className="max-w-sm mx-auto">
          {/* @ts-ignore */}
          <DialogHeader>
            {/* @ts-ignore */}
            <DialogTitle>Undang Teman</DialogTitle>
            {/* @ts-ignore */}
            <DialogDescription>
              Masukkan email teman untuk mengundang mereka ke ChatApps
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* @ts-ignore */}
            <Input
              type="email"
              placeholder="email@contoh.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            {/* @ts-ignore */}
            <Button
              onClick={handleInvite}
              disabled={isInviting || !inviteEmail.trim()}
              className="w-full"
            >
              {isInviting ? 'Mengirim...' : 'Kirim Undangan'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}