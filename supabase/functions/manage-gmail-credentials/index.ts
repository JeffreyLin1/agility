import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Simple encryption/decryption for server-side use
function encryptApiKey(apiKey: string, encryptionKey: string): string {
  let result = '';
  
  for (let i = 0; i < apiKey.length; i++) {
    const charCode = apiKey.charCodeAt(i) ^ encryptionKey.charCodeAt(i % encryptionKey.length);
    result += String.fromCharCode(charCode);
  }
  
  return btoa(result); // Base64 encode
}

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
    console.error('Failed to decrypt API key:', error);
    return '';
  }
}

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
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

    // Get the request body - only parse it once
    const requestBody = await req.json();
    const { action, elementId, agentType } = requestBody;
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key'

    if (action === 'save-credentials') {
      // Save Gmail credentials to the user_gmail_credentials table
      const { clientId, clientSecret, refreshToken, email } = requestBody;
      
      if (!clientId || !clientSecret || !refreshToken) {
        return new Response(JSON.stringify({ error: 'All Gmail credentials are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      // Encrypt the Gmail credentials
      const encryptedClientId = encryptApiKey(clientId, encryptionKey);
      const encryptedClientSecret = encryptApiKey(clientSecret, encryptionKey);
      const encryptedRefreshToken = encryptApiKey(refreshToken, encryptionKey);
      
      // Store the encrypted Gmail credentials in Supabase
      const { error } = await supabaseClient
        .from('user_gmail_credentials')
        .upsert({
          user_id: user.id,
          client_id: encryptedClientId,
          client_secret: encryptedClientSecret,
          refresh_token: encryptedRefreshToken,
          email: email || null,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'  // Specify the column for conflict detection
        })
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } 
    else if (action === 'save-config') {
      // Save agent configuration to the agent_configs table
      const { config } = requestBody;
      
      if (!elementId || !agentType) {
        return new Response(JSON.stringify({ error: 'Element ID and agent type are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      // Store the configuration in Supabase
      const { error } = await supabaseClient
        .from('agent_configs')
        .upsert({
          user_id: user.id,
          element_id: elementId,
          agent_type: agentType,
          config: config || {},
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,element_id'  // Specify the columns for conflict detection
        })
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    else if (action === 'get-credentials') {
      // Get the Gmail credentials from Supabase
      const { data: credentials, error: credentialsError } = await supabaseClient
        .from('user_gmail_credentials')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (credentialsError) {
        return new Response(JSON.stringify({ error: credentialsError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      if (!credentials) {
        return new Response(JSON.stringify({ 
          clientId: null, 
          clientSecret: null, 
          refreshToken: null,
          email: null,
          isAuthorized: false
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      // Decrypt the Gmail credentials
      const decryptedClientId = credentials.client_id ? decryptApiKey(credentials.client_id, encryptionKey) : null;
      const decryptedClientSecret = credentials.client_secret ? decryptApiKey(credentials.client_secret, encryptionKey) : null;
      const decryptedRefreshToken = credentials.refresh_token ? decryptApiKey(credentials.refresh_token, encryptionKey) : null;
      
      return new Response(JSON.stringify({ 
        clientId: decryptedClientId,
        clientSecret: decryptedClientSecret,
        refreshToken: decryptedRefreshToken,
        email: credentials.email || null,
        isAuthorized: !!(decryptedClientId && decryptedClientSecret && decryptedRefreshToken)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    else if (action === 'get-config') {
      // Get the agent configuration from Supabase
      if (!elementId || !agentType) {
        return new Response(JSON.stringify({ error: 'Element ID and agent type are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      const { data, error } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', agentType)
        .maybeSingle();
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      // Get the Gmail authorization status
      const { data: credentials, error: credentialsError } = await supabaseClient
        .from('user_gmail_credentials')
        .select('email')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (credentialsError) {
        console.error('Error fetching Gmail credentials:', credentialsError);
      }
      
      return new Response(JSON.stringify({ 
        config: data?.config || {},
        isAuthorized: !!credentials,
        email: credentials?.email || null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 