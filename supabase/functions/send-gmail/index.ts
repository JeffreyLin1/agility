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

// Function to decrypt API keys
function decryptApiKey(encryptedKey: string, encryptionKey: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Convert the encryption key to a Uint8Array
  const keyData = encoder.encode(encryptionKey);
  
  // Decode the base64 encrypted key
  const encryptedData = atob(encryptedKey);
  const encryptedBytes = new Uint8Array(encryptedData.length);
  for (let i = 0; i < encryptedData.length; i++) {
    encryptedBytes[i] = encryptedData.charCodeAt(i);
  }
  
  // Simple XOR decryption
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decryptedBytes[i] = encryptedBytes[i] ^ keyData[i % keyData.length];
  }
  
  // Convert the decrypted bytes back to a string
  return decoder.decode(decryptedBytes);
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
      elementId,
      to,
      subject,
      body,
      clientId,
      clientSecret,
      refreshToken
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      to,
      subject,
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret,
      hasRefreshToken: !!refreshToken
    });

    // Validate required fields
    if (!to) {
      return new Response(JSON.stringify({ error: 'Recipient email is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!subject) {
      return new Response(JSON.stringify({ error: 'Email subject is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!body) {
      return new Response(JSON.stringify({ error: 'Email body is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Variables to hold the final credentials
    let finalClientId = clientId;
    let finalClientSecret = clientSecret;
    let finalRefreshToken = refreshToken;

    // If credentials weren't provided directly, get them from the database
    if (elementId && (!clientId || !clientSecret || !refreshToken)) {
      // First, check if the agent is configured to use Gmail
      debug('Checking if agent is configured for Gmail');
      const { data: agentConfig, error: agentError } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'gmail_sender')
        .maybeSingle();

      if (agentError && agentError.code !== 'PGRST116') {
        debug('Error retrieving agent config', agentError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve agent configuration' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      // If no config exists or gmail_authorized is not true, we'll still try to use the centralized credentials
      // This allows agents to work even if they haven't been explicitly configured yet
      debug('Agent config check complete, proceeding to fetch credentials');

      // Get the Gmail credentials from the centralized table
      debug('Fetching Gmail credentials from user_gmail_credentials table');
      const { data: credentials, error: credentialsError } = await supabaseClient
        .from('user_gmail_credentials')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (credentialsError) {
        debug('Error retrieving credentials', credentialsError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve Gmail credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!credentials) {
        debug('No credentials found for user');
        return new Response(JSON.stringify({ error: 'No Gmail credentials found for this user' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      debug('Credentials found in database');
      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

      // Decrypt the credentials
      finalClientId = credentials.client_id ? decryptApiKey(credentials.client_id, encryptionKey) : null;
      finalClientSecret = credentials.client_secret ? decryptApiKey(credentials.client_secret, encryptionKey) : null;
      finalRefreshToken = credentials.refresh_token ? decryptApiKey(credentials.refresh_token, encryptionKey) : null;

      debug('Credentials decrypted', { 
        hasClientId: !!finalClientId, 
        hasClientSecret: !!finalClientSecret, 
        hasRefreshToken: !!finalRefreshToken 
      });
    }

    if (!finalClientId || !finalClientSecret || !finalRefreshToken) {
      return new Response(JSON.stringify({ error: 'Invalid Gmail credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
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