import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Google OAuth2 configuration
const GOOGLE_OAUTH2_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_OAUTH2_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_OAUTH2_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// Gmail API scopes needed for sending emails
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

// Encryption function for storing sensitive data
function encryptApiKey(key: string, encryptionKey: string): string {
  let result = '';
  
  for (let i = 0; i < key.length; i++) {
    const charCode = key.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result); // Base64 encode
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

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

    // Get OAuth2 credentials from environment variables
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GMAIL_OAUTH_REDIRECT_URI');

    if (!clientId || !clientSecret || !redirectUri) {
      return new Response(JSON.stringify({ 
        error: 'Google OAuth credentials not configured on the server' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // Handle GET request for starting the OAuth flow
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const action = url.searchParams.get('action');
      const state = url.searchParams.get('state'); // Element ID to associate with the credentials

      if (action !== 'authorize') {
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Generate the authorization URL
      const authUrl = new URL(GOOGLE_OAUTH2_AUTH_URL);
      authUrl.searchParams.append('client_id', clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', GMAIL_SCOPES);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent'); // Force to get refresh token
      
      // Add state parameter to track the element ID
      if (state) {
        authUrl.searchParams.append('state', state);
      }

      return new Response(JSON.stringify({ 
        authUrl: authUrl.toString() 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
    // Handle POST request for processing the callback
    else if (req.method === 'POST') {
      const { action, code, state } = await req.json();

      if (action !== 'callback' || !code) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request. Action and code are required.' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Check if this authorization has already been processed
      if (state) {
        const { data: existingConfig } = await supabaseClient
          .from('agent_configs')
          .select('config')
          .eq('user_id', user.id)
          .eq('element_id', state)
          .eq('agent_type', 'gmail_sender')
          .maybeSingle();

        if (existingConfig?.config?.refreshToken) {
          return new Response(JSON.stringify({ 
            success: true,
            alreadyProcessed: true,
            message: 'Gmail authorization already completed for this element'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }
      }

      // Exchange the authorization code for tokens
      const tokenResponse = await fetch(GOOGLE_OAUTH2_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.refresh_token) {
        return new Response(JSON.stringify({ 
          error: 'Failed to exchange authorization code for tokens',
          details: tokenData
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Get user email from Google
      const userInfoResponse = await fetch(GOOGLE_OAUTH2_USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      });

      const userInfo = await userInfoResponse.json();
      const userEmail = userInfo.email;

      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

      // Encrypt the sensitive data
      const encryptedClientId = encryptApiKey(clientId, encryptionKey);
      const encryptedClientSecret = encryptApiKey(clientSecret, encryptionKey);
      const encryptedRefreshToken = encryptApiKey(tokenData.refresh_token, encryptionKey);

      // Store the credentials in the database
      if (state) {
        // First check if a record already exists and delete it to avoid constraint violation
        const { error: deleteError } = await supabaseClient
          .from('agent_configs')
          .delete()
          .eq('user_id', user.id)
          .eq('element_id', state)
          .eq('agent_type', 'gmail_sender');
        
        if (deleteError) {
          console.error('Error deleting existing record:', deleteError);
        }
        
        // Now insert the new record
        const { error: insertError } = await supabaseClient
          .from('agent_configs')
          .insert({
            user_id: user.id,
            element_id: state,
            agent_type: 'gmail_sender',
            config: {
              clientId: encryptedClientId,
              clientSecret: encryptedClientSecret,
              refreshToken: encryptedRefreshToken,
              email: userEmail
            },
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          return new Response(JSON.stringify({ 
            error: 'Failed to save Gmail credentials',
            details: insertError
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
      }

      return new Response(JSON.stringify({ 
        success: true,
        email: userEmail
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    
    // Handle unsupported methods
    else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      })
    }
  } catch (error) {
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 