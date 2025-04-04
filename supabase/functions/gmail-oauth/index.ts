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

console.log("Environment check:");
console.log("- REDIRECT_URI configured as:", REDIRECT_URI);
console.log("- GOOGLE_CLIENT_ID available:", !!GOOGLE_CLIENT_ID);
console.log("- GOOGLE_CLIENT_SECRET available:", !!GOOGLE_CLIENT_SECRET);
console.log("EXACT REDIRECT URI BEING USED:", REDIRECT_URI);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders,
      status: 204,
    })
  }

  let parsedAction, parsedCode, parsedState, parsedError;
  const url = new URL(req.url);

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      console.log('Received POST request with body:', JSON.stringify({
        action: body.action,
        code: body.code ? `${body.code.substring(0, 10)}...` : 'missing',
        state: body.state || 'missing'
      }));
      parsedAction = body.action;
      parsedCode = body.code;
      parsedState = body.state;
      parsedError = body.error;
    } catch (e) {
      console.error('Error parsing JSON body:', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  } else {
    parsedAction = url.searchParams.get('action');
    parsedCode = url.searchParams.get('code');
    parsedState = url.searchParams.get('state');
    parsedError = url.searchParams.get('error');
  }

  // Step 1: Generate authorization URL
  if (parsedAction === 'authorize') {
    const state = parsedState || '';
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'https://www.googleapis.com/auth/gmail.send');
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent'); // Force to show consent screen to get refresh token
    authUrl.searchParams.append('state', state);
    
    console.log("Authorization URL using redirect_uri:", REDIRECT_URI);
    
    return new Response(JSON.stringify({ authUrl: authUrl.toString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  }
  
  // Step 2: Handle the callback from Google
  if (parsedAction === 'callback') {
    const code = parsedCode;
    const state = parsedState;
    const error = parsedError;
    
    console.log(`Callback processing:
    - Method: ${req.method}
    - Code: ${code ? `${code.substring(0, 10)}... (${code.length} chars)` : 'missing'}
    - State: ${state || 'missing'}
    - Error: ${error || 'none'}
    - Timestamp: ${new Date().toISOString()}
    `);
    
    // Add code reuse detection
    const codeKey = code?.substring(0, 20) || '';
    if (codeKey && global.usedCodes && global.usedCodes.has(codeKey)) {
      console.error(`Authorization code has already been used: ${code.substring(0, 10)}...`);
      return new Response(JSON.stringify({ 
        error: 'Authorization code has already been used',
        details: 'Each authorization code can only be used once. Please restart the authorization process.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    
    // Initialize usedCodes if it doesn't exist
    if (!global.usedCodes) {
      global.usedCodes = new Set();
    }
    
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
    
    console.log("Starting token exchange with code:", code.substring(0, 10) + "...");
    console.log("Using redirect URI:", REDIRECT_URI);

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
      console.log(`Preparing token exchange request with code: ${code?.substring(0, 10)}...`);
      console.log(`Token request parameters:
        - redirect_uri: ${REDIRECT_URI}
        - client_id: ${GOOGLE_CLIENT_ID ? GOOGLE_CLIENT_ID.substring(0, 5) + '...' : 'missing'}
        - client_secret: ${GOOGLE_CLIENT_SECRET ? 'present' : 'missing'}
        - grant_type: authorization_code
      `);

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
      
      console.log(`Token response status: ${tokenResponse.status}`);
      console.log(`Token response headers: ${JSON.stringify(Object.fromEntries([...tokenResponse.headers.entries()]))}`);
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange error details:', JSON.stringify(tokenData));
        console.error('Full token exchange error context:', {
          status: tokenResponse.status,
          error: tokenData.error,
          error_description: tokenData.error_description,
          redirect_uri_used: REDIRECT_URI,
          code_length: code?.length,
          timestamp: new Date().toISOString()
        });
        
        return new Response(JSON.stringify({ 
          error: 'Failed to exchange authorization code for tokens',
          details: tokenData,
          redirect_uri_used: REDIRECT_URI,
          debug_info: {
            timestamp: new Date().toISOString(),
            code_length: code?.length,
            code_prefix: code?.substring(0, 10) + '...',
            has_client_id: !!GOOGLE_CLIENT_ID,
            has_client_secret: !!GOOGLE_CLIENT_SECRET
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
      }
      
      // Log success but not the actual tokens for security
      console.log("Token exchange successful, received refresh_token:", !!tokenData.refresh_token);
      console.log("Token exchange successful, received access_token:", !!tokenData.access_token);
      
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
      console.error('Exception during token exchange:', error);
      return new Response(JSON.stringify({ 
        error: 'Exception during token exchange',
        details: error.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    } finally {
      if (codeKey) {
        global.usedCodes.add(codeKey);
        console.log(`Added code to used codes cache: ${codeKey.substring(0, 10)}...`);
      }
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