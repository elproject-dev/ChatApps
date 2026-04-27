import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

// Use config file for native builds, env variables for web
const isNative = Capacitor.isNativePlatform();
const supabaseUrl = isNative ? SUPABASE_URL : (import.meta.env.VITE_SUPABASE_URL || '');
const supabaseAnonKey = isNative ? SUPABASE_ANON_KEY : (import.meta.env.VITE_SUPABASE_ANON_KEY || '');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
