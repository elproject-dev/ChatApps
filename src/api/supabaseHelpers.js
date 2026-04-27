import { supabase } from './supabaseClient';

// Helper: generate internal email from phone number for Supabase Auth
export const phoneToEmail = (phone) => {
  const cleaned = phone.replace(/[^0-9]/g, '');
  return `phone_${cleaned}@chatapps.internal`;
};

// User operations
export const userOperations = {
  list: async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  getById: async (email) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  getByPhone: async (phone) => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  create: async (userData) => {
    const { data, error } = await supabase
      .from('users')
      .insert([{
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (email, updates) => {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('email', email)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  updateByPhone: async (phone, updates) => {
    const { data, error } = await supabase
      .from('users')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('phone', phone)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  delete: async (email) => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('email', email);

    if (error) throw error;
  },
};

// Conversation operations
export const conversationOperations = {
  list: async (orderBy = '-updated_at', limit = 100) => {
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('*')
      .order(orderBy.replace('-', ''), { ascending: orderBy.startsWith('-') ? false : true })
      .limit(limit);

    if (error) throw error;

    // Calculate unread count for each conversation, also filter out empty ones
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const { data: messages } = await supabase
          .from('messages')
          .select('read_by, sender_email')
          .eq('conversation_id', conv.id);

        // Skip conversations with no messages
        if (!messages || messages.length === 0) {
          return null;
        }

        const unreadCount = {};
        if (conv.participants) {
          conv.participants.forEach((email) => {
            const unread = messages?.filter(
              (msg) => !msg.read_by?.includes(email) && msg.sender_email !== email
            ).length || 0;
            unreadCount[email] = unread;
          });
        }

        return {
          ...conv,
          unread_count: unreadCount,
        };
      })
    );

    return conversationsWithUnread.filter(Boolean);
  },

  filter: async (filters) => {
    let query = supabase.from('conversations').select('*');

    Object.keys(filters).forEach(key => {
      query = query.eq(key, filters[key]);
    });

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  create: async (conversationData) => {
    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        ...conversationData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('conversations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    // First, get all messages with file_url to delete their files from storage
    const { data: messages } = await supabase
      .from('messages')
      .select('file_url')
      .eq('conversation_id', id);

    // Delete all media files from storage
    if (messages && messages.length > 0) {
      await Promise.all(
        messages
          .filter((msg) => msg.file_url)
          .map((msg) => deleteFileFromUrl(msg.file_url))
      );
    }

    // Delete all messages in the conversation
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .eq('conversation_id', id);

    if (messagesError) throw messagesError;

    // Then delete the conversation
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// Message operations
export const messageOperations = {
  list: async (orderBy = '-created_at', limit = 100) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .order(orderBy.replace('-', ''), { ascending: orderBy.startsWith('-') ? false : true })
      .limit(limit);

    if (error) throw error;
    return data;
  },

  filter: async (filters, orderBy = '-created_at', limit = 100) => {
    let query = supabase
      .from('messages')
      .select('*')
      .order(orderBy.replace('-', ''), { ascending: orderBy.startsWith('-') ? false : true })
      .limit(limit);

    Object.keys(filters).forEach(key => {
      query = query.eq(key, filters[key]);
    });

    const { data, error } = await query;

    if (error) throw error;
    return data;
  },

  getById: async (id) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  create: async (messageData) => {
    const { data, error } = await supabase
      .from('messages')
      .insert([{
        ...messageData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  update: async (id, updates) => {
    const { data, error } = await supabase
      .from('messages')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  delete: async (id) => {
    // Get message to check for file_url and conversation_id before deleting
    const { data: message } = await supabase
      .from('messages')
      .select('file_url, conversation_id')
      .eq('id', id)
      .single();

    // Delete file from storage if exists
    if (message?.file_url) {
      await deleteFileFromUrl(message.file_url);
    }

    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Update conversation's last_message after deletion
    if (message?.conversation_id) {
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, message_type, sender_email, created_at')
        .eq('conversation_id', message.conversation_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastMsg && lastMsg.length > 0) {
        const lm = lastMsg[0];
        await supabase
          .from('conversations')
          .update({
            last_message: lm.content || (lm.message_type === 'image' ? '📷 Foto' : lm.message_type === 'audio' ? '🎵 Audio' : lm.message_type === 'video' ? '🎥 Video' : '📎 File'),
            last_message_time: lm.created_at,
            last_message_sender: lm.sender_email,
          })
          .eq('id', message.conversation_id);
      } else {
        // No messages left - clear last_message
        await supabase
          .from('conversations')
          .update({
            last_message: null,
            last_message_time: null,
            last_message_sender: null,
          })
          .eq('id', message.conversation_id);
      }
    }
  },
};

// Helper: extract storage file path from public URL and delete the file
const deleteFileFromUrl = async (fileUrl) => {
  if (!fileUrl) return;
  try {
    // Public URL format: https://{ref}.supabase.co/storage/v1/object/public/{bucket}/{path}
    const url = new URL(fileUrl);
    const parts = url.pathname.split('/');
    // parts: ['', 'storage', 'v1', 'object', 'public', bucket, ...filePath]
    const bucketIndex = parts.indexOf('public') + 1;
    if (bucketIndex <= 0 || bucketIndex >= parts.length) return;
    const bucket = parts[bucketIndex];
    const filePath = parts.slice(bucketIndex + 1).join('/');
    if (!filePath) return;
    await supabase.storage.from(bucket).remove([filePath]);
  } catch (e) {
    console.warn('Failed to delete file from storage:', e);
  }
};

// File upload operation
export const uploadFile = async (file, bucket = 'avatars') => {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { data, error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, file);

  if (uploadError) {
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return { file_url: publicUrl };
};

// Contact operations
export const contactOperations = {
  list: async (userEmail) => {
    const { data, error } = await supabase
      .from('contacts')
      .select('contact_email')
      .eq('user_email', userEmail);

    if (error) throw error;
    return data.map(c => c.contact_email);
  },

  add: async (userEmail, contactEmail) => {
    // Add bidirectional contact relationship
    const { error } = await supabase
      .from('contacts')
      .insert([
        { user_email: userEmail, contact_email: contactEmail },
        { user_email: contactEmail, contact_email: userEmail },
      ]);
    if (error) {
      // Ignore duplicate errors
      if (!error.message.includes('duplicate')) throw error;
    }
    return true;
  },

  remove: async (userEmail, contactEmail) => {
    // Remove bidirectional
    const { error } = await supabase
      .from('contacts')
      .delete()
      .or(`and(user_email.eq.${userEmail},contact_email.eq.${contactEmail}),and(user_email.eq.${contactEmail},contact_email.eq.${userEmail})`);
    if (error) throw error;
    return true;
  },

  isContact: async (userEmail, contactEmail) => {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_email', userEmail)
      .eq('contact_email', contactEmail)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  },
};
