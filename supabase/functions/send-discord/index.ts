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
      webhookUrl,
      username,
      avatarUrl,
      content
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      webhookUrl: webhookUrl ? '***' : undefined, // Don't log the full webhook URL for security
      username,
      hasAvatarUrl: !!avatarUrl,
      contentLength: content?.length
    });

    // Validate required fields
    if (!elementId) {
      return new Response(JSON.stringify({ 
        error: 'Element ID is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // If webhook URL wasn't provided directly, get it from the database
    if (elementId && !webhookUrl) {
      debug('Fetching Discord webhook configuration from database');
      const { data: agentConfig, error: agentError } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'discord_messenger')
        .maybeSingle();

      if (agentError && agentError.code !== 'PGRST116') {
        debug('Error retrieving agent config', agentError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve agent configuration' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!agentConfig || !agentConfig.config) {
        debug('No Discord webhook configuration found');
        return new Response(JSON.stringify({ error: 'No Discord webhook configuration found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        })
      }

      debug('Discord webhook configuration found');
      
      // Get the configuration values
      webhookUrl = agentConfig.config.webhookUrl;
      username = agentConfig.config.username || username;
      avatarUrl = agentConfig.config.avatarUrl || avatarUrl;
      
      // If content wasn't provided in the request, use the saved message content
      if (!content && agentConfig.config.messageContent) {
        content = agentConfig.config.messageContent;
      }
    }

    // Re-validate webhook URL after potentially loading from database
    if (!webhookUrl) {
      return new Response(JSON.stringify({ 
        error: 'Discord webhook URL is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      return new Response(JSON.stringify({ 
        error: 'Invalid Discord webhook URL format' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    try {
      debug('Preparing Discord message payload');
      
      // Prepare the message payload
      const payload: Record<string, any> = {
        content: content
      };
      
      // Add optional fields if provided
      if (username) {
        payload.username = username;
      }
      
      if (avatarUrl) {
        payload.avatar_url = avatarUrl;
      }
      
      debug('Sending message to Discord webhook');
      
      // Send the message to Discord
      const discordResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      debug('Discord API response', { 
        status: discordResponse.status, 
        statusText: discordResponse.statusText 
      });
      
      // Discord webhook returns 204 No Content on success, which has no body to parse
      let messageId = 'unknown';
      let timestamp = new Date().toISOString();
      
      // Only try to parse JSON if there's content to parse
      if (discordResponse.status !== 204 && discordResponse.headers.get('content-length') !== '0') {
        try {
          const responseData = await discordResponse.json();
          debug('Discord response data', responseData);
          
          if (responseData.id) {
            messageId = responseData.id;
          }
          
          if (responseData.timestamp) {
            timestamp = responseData.timestamp;
          }
        } catch (parseError) {
          debug('Could not parse Discord response as JSON', { 
            error: parseError instanceof Error ? parseError.message : 'Unknown error' 
          });
          // Continue execution even if parsing fails
        }
      }
      
      // If status is not 2xx, throw an error
      if (!discordResponse.ok) {
        throw new Error(`Discord API returned ${discordResponse.status}: ${discordResponse.statusText}`);
      }
      
      // Store the result in the agent_outputs table
      const { error: outputError } = await supabaseClient
        .from('agent_outputs')
        .insert({
          user_id: user.id,
          element_id: elementId,
          output: {
            success: true,
            messageId,
            timestamp,
            content
          },
          created_at: timestamp
        });
      
      if (outputError) {
        debug('Error storing output', outputError);
        // Non-critical error, continue
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        messageId,
        timestamp
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('Discord API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to send Discord message: ' + errorMessage
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