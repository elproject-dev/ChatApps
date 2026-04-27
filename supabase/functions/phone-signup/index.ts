// @ts-nocheck
// Edge function for phone-based signup using Admin API
// Bypasses Supabase email validation by using service role key
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, password, fullName } = await req.json()

    if (!phone || !password) {
      return new Response(
        JSON.stringify({ error: 'Nomor telepon dan password wajib diisi' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Generate internal email from phone
    const cleaned = phone.replace(/[^0-9]/g, '')
    const email = `phone_${cleaned}@chatapps.internal`

    // Use Admin API to create user (bypasses email validation)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since it's a fake email
      user_metadata: {
        full_name: fullName || '',
        phone: phone,
      },
    })

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      )
    }

    // Also create user record in users table
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .upsert({
        email: email,
        full_name: fullName || '',
        phone: phone,
        role: 'user',
        is_online: true,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'email' })

    if (dbError) {
      console.warn('Could not create user record:', dbError.message)
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: data.user.id, email } }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    )
  }
})
