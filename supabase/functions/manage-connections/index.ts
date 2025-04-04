import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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

    // Handle different HTTP methods
    if (req.method === 'GET') {
      // Get connections for a workflow
      const url = new URL(req.url);
      const workflowId = url.searchParams.get('workflowId');
      
      if (!workflowId) {
        return new Response(JSON.stringify({ error: 'Workflow ID is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      const { data, error } = await supabaseClient
        .from('agent_connections')
        .select('*')
        .eq('user_id', user.id)
        .eq('workflow_id', workflowId);
        
      if (error) {
        debug('Error fetching connections', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch connections' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ connections: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } 
    else if (req.method === 'POST') {
      // Create a new connection
      const { workflowId, sourceElementId, targetElementId } = await req.json();
      
      if (!workflowId || !sourceElementId || !targetElementId) {
        return new Response(JSON.stringify({ error: 'Workflow ID, source element ID, and target element ID are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      // Prevent self-connections
      if (sourceElementId === targetElementId) {
        return new Response(JSON.stringify({ error: 'Cannot connect an agent to itself' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      const { data, error } = await supabaseClient
        .from('agent_connections')
        .upsert({
          user_id: user.id,
          workflow_id: workflowId,
          source_element_id: sourceElementId,
          target_element_id: targetElementId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'workflow_id,source_element_id,target_element_id'
        });
        
      if (error) {
        debug('Error creating connection', error);
        return new Response(JSON.stringify({ error: 'Failed to create connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    else if (req.method === 'DELETE') {
      // Delete a connection
      const { workflowId, sourceElementId, targetElementId } = await req.json();
      
      if (!workflowId || !sourceElementId || !targetElementId) {
        return new Response(JSON.stringify({ error: 'Workflow ID, source element ID, and target element ID are required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      const { error } = await supabaseClient
        .from('agent_connections')
        .delete()
        .eq('user_id', user.id)
        .eq('workflow_id', workflowId)
        .eq('source_element_id', sourceElementId)
        .eq('target_element_id', targetElementId);
        
      if (error) {
        debug('Error deleting connection', error);
        return new Response(JSON.stringify({ error: 'Failed to delete connection' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }
    else {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
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