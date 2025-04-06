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

// Generate a random string for webhook secret
function generateSecret(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    result += chars.charAt(randomValues[i] % chars.length);
  }
  return result;
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
      accessToken,
      repository,
      regenerate
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      hasAccessToken: !!accessToken,
      repository,
      regenerate
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

    if (!accessToken) {
      return new Response(JSON.stringify({ 
        error: 'GitHub access token is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!repository) {
      return new Response(JSON.stringify({ 
        error: 'Repository name is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (!repository.includes('/')) {
      return new Response(JSON.stringify({ 
        error: 'Repository name must be in the format "owner/repo"' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    try {
      // Add this validation before creating the webhook
      const tokenCheckResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Workflow-Agent'
        }
      });
      
      if (!tokenCheckResponse.ok) {
        const errorData = await tokenCheckResponse.json();
        debug('Token validation failed', errorData);
        
        let errorMessage = `Invalid GitHub token: ${errorData.message || tokenCheckResponse.statusText}`;
        if (tokenCheckResponse.status === 401) {
          errorMessage = 'The GitHub token is invalid or has expired.';
        }
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: tokenCheckResponse.status
        });
      }
      
      // Check token scopes
      const scopes = tokenCheckResponse.headers.get('X-OAuth-Scopes') || '';
      const hasRepoScope = scopes.includes('repo');
      const hasHookScope = scopes.includes('admin:repo_hook') || scopes.includes('write:repo_hook');
      
      if (!hasRepoScope || !hasHookScope) {
        debug('Token missing required scopes', { scopes, hasRepoScope, hasHookScope });
        return new Response(JSON.stringify({ 
          error: `Your token is missing required scopes. Current scopes: ${scopes}. Required: repo, admin:repo_hook.`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        });
      }

      // Check if the user has access to the repository before creating a webhook
      const repoCheckResponse = await fetch(`https://api.github.com/repos/${repository}`, {
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Workflow-Agent'
        }
      });
      
      if (!repoCheckResponse.ok) {
        const errorData = await repoCheckResponse.json();
        debug('Repository access check failed', errorData);
        
        let errorMessage = `Cannot access repository: ${errorData.message || repoCheckResponse.statusText}`;
        if (repoCheckResponse.status === 404) {
          errorMessage = `Repository "${repository}" not found or you don't have access to it.`;
        }
        
        return new Response(JSON.stringify({ error: errorMessage }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: repoCheckResponse.status
        });
      }

      // If regenerating, delete the existing webhook first
      const agentConfig = await supabaseClient
        .from('agent_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'github_reader')
        .single();

      if (regenerate && agentConfig?.config?.webhookId) {
        try {
          debug('Deleting existing webhook', { webhookId: agentConfig.config.webhookId });
          
          const deleteResponse = await fetch(`https://api.github.com/repos/${repository}/hooks/${agentConfig.config.webhookId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `token ${accessToken}`,
              'Accept': 'application/vnd.github.v3+json',
              'User-Agent': 'Workflow-Agent'
            }
          });
          
          if (!deleteResponse.ok && deleteResponse.status !== 404) {
            debug('Failed to delete existing webhook', { 
              status: deleteResponse.status,
              statusText: deleteResponse.statusText
            });
            // Continue anyway - we'll create a new webhook
          }
        } catch (error) {
          debug('Error deleting webhook', error);
          // Continue anyway - we'll create a new webhook
        }
      }

      // Generate a webhook secret
      const webhookSecret = generateSecret();
      
      // Create a webhook URL using the Supabase Edge Function
      const webhookUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/github-webhook?elementId=${elementId}`;
      
      // Create the webhook on GitHub
      const webhookResponse = await fetch(`https://api.github.com/repos/${repository}/hooks`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Workflow-Agent'
        },
        body: JSON.stringify({
          name: 'web',
          active: true,
          events: ['push'],
          config: {
            url: webhookUrl,
            content_type: 'json',
            secret: webhookSecret,
            insecure_ssl: '0'
          }
        })
      });
      
      if (!webhookResponse.ok) {
        const errorData = await webhookResponse.json();
        debug('GitHub API error', errorData);
        
        let errorMessage = `GitHub API error: ${errorData.message || webhookResponse.statusText}`;
        
        // Add specific guidance for common errors
        if (errorData.message?.includes('Resource not accessible by personal access token')) {
          errorMessage += '. Your token lacks sufficient permissions. Please ensure your token has "repo" and "admin:repo_hook" scopes.';
        } else if (errorData.message?.includes('Not Found')) {
          errorMessage += '. Please check that the repository exists and you have access to it.';
        } else if (webhookResponse.status === 401) {
          errorMessage += '. Your token may be invalid or expired.';
        } else if (webhookResponse.status === 403) {
          errorMessage += '. You don\'t have permission to create webhooks on this repository.';
        }
        
        throw new Error(errorMessage);
      }
      
      const webhookData = await webhookResponse.json();
      
      // Update the agent configuration with the webhook details
      const { error: configError } = await supabaseClient
        .from('agent_configs')
        .upsert({
          user_id: user.id,
          element_id: elementId,
          agent_type: 'github_reader',
          config: {
            accessToken,
            repository,
            webhookId: webhookData.id,
            webhookUrl,
            webhookSecret,
            isAuthorized: true,
            updated_at: new Date().toISOString()
          }
        }, {
          onConflict: 'user_id,element_id'
        });
      
      if (configError) {
        debug('Error updating configuration', configError);
        return new Response(JSON.stringify({ 
          error: `Failed to update configuration: ${configError.message}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        webhookId: webhookData.id,
        webhookUrl,
        webhookSecret
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('GitHub API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to set up GitHub webhook: ' + errorMessage
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