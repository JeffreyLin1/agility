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

    // Get the request body
    const { action, elementId, apiKey, model, keyType } = await req.json()
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key'

    if (action === 'save') {
      // Check if this is a Gmail configuration
      if (keyType === 'gmail') {
        const { clientId, clientSecret, refreshToken } = await req.json();
        
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
          .from('agent_configs')
          .upsert({
            user_id: user.id,
            element_id: elementId,
            agent_type: 'gmail_sender',
            config: { 
              clientId: encryptedClientId,
              clientSecret: encryptedClientSecret,
              refreshToken: encryptedRefreshToken
            },
            updated_at: new Date().toISOString(),
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
      
      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'API key is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      // Encrypt the API key
      const encryptedKey = encryptApiKey(apiKey, encryptionKey)

      // Store the encrypted API key and model in Supabase
      const { error } = await supabaseClient
        .from('agent_configs')
        .upsert({
          user_id: user.id,
          element_id: elementId,
          agent_type: 'text_generator',
          config: { 
            api_key: encryptedKey,
            model: model || 'gpt-3.5-turbo' 
          },
          updated_at: new Date().toISOString(),
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
    } else if (action === 'get') {
      // Check if this is a Gmail configuration
      if (keyType === 'gmail') {
        // Get the Gmail credentials from Supabase
        const { data, error } = await supabaseClient
          .from('agent_configs')
          .select('config')
          .eq('user_id', user.id)
          .eq('element_id', elementId)
          .eq('agent_type', 'gmail_sender')
          .single()
        
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        if (!data?.config) {
          return new Response(JSON.stringify({ 
            clientId: null, 
            clientSecret: null, 
            refreshToken: null 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          })
        }
        
        // Decrypt the Gmail credentials
        const decryptedClientId = data.config.clientId ? decryptApiKey(data.config.clientId, encryptionKey) : null;
        const decryptedClientSecret = data.config.clientSecret ? decryptApiKey(data.config.clientSecret, encryptionKey) : null;
        const decryptedRefreshToken = data.config.refreshToken ? decryptApiKey(data.config.refreshToken, encryptionKey) : null;
        
        return new Response(JSON.stringify({ 
          clientId: decryptedClientId,
          clientSecret: decryptedClientSecret,
          refreshToken: decryptedRefreshToken,
          email: data.config.email || null
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // Get the API key from Supabase
      const { data, error } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'text_generator')
        .single()

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!data?.config) {
        return new Response(JSON.stringify({ apiKey: null, model: 'gpt-3.5-turbo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }

      // Decrypt the API key
      const decryptedKey = data.config.api_key ? decryptApiKey(data.config.api_key, encryptionKey) : null

      return new Response(JSON.stringify({ 
        apiKey: decryptedKey,
        model: data.config.model || 'gpt-3.5-turbo'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
  } catch (error) {
    // Handle any unexpected errors
    console.error('Error in edge function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 