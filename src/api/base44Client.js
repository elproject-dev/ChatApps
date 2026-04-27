import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

// Create a dummy base44 client to prevent errors during migration
// Base44 is being replaced with Supabase
export const base44 = {
  auth: {
    me: () => Promise.reject(new Error('Base44 auth is deprecated. Use Supabase Auth instead.')),
    logout: () => Promise.resolve(),
    redirectToLogin: () => {},
  },
  entities: {
    User: {
      list: () => Promise.reject(new Error('Use userOperations from supabaseHelpers instead')),
      create: () => Promise.reject(new Error('Use userOperations from supabaseHelpers instead')),
      update: () => Promise.reject(new Error('Use userOperations from supabaseHelpers instead')),
      delete: () => Promise.reject(new Error('Use userOperations from supabaseHelpers instead')),
    },
    Conversation: {
      list: () => Promise.reject(new Error('Use conversationOperations from supabaseHelpers instead')),
      create: () => Promise.reject(new Error('Use conversationOperations from supabaseHelpers instead')),
      update: () => Promise.reject(new Error('Use conversationOperations from supabaseHelpers instead')),
      delete: () => Promise.reject(new Error('Use conversationOperations from supabaseHelpers instead')),
    },
    Message: {
      list: () => Promise.reject(new Error('Use messageOperations from supabaseHelpers instead')),
      create: () => Promise.reject(new Error('Use messageOperations from supabaseHelpers instead')),
      update: () => Promise.reject(new Error('Use messageOperations from supabaseHelpers instead')),
      delete: () => Promise.reject(new Error('Use messageOperations from supabaseHelpers instead')),
    },
  },
  users: {
    inviteUser: () => Promise.resolve({ message: 'User invitation feature not implemented in Supabase migration' }),
  },
};
