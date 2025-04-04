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
      fromEmail,
      maxResults = 10,
      onlyUnread = true
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      fromEmail,
      maxResults,
      onlyUnread
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

    if (!fromEmail) {
      return new Response(JSON.stringify({ 
        error: 'Sender email address is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // First, check if the agent is configured to use Gmail
    debug('Checking if agent is configured for Gmail');
    const { data: agentConfig, error: agentError } = await supabaseClient
      .from('agent_configs')
      .select('config')
      .eq('user_id', user.id)
      .eq('element_id', elementId)
      .eq('agent_type', 'gmail_reader')
      .maybeSingle();

    if (agentError && agentError.code !== 'PGRST116') {
      debug('Error retrieving agent config', agentError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve agent configuration' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // If no config exists or gmail_authorized is not true, we'll still try to use the centralized credentials
    // This allows agents to work even if they haven't been explicitly configured yet
    debug('Agent config check complete, proceeding to fetch credentials');

    // Get the Gmail credentials from the centralized table
    debug('Fetching Gmail credentials from user_gmail_credentials table');
    const { data: credentials, error: credentialsError } = await supabaseClient
      .from('user_gmail_credentials')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (credentialsError) {
      debug('Error retrieving credentials', credentialsError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve Gmail credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    if (!credentials) {
      debug('No credentials found for user');
      return new Response(JSON.stringify({ error: 'No Gmail credentials found for this user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      })
    }

    debug('Credentials found in database');
    // Get the encryption key from environment variables
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY') || 'default-encryption-key';

    // Decrypt the credentials
    const clientId = credentials.client_id ? decryptApiKey(credentials.client_id, encryptionKey) : null;
    const clientSecret = credentials.client_secret ? decryptApiKey(credentials.client_secret, encryptionKey) : null;
    const refreshToken = credentials.refresh_token ? decryptApiKey(credentials.refresh_token, encryptionKey) : null;

    debug('Credentials decrypted', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret, 
      hasRefreshToken: !!refreshToken 
    });

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(JSON.stringify({ error: 'Invalid Gmail credentials' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    try {
      debug('Getting access token directly from Google OAuth API');
      // Get a new access token directly from Google OAuth API
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const tokenData = await tokenResponse.json();
      debug('Token response', { success: tokenResponse.ok, status: tokenResponse.status });
      
      if (!tokenResponse.ok || !tokenData.access_token) {
        debug('Failed to get access token', tokenData);
        throw new Error('Failed to obtain access token: ' + (tokenData.error_description || tokenData.error || 'Unknown error'));
      }

      const accessToken = tokenData.access_token;
      debug('Access token obtained');

      // Build the Gmail search query
      let query = `from:${fromEmail}`;
      if (onlyUnread) {
        query += ' is:unread';
      }
      
      debug('Searching emails with query', { query });
      
      // Search for messages matching the query
      const searchResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json();
        debug('Gmail API search error', errorData);
        throw new Error(`Gmail API error: ${JSON.stringify(errorData)}`);
      }

      const searchData = await searchResponse.json();
      
      if (!searchData.messages || searchData.messages.length === 0) {
        debug('No messages found matching the query');
        return new Response(JSON.stringify({ 
          messages: [] 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
      
      debug('Found messages', { count: searchData.messages.length });
      
      // Get the details of each message
      const messages = [];
      
      for (const message of searchData.messages.slice(0, maxResults)) {
        debug('Fetching message details', { messageId: message.id });
        
        const messageResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        
        if (!messageResponse.ok) {
          debug('Error fetching message details', { messageId: message.id, status: messageResponse.status });
          continue;
        }
        
        const messageData = await messageResponse.json();
        
        // Extract headers
        const headers = messageData.payload.headers.reduce((acc: any, header: any) => {
          acc[header.name.toLowerCase()] = header.value;
          return acc;
        }, {});
        
        // Extract message body
        let body = '';
        
        if (messageData.payload.parts) {
          // Multipart message
          for (const part of messageData.payload.parts) {
            if (part.mimeType === 'text/plain' && part.body.data) {
              body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              break;
            }
          }
        } else if (messageData.payload.body && messageData.payload.body.data) {
          // Simple message
          body = atob(messageData.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        
        messages.push({
          id: messageData.id,
          threadId: messageData.threadId,
          labelIds: messageData.labelIds,
          snippet: messageData.snippet,
          from: headers.from,
          to: headers.to,
          subject: headers.subject,
          date: headers.date,
          body: body,
        });
      }
      
      debug('Processed messages', { count: messages.length });
      
      // Store the output in the agent_outputs table
      if (messages.length > 0) {
        debug('Storing output in agent_outputs table');
        const { error: outputError } = await supabaseClient
          .from('agent_outputs')
          .upsert({
            user_id: user.id,
            workflow_id: elementId.split('-')[0], // Assuming elementId format is "workflowId-elementId"
            element_id: elementId,
            output_data: { 
              type: 'gmail_reader',
              messages: messages,
              metadata: {
                fromEmail,
                maxResults,
                onlyUnread,
                timestamp: new Date().toISOString()
              }
            },
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workflow_id,element_id'
          });

        if (outputError) {
          debug('Error storing output', outputError);
          // Continue anyway, this shouldn't block the response
        } else {
          debug('Output stored successfully');
        }
      }

      return new Response(JSON.stringify({ 
        messages 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('Gmail API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to read emails: ' + errorMessage
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