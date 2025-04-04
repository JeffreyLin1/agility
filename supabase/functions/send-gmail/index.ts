import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { google } from 'https://esm.sh/googleapis@126.0.1'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
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
    // Create a Supabase client with the auth header
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Get the user from the auth header
    const {
      data: { user },
    } = await supabaseClient.auth.getUser()

    if (!user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Parse the request body
    const { 
      clientId, 
      clientSecret, 
      refreshToken, 
      to, 
      subject, 
      body,
      elementId // Optional - only needed if we're retrieving credentials from the database
    } = await req.json()

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
      // Get the Gmail credentials from Supabase
      const { data, error } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'gmail_sender')
        .single();

      if (error) {
        return new Response(JSON.stringify({ error: 'Failed to retrieve Gmail credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!data?.config) {
        return new Response(JSON.stringify({ error: 'No Gmail credentials found for this element' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

      // Decrypt the credentials (assuming you have these functions defined elsewhere)
      finalClientId = data.config.clientId ? decryptApiKey(data.config.clientId, encryptionKey) : null;
      finalClientSecret = data.config.clientSecret ? decryptApiKey(data.config.clientSecret, encryptionKey) : null;
      finalRefreshToken = data.config.refreshToken ? decryptApiKey(data.config.refreshToken, encryptionKey) : null;

      if (!finalClientId || !finalClientSecret || !finalRefreshToken) {
        return new Response(JSON.stringify({ error: 'Invalid Gmail credentials' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
    }

    // Configure OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      finalClientId,
      finalClientSecret,
      'https://developers.google.com/oauthplayground' // Redirect URI (not used in this context)
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: finalRefreshToken
    });

    try {
      // Get a new access token
      const { token } = await oauth2Client.getAccessToken();
      
      if (!token) {
        throw new Error('Failed to obtain access token');
      }

      // Create Gmail API client
      const gmail = google.gmail({
        version: 'v1',
        auth: oauth2Client
      });

      // Prepare the email
      const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        '',
        body
      ];

      // Convert the email to base64 format
      const email = Buffer.from(emailLines.join('\r\n')).toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Send the email
      const result = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: email
        }
      });

      return new Response(JSON.stringify({ 
        success: true,
        messageId: result.data.id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } catch (error) {
      console.error('Gmail API error:', error);
      return new Response(JSON.stringify({ 
        error: 'Failed to send email: ' + (error.message || 'Unknown error')
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})

// Decryption function (copied from your existing code)
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
    console.error('Error decrypting key:', error);
    return '';
  }
} 