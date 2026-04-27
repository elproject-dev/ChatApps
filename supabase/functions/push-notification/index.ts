// @ts-nocheck
// This file runs in Deno (Supabase Edge Functions), not Node.js
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const { record } = await req.json()

    // Extract message data from the new row
    const conversationId = record.conversation_id
    const senderEmail = record.sender_email
    const senderName = record.sender_name || senderEmail
    const content = record.content || ''
    const messageType = record.message_type || record.msg_type || 'text'

    // Handle call notifications
    const isCall = messageType === 'call'
    const callId = record.call_id || ''
    const calleeEmail = record.callee_email || ''

    // Get Supabase credentials from env
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const fcmServiceAccount = Deno.env.get('FCM_SERVICE_ACCOUNT')

    if (!fcmServiceAccount) {
      return new Response(JSON.stringify({ error: 'FCM_SERVICE_ACCOUNT not configured' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // Parse service account JSON
    const serviceAccount = JSON.parse(fcmServiceAccount)
    const projectId = serviceAccount.project_id
    const clientEmail = serviceAccount.client_email
    const privateKey = serviceAccount.private_key

    // Determine recipients based on message type
    let recipientEmails: string[] = []

    if (isCall) {
      // For calls, only notify the callee
      if (calleeEmail) {
        recipientEmails = [calleeEmail]
      }
    } else {
      // For messages, notify all participants except sender
      const convRes = await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversationId}&select=participants`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      const conversations = await convRes.json()
      const participants = conversations[0]?.participants || []
      recipientEmails = participants.filter((email: string) => email !== senderEmail)
    }

    if (recipientEmails.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    const emailFilter = recipientEmails.map((e: string) => `email.eq.${e}`).join(',')
    const usersRes = await fetch(`${supabaseUrl}/rest/v1/users?or=(${emailFilter})&select=email,fcm_token`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    const users = await usersRes.json()

    // Get sender's avatar URL
    const senderRes = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${senderEmail}&select=avatar_url`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    })
    const senderData = await senderRes.json()
    const senderAvatar = senderData[0]?.avatar_url || ''

    // Filter users with FCM tokens
    const tokens = users.filter((u: any) => u.fcm_token).map((u: any) => u.fcm_token)
    if (tokens.length === 0) {
      return new Response(JSON.stringify({ message: 'No FCM tokens found' }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
    }

    // Build notification body
    const notifBody = isCall ? '📞 Panggilan masuk' : messageType === 'image' ? '📷 Foto' : messageType === 'file' ? '📎 File' : content

    // Generate OAuth2 access token using service account
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const payload = {
      iss: clientEmail,
      sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
    }

    // Encode JWT
    const encodeBase64 = (obj: object) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

    const jwtHeader = encodeBase64(header)
    const jwtPayload = encodeBase64(payload)
    const jwtInput = `${jwtHeader}.${jwtPayload}`

    // Sign with RSA private key using Web Crypto API
    const pemBody = privateKey.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\\n/g, '').replace(/\s/g, '')
    const keyBuffer = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8',
      keyBuffer.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(jwtInput))
    const jwtSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    const jwt = `${jwtInput}.${jwtSignature}`

    // Get OAuth2 access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    })
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    // Send push notification via FCM HTTP v1 API
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    // Send to each token individually (v1 API doesn't support multicast)
    const results = await Promise.allSettled(
      tokens.map((token: string) =>
        fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            message: {
              token,
              data: {
                conversation_id: conversationId,
                sender_email: senderEmail,
                sender_name: senderName,
                sender_avatar: senderAvatar,
                msg_type: messageType,
                message_body: notifBody,
                click_action: isCall ? 'INCOMING_CALL' : 'PUSH_NOTIFICATION_TAP',
                ...(isCall ? {
                  call_id: callId,
                  callee_email: calleeEmail,
                } : {}),
              },
              android: {
                priority: 'high',
                ttl: isCall ? '30s' : '86400s',
              },
            },
          }),
        }).then(async (res) => {
          const responseText = await res.text()
          console.log(`FCM response for token ${token.substring(0, 20)}...: status=${res.status} body=${responseText}`)
          if (!res.ok) {
            throw new Error(`FCM error: ${res.status} ${responseText}`)
          }
          return responseText
        })
      )
    )

    const successCount = results.filter((r: any) => r.status === 'fulfilled').length
    const failCount = results.filter((r: any) => r.status === 'rejected').length
    const failures = results.filter((r: any) => r.status === 'rejected').map((r: any) => r.reason?.message || String(r.reason))

    return new Response(JSON.stringify({ success: true, sent: successCount, total: tokens.length, failed: failCount, errors: failures }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } })
  }
})
