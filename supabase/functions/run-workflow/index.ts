import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Debug function to log messages
const debug = (message: string, data?: any) => {
  console.log(`[run-workflow] ${message}`, data ? data : '');
};

serve(async (req) => {
  debug('Request received', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    debug('Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  // Get the authorization header from the request
  const authHeader = req.headers.get('Authorization');
  debug('Auth header present', { 
    present: !!authHeader,
    // Log first 10 chars and length for security
    preview: authHeader ? `${authHeader.substring(0, 10)}... (length: ${authHeader.length})` : 'none'
  });
  
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'No authorization header' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401,
    });
  }

  try {
    // Create a Supabase client with the auth header - USING EXACT SAME PATTERN AS OTHER FUNCTIONS
    debug('Creating Supabase client');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the user from the auth header
    debug('Getting user from auth header');
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    debug('Auth result', { 
      userPresent: !!user, 
      userEmail: user?.email,
      userId: user?.id
    });

    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Not authenticated', 
        authHeader: authHeader ? 'Present (redacted)' : 'Missing'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Parse the request body
    debug('Parsing request body');
    const requestBody = await req.json();
    debug('Request body', requestBody);
    const { startElementId } = requestBody;

    if (!startElementId) {
      return new Response(JSON.stringify({ error: 'Start element ID is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get the workflow ID from the element ID
    debug('Parsing element ID', { startElementId });

    // Try to extract the workflow ID from the element ID format
    const parts = startElementId.split('-');
    debug('Element ID parts', { parts });

    // Check if the element ID follows a pattern we can use
    // First, try to see if it's in a UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let workflowId = null;

    // Check if the first part is a UUID
    if (parts.length > 0 && uuidRegex.test(parts[0])) {
      workflowId = parts[0];
      debug('Found UUID in element ID', { workflowId });
    }

    // If we couldn't extract a workflow ID, try to find it from the workflow elements
    if (!workflowId) {
      debug('No UUID found in element ID, querying workflows');
      
      // Get all workflows for the user
      const { data: workflows, error: workflowsError } = await supabaseClient
        .from('user_workflows')
        .select('id, data')
        .eq('user_id', user.id);
      
      if (workflowsError) {
        debug('Error fetching workflows', workflowsError);
        return new Response(JSON.stringify({ 
          error: 'Failed to fetch workflows', 
          details: workflowsError.message 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }
      
      // Look through each workflow to find the element
      for (const workflow of workflows || []) {
        const elements = workflow.data?.elements || [];
        if (elements.some(element => element.id === startElementId)) {
          workflowId = workflow.id;
          debug('Found workflow containing element', { workflowId });
          break;
        }
      }
    }

    if (!workflowId) {
      return new Response(JSON.stringify({ 
        error: 'Could not determine workflow ID for the given element',
        elementId: startElementId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch the workflow data
    const { data: workflow, error: workflowError } = await supabaseClient
      .from('user_workflows')
      .select('*')
      .eq('id', workflowId)
      .eq('user_id', user.id)
      .single();

    if (workflowError) {
      debug('Error fetching workflow', workflowError);
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch workflow', 
        details: workflowError.message 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (!workflow) {
      return new Response(JSON.stringify({ error: 'Workflow not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    
    // Extract elements and connections from the workflow
    const elements = workflow.data?.elements || [];
    const connections = workflow.data?.connections || [];
    
    // Create a map of connections for easy lookup
    const connectionMap = new Map();
    for (const connection of connections) {
      connectionMap.set(connection.sourceId, connection.targetId);
    }
    
    // Find the starting element
    const startElement = elements.find(element => element.id === startElementId);
    if (!startElement) {
      return new Response(JSON.stringify({ error: 'Starting element not found in workflow' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }
    
    // Execute the workflow starting from the specified element
    let currentElementId = startElementId;
    const executionResults = [];
    
    while (currentElementId) {
      debug('Processing element', { elementId: currentElementId });
      
      // Find the current element
      const currentElement = elements.find(element => element.id === currentElementId);
      if (!currentElement) {
        debug('Element not found', { elementId: currentElementId });
        break;
      }
      
      // Get the previous element's output if it exists
      const prevElementId = Array.from(connectionMap.entries())
        .find(([_, targetId]) => targetId === currentElementId)?.[0];
      
      let prevOutput = null;
      if (prevElementId) {
        // Find the previous element's result in our execution results
        const prevResult = executionResults.find(r => r.elementId === prevElementId);
        if (prevResult) {
          prevOutput = prevResult.result;
          debug('Found previous element output', { 
            prevElementId, 
            outputAvailable: !!prevOutput 
          });
        }
      }
      
      // Execute the element based on its type
      let result = null;
      
      if (currentElement.type === 'agent') {
        const agentType = currentElement.data.name.toLowerCase().replace(/\s+/g, '_');
        debug('Executing agent', { agentType, elementId: currentElementId });
        
        // Get the agent configuration
        const { data: config, error: configError } = await supabaseClient
          .from('agent_configs')
          .select('config')
          .eq('element_id', currentElementId)
          .eq('user_id', user.id)
          .eq('agent_type', agentType)
          .maybeSingle();
        
        if (configError) {
          debug('Error fetching agent config', configError);
          return new Response(JSON.stringify({ error: 'Failed to fetch agent configuration', details: configError.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
          });
        }
        
        if (!config?.config) {
          debug('Agent not configured', { elementId: currentElementId });
          return new Response(JSON.stringify({ error: 'Agent not configured' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
        
        // Process the configuration to replace any input variables
        const processedConfig = processConfigWithInputs(config.config, prevOutput);
        debug('Processed config with inputs', { 
          hasInputs: !!prevOutput,
          configKeys: Object.keys(processedConfig)
        });
        
        // Execute the agent with the processed configuration
        if (agentType === 'text_generator') {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              elementId: currentElementId,
              prompt: processedConfig.prompt,
              model: processedConfig.model,
              apiKey: processedConfig.apiKey,
              provider: processedConfig.provider,
              previousOutput: prevOutput // Pass the previous output directly as well
            })
          });
          
          result = await response.json();
        } 
        else if (agentType === 'gmail_reader') {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/read-gmail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              elementId: currentElementId,
              fromEmail: processedConfig.fromEmail,
              maxResults: processedConfig.maxResults,
              onlyUnread: processedConfig.onlyUnread,
              previousOutput: prevOutput
            })
          });
          
          result = await response.json();
        }
        else if (agentType === 'gmail_sender') {
          const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-gmail`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader
            },
            body: JSON.stringify({
              elementId: currentElementId,
              to: processedConfig.to || processedConfig.testRecipient,
              subject: processedConfig.subject || processedConfig.testSubject,
              body: processedConfig.body || processedConfig.testBody,
              previousOutput: prevOutput
            })
          });
          
          result = await response.json();
        }
        // Add more agent types as needed
      }
      
      // Add the result to the execution results
      executionResults.push({
        elementId: currentElementId,
        result
      });
      
      // Move to the next element in the workflow
      currentElementId = connectionMap.get(currentElementId);
    }

    return new Response(JSON.stringify({ 
      success: true,
      results: executionResults
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    debug('Error executing workflow', error);
    return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Helper function to process configuration with input variables
function processConfigWithInputs(config, prevOutput) {
  if (!prevOutput) return config;
  
  const processedConfig = { ...config };
  
  // Process each field in the config
  for (const [key, value] of Object.entries(processedConfig)) {
    if (typeof value === 'string') {
      processedConfig[key] = replaceVariables(value, prevOutput);
    }
  }
  
  return processedConfig;
}

// Helper function to replace variables in a string
function replaceVariables(text, inputData) {
  if (!text || typeof text !== 'string') return text;
  
  return text.replace(/{{input\.(.*?)}}/g, (match, path) => {
    const pathParts = path.split('.');
    let value = inputData;
    
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return match; // Keep the original placeholder if path not found
      }
    }
    
    return typeof value === 'string' ? value : JSON.stringify(value);
  });
} 