import { createClient } from '@supabase/supabase-js';
import { createClient as createBase44Client } from '@base44/sdk';
import { appParams } from '../src/lib/app-params.js';
import 'dotenv/config';

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Base44 client
const { appId, token, functionsVersion, appBaseUrl } = appParams;
const base44 = createBase44Client({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Migration functions
async function migrateUsers() {
  console.log('🔄 Migrating users...');
  
  try {
    // Fetch all users from Base44
    const { data: base44Users, error: fetchError } = await base44.from('User').select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching users from Base44:', fetchError);
      return;
    }
    
    console.log(`📦 Found ${base44Users.length} users in Base44`);
    
    // Transform and insert into Supabase
    const usersToInsert = base44Users.map(user => ({
      email: user.email || user.id, // Base44 might use id as email
      role: user.role || 'user',
      avatar_url: user.avatar_url,
      status_text: user.status_text || 'Hey there! I am using ChatApp',
      is_online: user.is_online || false,
      last_seen: user.last_seen || new Date().toISOString(),
      phone: user.phone
    }));
    
    const { error: insertError } = await supabase
      .from('users')
      .insert(usersToInsert);
    
    if (insertError) {
      console.error('❌ Error inserting users into Supabase:', insertError);
    } else {
      console.log('✅ Users migrated successfully');
    }
  } catch (error) {
    console.error('❌ Error during user migration:', error);
  }
}

async function migrateConversations() {
  console.log('🔄 Migrating conversations...');
  
  try {
    // Fetch all conversations from Base44
    const { data: base44Conversations, error: fetchError } = await base44.from('Conversation').select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching conversations from Base44:', fetchError);
      return;
    }
    
    console.log(`📦 Found ${base44Conversations.length} conversations in Base44`);
    
    // Transform and insert into Supabase
    const conversationsToInsert = base44Conversations.map(conv => ({
      participants: conv.participants || [],
      participant_names: conv.participant_names || {},
      last_message: conv.last_message,
      last_message_time: conv.last_message_time,
      last_message_sender: conv.last_message_sender,
      is_group: conv.is_group || false,
      group_name: conv.group_name,
      group_avatar: conv.group_avatar,
      unread_count: conv.unread_count || {}
    }));
    
    const { error: insertError } = await supabase
      .from('conversations')
      .insert(conversationsToInsert);
    
    if (insertError) {
      console.error('❌ Error inserting conversations into Supabase:', insertError);
    } else {
      console.log('✅ Conversations migrated successfully');
    }
  } catch (error) {
    console.error('❌ Error during conversation migration:', error);
  }
}

async function migrateMessages() {
  console.log('🔄 Migrating messages...');
  
  try {
    // Fetch all messages from Base44
    const { data: base44Messages, error: fetchError } = await base44.from('Message').select('*');
    
    if (fetchError) {
      console.error('❌ Error fetching messages from Base44:', fetchError);
      return;
    }
    
    console.log(`📦 Found ${base44Messages.length} messages in Base44`);
    
    // Get conversation ID mapping (Base44 ID -> Supabase ID)
    const { data: supabaseConversations } = await supabase
      .from('conversations')
      .select('id, participants');
    
    // Create a mapping function to match conversations
    const findSupabaseConversationId = (base44ConvId) => {
      // This is a simplified approach - you may need to adjust based on your actual data
      const conv = supabaseConversations?.find(c => 
        JSON.stringify(c.participants) === JSON.stringify(base44ConvId)
      );
      return conv?.id;
    };
    
    // Transform and insert into Supabase
    const messagesToInsert = base44Messages
      .map(msg => {
        const supabaseConvId = findSupabaseConversationId(msg.conversation_id);
        if (!supabaseConvId) {
          console.warn(`⚠️  Could not find Supabase conversation for Base44 ID: ${msg.conversation_id}`);
          return null;
        }
        
        return {
          conversation_id: supabaseConvId,
          sender_email: msg.sender_email,
          sender_name: msg.sender_name,
          content: msg.content,
          message_type: msg.message_type || 'text',
          file_url: msg.file_url,
          is_read: msg.is_read || false,
          read_by: msg.read_by || []
        };
      })
      .filter(msg => msg !== null);
    
    const { error: insertError } = await supabase
      .from('messages')
      .insert(messagesToInsert);
    
    if (insertError) {
      console.error('❌ Error inserting messages into Supabase:', insertError);
    } else {
      console.log('✅ Messages migrated successfully');
    }
  } catch (error) {
    console.error('❌ Error during message migration:', error);
  }
}

// Main migration function
async function runMigration() {
  console.log('🚀 Starting Base44 to Supabase migration...\n');
  
  await migrateUsers();
  console.log();
  
  await migrateConversations();
  console.log();
  
  await migrateMessages();
  console.log();
  
  console.log('✨ Migration complete!');
}

// Run the migration
runMigration().catch(console.error);
