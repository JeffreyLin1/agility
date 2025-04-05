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

// Function to decrypt API keys
function decryptApiKey(encryptedKey: string, encryptionKey: string): string {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Convert the encryption key to a Uint8Array
  const keyData = encoder.encode(encryptionKey);
  
  // Decode the base64 encrypted key
  const encryptedData = atob(encryptedKey);
  const encryptedBytes = new Uint8Array(encryptedData.length);
  for (let i = 0; i < encryptedData.length; i++) {
    encryptedBytes[i] = encryptedData.charCodeAt(i);
  }
  
  // Simple XOR decryption
  const decryptedBytes = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decryptedBytes[i] = encryptedBytes[i] ^ keyData[i % keyData.length];
  }
  
  // Convert the decrypted bytes back to a string
  return decoder.decode(decryptedBytes);
}

// Add this function to process input placeholders
function processInputPlaceholders(text: string, previousOutput: any): string {
  if (!text || typeof text !== 'string' || !previousOutput) {
    return text;
  }

  debug('Processing placeholders in text', { 
    textLength: text.length,
    hasPlaceholders: text.includes('{{input.')
  });

  return text.replace(/{{input\.(.*?)}}/g, (match, path) => {
    debug('Found placeholder', { placeholder: match, path });
    
    const pathParts = path.split('.');
    let value = previousOutput;
    
    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
        debug('Resolved path part', { part, hasValue: !!value });
      } else {
        debug('Path part not found in previous output', { part });
        return match; // Keep the original placeholder if path not found
      }
    }
    
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

    // Parse the request body
    const { 
      elementId,
      apiKey,
      model,
      prompt,
      previousOutput,
      testMode
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      model,
      hasApiKey: !!apiKey,
      promptLength: prompt?.length,
      hasPreviousOutput: !!previousOutput,
      testMode
    });

    // Process placeholders in prompt
    const processedPrompt = processInputPlaceholders(prompt, previousOutput);
    debug('Processed prompt', {
      originalPromptLength: prompt?.length,
      processedPromptLength: processedPrompt?.length,
      placeholdersReplaced: (prompt !== processedPrompt)
    });

    // Validate required fields
    if (!processedPrompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Variables to hold the final credentials
    let finalApiKey = apiKey;
    let finalModel = model;

    // If API key wasn't provided directly or we're not in test mode, get it from the database
    if (elementId && (!apiKey || !testMode)) {
      debug('Fetching API key from database');
      const { data: agentConfig, error: agentError } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'text_generator')
        .maybeSingle();

      if (agentError && agentError.code !== 'PGRST116') {
        debug('Error retrieving agent config', agentError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve agent configuration' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!agentConfig || !agentConfig.config) {
        debug('No agent config found');
        return new Response(JSON.stringify({ error: 'No text generator configuration found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      debug('Agent config found');
      // Get the encryption key from environment variables
      const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

      // Decrypt the API key
      finalApiKey = agentConfig.config.apiKey ? decryptApiKey(agentConfig.config.apiKey, encryptionKey) : null;
      finalModel = agentConfig.config.model || 'gpt-3.5-turbo';

      debug('Config decrypted', { 
        hasApiKey: !!finalApiKey, 
        model: finalModel
      });
    }

    if (!finalApiKey) {
      return new Response(JSON.stringify({ error: 'API key is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    try {
      debug('Determining API provider');
      // Determine if we're using OpenAI or Anthropic based on the model
      const isAnthropicModel = finalModel.includes('claude');
      const apiProvider = isAnthropicModel ? 'anthropic' : 'openai';
      
      debug('Calling API', { provider: apiProvider, model: finalModel });
      
      let apiResponse;
      let responseData;
      
      if (apiProvider === 'openai') {
        // Call OpenAI API
        apiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${finalApiKey}`
          },
          body: JSON.stringify({
            model: finalModel,
            messages: [{ role: 'user', content: processedPrompt }],
            max_tokens: 1000
          })
        });
        
        responseData = await apiResponse.json();
        
        if (!apiResponse.ok) {
          debug('OpenAI API error', responseData);
          throw new Error(responseData.error?.message || 'Failed to generate text');
        }
        
        const generatedText = responseData.choices[0]?.message?.content || '';
        
        return new Response(JSON.stringify({ 
          success: true,
          text: generatedText
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      } else {
        // Call Anthropic API
        apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': finalApiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: finalModel,
            messages: [{ role: 'user', content: processedPrompt }],
            max_tokens: 1000
          })
        });
        
        responseData = await apiResponse.json();
        
        if (!apiResponse.ok) {
          debug('Anthropic API error', responseData);
          throw new Error(responseData.error?.message || 'Failed to generate text');
        }
        
        const generatedText = responseData.content[0]?.text || '';
        
        return new Response(JSON.stringify({ 
          success: true,
          text: generatedText
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to generate text: ' + errorMessage
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
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
