import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // Handle POST request for saving or retrieving outputs
    if (req.method === 'POST') {
      const { action, workflowId, elementId, elementIds, outputData } = await req.json();
      
      // Save agent output
      if (action === 'save' && workflowId && elementId && outputData) {
        debug('Saving agent output', { workflowId, elementId });
        
        const { error } = await supabaseClient
          .from('agent_outputs')
          .upsert({
            user_id: user.id,
            workflow_id: workflowId,
            element_id: elementId,
            output_data: outputData,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workflow_id,element_id'
          });
          
        if (error) {
          debug('Error saving output', error);
          return new Response(JSON.stringify({ error: 'Failed to save agent output' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      // Get outputs for specific elements
      if (workflowId && elementIds && Array.isArray(elementIds)) {
        debug('Fetching outputs for elements', { workflowId, elementIds });
        
        const { data: outputs, error } = await supabaseClient
          .from('agent_outputs')
          .select('*')
          .eq('user_id', user.id)
          .eq('workflow_id', workflowId)
          .in('element_id', elementIds);
          
        if (error) {
          debug('Error fetching outputs', error);
          return new Response(JSON.stringify({ error: 'Failed to fetch agent outputs' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        return new Response(JSON.stringify({ outputs: outputs || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      // Get all outputs for a workflow
      if (workflowId) {
        debug('Fetching all outputs for workflow', { workflowId });
        
        const { data: outputs, error } = await supabaseClient
          .from('agent_outputs')
          .select('*')
          .eq('user_id', user.id)
          .eq('workflow_id', workflowId);
          
        if (error) {
          debug('Error fetching outputs', error);
          return new Response(JSON.stringify({ error: 'Failed to fetch agent outputs' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          })
        }
        
        return new Response(JSON.stringify({ outputs: outputs || [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        })
      }
      
      return new Response(JSON.stringify({ error: 'Invalid request parameters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }
    
    // Handle unsupported methods
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    })
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