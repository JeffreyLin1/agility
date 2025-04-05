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
    const requestBody = await req.json()
    const { action, elementId, agentType } = requestBody

    debug('Request received', { action, elementId, agentType, userId: user.id });

    if (action === 'save-config') {
      // Save agent configuration to the agent_configs table
      const { config } = requestBody;
      
      if (!elementId || !agentType) {
        return new Response(JSON.stringify({ error: 'Element ID and agent type are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      debug('Saving configuration', { 
        elementId, 
        agentType, 
        configKeys: config ? Object.keys(config) : 'no config'
      });
      
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
          onConflict: 'user_id,element_id'
        })
      
      if (error) {
        debug('Error saving configuration', error);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      debug('Configuration saved successfully');
      return new Response(JSON.stringify({ success: true }), {
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

      debug('Getting configuration', { elementId, agentType });
      
      const { data, error } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', agentType)
        .maybeSingle();
      
      if (error) {
        debug('Error getting configuration', error);
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      debug('Configuration retrieved', { 
        found: !!data, 
        configKeys: data?.config ? Object.keys(data.config) : 'no config'
      });
      
      return new Response(JSON.stringify({ 
        config: data?.config || {}
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debug('Error in edge function', { error: errorMessage });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error', 
      details: errorMessage 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 