# Supabase Migration Setup

## Environment Variables

Add the following Supabase credentials to your `.env.local` file:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Getting Supabase Credentials

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select an existing one
3. Navigate to Project Settings > API
4. Copy the Project URL and anon/public key

## Running SQL Migrations

1. Go to Supabase Dashboard > SQL Editor
2. Run the migration scripts in order:
   - `supabase/migrations/001_create_users_table.sql`
   - `supabase/migrations/002_create_conversations_table.sql`
   - `supabase/migrations/003_create_messages_table.sql`

## Data Migration

To migrate data from Base44 to Supabase:

1. Make sure your `.env.local` has both Base44 and Supabase credentials
2. Run the migration script:

```bash
node scripts/migrateToSupabase.js
```

## Updating Codebase

After migration, update your imports from:
```javascript
import { base44 } from '@/api/base44Client';
```

To:
```javascript
import { supabase } from '@/api/supabaseClient';
```

## API Changes

Base44 API calls need to be updated to Supabase syntax:

### Example: Reading Data

**Base44:**
```javascript
const { data } = await base44.from('User').select('*');
```

**Supabase:**
```javascript
const { data } = await supabase.from('users').select('*');
```

### Example: Inserting Data

**Base44:**
```javascript
await base44.from('User').insert({ name: 'John' });
```

**Supabase:**
```javascript
await supabase.from('users').insert({ name: 'John' });
```

### Example: Updating Data

**Base44:**
```javascript
await base44.from('User').update({ name: 'Jane' }).eq('id', userId);
```

**Supabase:**
```javascript
await supabase.from('users').update({ name: 'Jane' }).eq('id', userId);
```

### Example: Deleting Data

**Base44:**
```javascript
await base44.from('User').delete().eq('id', userId);
```

**Supabase:**
```javascript
await supabase.from('users').delete().eq('id', userId);
```
