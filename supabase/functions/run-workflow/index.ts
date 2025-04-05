import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Debug function to log messages
const debug = (message: string, data?: any) => {
  console.log(`[run-workflow] ${message}`, data ? data : '');
};

// Function to resolve placeholders in text using the context
function resolvePlaceholders(text: string, context: Record<string, any>): string {
  if (!text || typeof text !== 'string') {
    return text;
  }

  debug('Resolving placeholders', { 
    textLength: text.length,
    hasPlaceholders: text.includes('{{input.')
  });

  return text.replace(/{{input\.(.*?)}}/g, (match, path) => {
    debug('Found placeholder', { 
      placeholder: match, 
      path,
      inputExists: !!context.input,
      inputKeys: context.input ? Object.keys(context.input) : [],
      textExists: !!context.input?.text,
      textLength: context.input?.text?.length || 0
    });
    
    // Get the value from the context - need to prepend "input." to the path
    const fullPath = `input.${path}`;
    const value = getValueByPath(context, fullPath);
    
    debug('Value from getValueByPath', {
      path,
      fullPath,
      valueExists: value !== undefined && value !== null,
      valueType: typeof value,
      valueLength: typeof value === 'string' ? value.length : 0
    });
    
    // Convert the value to string if it's not already
    const stringValue = typeof value === 'string' ? value : 
                       (value === null || value === undefined) ? '' : 
                       JSON.stringify(value);
    
    debug('Resolved placeholder', { 
      placeholder: match, 
      value: stringValue.substring(0, 50) + (stringValue.length > 50 ? '...' : '')
    });
    
    return stringValue;
  });
}

// Helper function to get a value from an object by path (e.g., "messages.0.body")
function getValueByPath(obj: Record<string, any>, path: string): any {
  const parts = path.split('.');
  let current = obj;
  
  debug('Starting path resolution', { 
    path, 
    parts,
    objKeys: Object.keys(obj),
    hasInput: !!obj.input,
    inputKeys: obj.input ? Object.keys(obj.input) : []
  });
  
  for (const part of parts) {
    debug('Processing path part', { 
      part, 
      currentType: typeof current,
      currentIsArray: Array.isArray(current),
      currentKeys: current && typeof current === 'object' ? Object.keys(current) : []
    });
    
    if (current === null || current === undefined || typeof current !== 'object') {
      debug('Path resolution failed', { part, current });
      return undefined;
    }
    
    // Handle array indices
    if (/^\d+$/.test(part)) {
      const index = parseInt(part, 10);
      if (Array.isArray(current) && index < current.length) {
        current = current[index];
      } else {
        debug('Array index out of bounds or not an array', { 
          part, 
          isArray: Array.isArray(current),
          length: Array.isArray(current) ? current.length : 0
        });
        return undefined;
      }
    } else {
      // Handle object properties
      if (part in current) {
        current = current[part];
      } else {
        debug('Property not found in object', { 
          part, 
          availableKeys: Object.keys(current)
        });
        return undefined;
      }
    }
  }
  
  return current;
}

