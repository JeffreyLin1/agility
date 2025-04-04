import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Google OAuth configuration
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('GMAIL_OAUTH_REDIRECT_URI') || '';

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action');

  // Step 1: Generate authorization URL
  if (action === 'authorize') {
    const state = url.searchParams.get('state') || ''; // This should be the elementId
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/gmail.send');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent'); // Force to show consent screen to get refresh token
    authUrl.searchParams.append('state', state);
    
    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  // Step 2: Handle the callback from Google
  if (action === 'callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // This should be the elementId
    const error = url.searchParams.get('error');
    
    if (error) {
      return new Response(JSON.stringify({ error }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    if (!code) {
      return new Response(JSON.stringify({ error: 'Authorization code is missing' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }
    
    try {
      // Create a Supabase client with the auth header
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      
      // Get the user from the auth header
      const {
        data: { user },
      } = await supabaseClient.auth.getUser();
      
      if (!user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      
      // Exchange the authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        return new Response(JSON.stringify({ 
          error: 'Failed to exchange authorization code for tokens',
          details: tokenData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Get the refresh token and access token
      const { refresh_token, access_token } = tokenData;
      
      if (!refresh_token) {
        return new Response(JSON.stringify({ 
          error: 'No refresh token received. Make sure to set prompt=consent in the authorization URL.'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';
      
      // Encrypt the tokens
      const encryptedClientId = encryptApiKey(GOOGLE_CLIENT_ID, encryptionKey);
      const encryptedClientSecret = encryptApiKey(GOOGLE_CLIENT_SECRET, encryptionKey);
      const encryptedRefreshToken = encryptApiKey(refresh_token, encryptionKey);
      
      // Store the encrypted tokens in Supabase
      const { error } = await supabaseClient
        .from('agent_configs')
        .upsert({
          user_id: user.id,
          element_id: state, // This is the elementId passed in the state parameter
          agent_type: 'gmail_sender',
          config: { 
            clientId: encryptedClientId,
            clientSecret: encryptedClientSecret,
            refreshToken: encryptedRefreshToken,
            email: tokenData.email // Store the user's email if available
          },
          updated_at: new Date().toISOString(),
        });
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      // Redirect to a success page or return success response
      return new Response(JSON.stringify({ 
        success: true,
        message: 'Gmail authorization successful'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      console.error('Error in callback:', error);
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
  }
  
  return new Response(JSON.stringify({ error: 'Invalid action' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 400,
  });
});

// Encryption function (copied from your existing code)
function encryptApiKey(apiKey: string, encryptionKey: string): string {
  try {
    let result = '';
    
    for (let i = 0; i < apiKey.length; i++) {
      const charCode = apiKey.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
      result += String.fromCharCode(charCode);
    }
    
    return btoa(result); // Base64 encode
  } catch (error) {
    console.error('Error encrypting key:', error);
    return '';
  }
}

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