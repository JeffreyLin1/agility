import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Debug logging function
function debug(message: string, data?: any) {
  console.log(`[DEBUG] ${message}`);
  if (data) {
    try {
      console.log(typeof data === 'object' ? JSON.stringify(data, null, 2) : data);
    } catch (e) {
      console.log('Could not stringify data:', typeof data);
    }
  }
}

serve(async (req) => {
  debug('Request received');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  // Get the authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    })
  }

  try {
    debug('Creating Supabase client');
    // Create a Supabase client with the auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    debug('Getting user from auth');
    // Get the user from the auth header
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      debug('User not authenticated');
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }
    
    debug('User authenticated', { userId: user.id, email: user.email });

    // Parse the request body
    const { 
      clientId, 
      clientSecret, 
      refreshToken, 
      to, 
      subject, 
      body,
      elementId
    } = await req.json()

    debug('Request parameters', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret, 
      hasRefreshToken: !!refreshToken,
      elementId,
      to,
      subject,
      bodyLength: body?.length
    });

    // Validate required fields
    if ((!clientId || !clientSecret || !refreshToken) && !elementId) {
      return new Response(JSON.stringify({ 
        error: 'Gmail credentials are required (either directly or via elementId)' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!to || !subject || !body) {
      return new Response(JSON.stringify({ 
        error: 'Email recipient, subject, and body are required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // If elementId is provided but not credentials, fetch credentials from database
    let finalClientId = clientId;
    let finalClientSecret = clientSecret;
    let finalRefreshToken = refreshToken;

    if (elementId && (!clientId || !clientSecret || !refreshToken)) {
      debug('Fetching credentials from database for elementId', elementId);
      // Get the Gmail credentials from Supabase
      const { data, error } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'gmail_sender')
        .single();

      if (error) {
        debug('Error retrieving credentials', error);
        return new Response(JSON.stringify({ error: 'Failed to retrieve Gmail credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!data?.config) {
        debug('No credentials found for element');
        return new Response(JSON.stringify({ error: 'No Gmail credentials found for this element' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      debug('Credentials found in database');
      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

      // Decrypt the credentials
      finalClientId = data.config.clientId ? decryptApiKey(data.config.clientId, encryptionKey) : null;
      finalClientSecret = data.config.clientSecret ? decryptApiKey(data.config.clientSecret, encryptionKey) : null;
      finalRefreshToken = data.config.refreshToken ? decryptApiKey(data.config.refreshToken, encryptionKey) : null;

      debug('Credentials decrypted', { 
        hasClientId: !!finalClientId, 
        hasClientSecret: !!finalClientSecret, 
        hasRefreshToken: !!finalRefreshToken 
      });

      if (!finalClientId || !finalClientSecret || !finalRefreshToken) {
        return new Response(JSON.stringify({ error: 'Invalid Gmail credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    try {
      debug('Getting access token directly from Google OAuth API');
      // Get a new access token directly from Google OAuth API
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: finalClientId,
          client_secret: finalClientSecret,
          refresh_token: finalRefreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const tokenData = await tokenResponse.json();
      debug('Token response', { success: tokenResponse.ok, status: tokenResponse.status });
      
      if (!tokenResponse.ok || !tokenData.access_token) {
        debug('Failed to get access token', tokenData);
        throw new Error('Failed to obtain access token: ' + (tokenData.error_description || tokenData.error || 'Unknown error'));
      }

      const accessToken = tokenData.access_token;
      debug('Access token obtained');

      // Prepare the email in RFC 2822 format
      const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset=utf-8',
        '',
        body
      ];

      debug('Preparing email content');
      // Convert the email to base64 format using TextEncoder
      const encoder = new TextEncoder();
      const emailText = emailLines.join('\r\n');
      const emailBytes = encoder.encode(emailText);
      const email = btoa(String.fromCharCode(...new Uint8Array(emailBytes)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      debug('Sending email via Gmail API');
      // Send the email using direct REST API call
      const result = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: email
        })
      });

      if (!result.ok) {
        const errorData = await result.json();
        debug('Gmail API error', errorData);
        throw new Error(`Gmail API error: ${JSON.stringify(errorData)}`);
      }

      const data = await result.json();
      debug('Email sent successfully', { messageId: data.id });

      return new Response(JSON.stringify({ 
        success: true,
        messageId: data.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('Gmail API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send email: ' + errorMessage
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }
  } catch (error) {
    // Safely handle error object
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debug('Error in edge function', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + errorMessage
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Decryption function
function decryptApiKey(encryptedKey: string, encryptionKey: string): string {
  try {
    const decoded = atob(encryptedKey); // Base64 decode
    let result = '';
    
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
      result += String.fromCharCode(charCode);
    }
    
    return result;
  } catch (error) {
    console.error('Error decrypting key:', error instanceof Error ? error.message : 'Unknown error');
    return '';
  }
} 