import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
    const { action, workflowData, workflowName } = await req.json()
    
    console.log("Request received:", {
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      url: req.url
    });

    if (action === 'save') {
      // Validate the workflow data
      if (!workflowData) {
        return new Response(JSON.stringify({ error: 'Workflow data is required' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }
      
      // Check if the user already has a workflow
      const { data: existingWorkflow, error: fetchError } = await supabaseClient
        .from('user_workflows')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (fetchError) {
        return new Response(JSON.stringify({ error: fetchError.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      // Update or insert the workflow with a default name
      const { data, error } = existingWorkflow 
        ? await supabaseClient
            .from('user_workflows')
            .update({
              data: workflowData,
              name: 'My Workflow', // Use a default name
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingWorkflow.id)
            .select()
            .single()
        : await supabaseClient
            .from('user_workflows')
            .insert({
              user_id: user.id,
              data: workflowData,
              name: 'My Workflow', // Use a default name
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .select()
            .single();
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      console.log("Workflow saved successfully");
      
      // Return the workflow data
      return new Response(JSON.stringify({ 
        message: 'Workflow saved successfully',
        workflow: data
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    } 
    else if (action === 'load') {
      // Load the user's workflow
      const { data, error } = await supabaseClient
        .from('user_workflows')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        workflow: data || null
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
}) 