// Function to resolve placeholders in an object (recursively)
function resolvePlaceholdersInObject(obj: Record<string, any>, context: Record<string, any>): Record<string, any> {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const result: Record<string, any> = Array.isArray(obj) ? [] : {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (typeof value === 'string') {
      result[key] = resolvePlaceholders(value, context);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = resolvePlaceholdersInObject(value, context);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

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
    // Create a Supabase client with the auth header
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
    
    // Create a context object to store outputs from each agent
    const outputContext: Record<string, any> = {};
    
    while (currentElementId) {
      debug('Processing element', { elementId: currentElementId });
      
      // Find the current element
      const currentElement = elements.find(element => element.id === currentElementId);
      if (!currentElement) {
        debug('Element not found', { elementId: currentElementId });
        break;
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
        
        // Process the agent configuration to resolve any placeholders
        const processedConfig = resolvePlaceholdersInObject(config.config, outputContext);
        debug('Processed config with resolved placeholders', { 
          original: JSON.stringify(config.config).substring(0, 100) + '...',
          processed: JSON.stringify(processedConfig).substring(0, 100) + '...'
        });
        
        // Execute the agent with its configuration
        if (agentType === 'text_generator') {
          // Log the config we're about to send
          debug('Text generator config', { 
            hasPrompt: !!processedConfig.prompt,
            hasModel: !!processedConfig.model,
            hasApiKey: !!processedConfig.apiKey || !!processedConfig.api_key,
            provider: processedConfig.provider || 'openai'
          });

          // Check which API key property is available
          const apiKeyToUse = processedConfig.apiKey || processedConfig.api_key;
          
          debug('API key details', {
            apiKeyProperty: processedConfig.apiKey ? 'apiKey' : (processedConfig.api_key ? 'api_key' : 'none'),
            apiKeyLength: apiKeyToUse ? apiKeyToUse.length : 0,
            apiKeyStart: apiKeyToUse ? apiKeyToUse.substring(0, 5) + '...' : 'none'
          });

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
              apiKey: apiKeyToUse, // Use whichever property is available
              provider: processedConfig.provider || 'openai'
            })
          });
          
          // Log the raw response for debugging
          const responseText = await response.text();
          debug('Raw text generator response', { 
            status: response.status,
            responseText: responseText.substring(0, 200) + (responseText.length > 200 ? '...' : '')
          });
          
          // Parse the response
          try {
            result = JSON.parse(responseText);
            
            // Store the result in the context
            outputContext[currentElementId] = result;
            
            // Also store the text in the input namespace for easier access
            if (!outputContext.input) {
              outputContext.input = {};
            }
            
            if (result && result.text) {
              outputContext.input.text = result.text;
              debug('Stored text in context', { 
                textLength: result.text.length,
                textPreview: result.text.substring(0, 50) + (result.text.length > 50 ? '...' : ''),
                inputNamespace: JSON.stringify(outputContext.input).substring(0, 200) + '...'
              });
              
              // Dump the full context structure for debugging
              debug('Full context structure after storing text', {
                contextKeys: Object.keys(outputContext),
                inputExists: !!outputContext.input,
                inputKeys: outputContext.input ? Object.keys(outputContext.input) : [],
                textExists: !!outputContext.input?.text,
                textLength: outputContext.input?.text?.length || 0
              });
            } else {
              debug('No text in result', { result: JSON.stringify(result).substring(0, 100) });
              outputContext.input.text = '';
            }
          } catch (e) {
            debug('Error parsing response JSON', { error: e.message, responseText });
            result = { error: 'Failed to parse response', rawResponse: responseText };
          }
          
          // Store the result in the context for future agents to use
          outputContext[currentElementId] = result;
          
          // Also store a simplified version for easier access via input.text
          if (!outputContext.input) {
            outputContext.input = {};
          }
          
          // Check if we got a successful result with text
          if (result && typeof result === 'object' && 'text' in result) {
            outputContext.input.text = result.text;
            debug('Stored text in context', { 
              textLength: result.text.length,
              textPreview: result.text.substring(0, 50) + (result.text.length > 50 ? '...' : ''),
              inputNamespace: JSON.stringify(outputContext.input)
            });
          } else {
            // If there was an error or no text, store that information
            outputContext.input.text = `Error: ${result.error || 'No text generated'}`;
            debug('No text in result, storing error message', { error: result.error });
          }

          // Add this after storing the text in context
          debug('Context after storing text', {
            hasInputNamespace: !!outputContext.input,
            hasTextInInput: !!outputContext.input?.text,
            textLength: outputContext.input?.text?.length || 0,
            inputKeys: outputContext.input ? Object.keys(outputContext.input) : []
          });
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
              onlyUnread: processedConfig.onlyUnread
            })
          });
          
          // Parse the response
          const responseText = await response.text();
          try {
            result = JSON.parse(responseText);
            
            // Store the result in the context
            outputContext[currentElementId] = result;
            
            // Make sure the input namespace exists
            if (!outputContext.input) {
              outputContext.input = {};
            }
            
            // Store the messages array and individual fields for easier access
            if (result.messages && result.messages.length > 0) {
              // Store the messages array
              outputContext.input.messages = result.messages;
              
              // Store the first message details for easy access
              const firstEmail = result.messages[0];
              outputContext.input.emailBody = firstEmail.body || '';
              outputContext.input.emailSubject = firstEmail.subject || '';
              outputContext.input.emailFrom = firstEmail.from || '';
              outputContext.input.emailTo = firstEmail.to || '';
              outputContext.input.emailDate = firstEmail.date || '';
              
              // Create a formatted email representation for easy use in prompts
              outputContext.input.email = `From: ${firstEmail.from || 'Unknown'}\nTo: ${firstEmail.to || 'Unknown'}\nSubject: ${firstEmail.subject || 'No Subject'}\nDate: ${firstEmail.date || 'Unknown'}\n\n${firstEmail.body || ''}`;
              
              debug('Stored gmail reader output in context', { 
                messageCount: result.messages.length,
                hasEmailBody: !!outputContext.input.emailBody,
                emailBodyLength: outputContext.input.emailBody.length,
                emailBodyPreview: outputContext.input.emailBody.substring(0, 50) + '...',
                hasEmail: !!outputContext.input.email,
                emailLength: outputContext.input.email.length,
                contextKeys: Object.keys(outputContext),
                inputKeys: Object.keys(outputContext.input)
              });
            } else {
              debug('No messages found in Gmail reader result', { result: JSON.stringify(result).substring(0, 100) });
              // Set empty values to avoid undefined errors
              outputContext.input.messages = [];
              outputContext.input.emailBody = '';
              outputContext.input.emailSubject = '';
              outputContext.input.emailFrom = '';
              outputContext.input.emailTo = '';
              outputContext.input.emailDate = '';
              outputContext.input.email = '';
            }
          } catch (e) {
            debug('Error parsing Gmail reader response JSON', { error: e.message, responseText });
            result = { error: 'Failed to parse response', rawResponse: responseText };
            
            // Store error in context
            if (!outputContext.input) {
              outputContext.input = {};
            }
            outputContext.input.emailError = `Error: ${e.message}`;
          }
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
              body: processedConfig.body || processedConfig.testBody
            })
          });
          
          result = await response.json();
          
          // Store the result in the context
          outputContext[currentElementId] = result;
          
          // Also store in the input namespace
          if (!outputContext.input) {
            outputContext.input = {};
          }
          outputContext.input.emailResult = result;
          
          debug('Stored gmail sender output in context', { 
            success: result.success,
            messageId: result.messageId,
            contextKeys: Object.keys(outputContext)
          });
        }
        // Add more agent types as needed
      }
      
      // Add the result to the execution results
      executionResults.push({
        elementId: currentElementId,
        result
      });
      
      // Debug the current state of the context
      debug('Current output context', {
        keys: Object.keys(outputContext),
        inputKeys: outputContext.input ? Object.keys(outputContext.input) : 'no input namespace',
        contextSize: JSON.stringify(outputContext).length
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