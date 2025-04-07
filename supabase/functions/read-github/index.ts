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
      accessToken,
      repository,
      branch = 'main'
    } = await req.json()

    debug('Request parameters', { 
      elementId,
      hasAccessToken: !!accessToken,
      repository,
      branch
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

    // Get the access token from the database if not provided
    let finalAccessToken = accessToken;
    
    if (!finalAccessToken) {
      debug('Fetching GitHub access token from database');
      const { data: agentConfig, error: agentError } = await supabaseClient
        .from('agent_configs')
        .select('config')
        .eq('user_id', user.id)
        .eq('element_id', elementId)
        .eq('agent_type', 'github_reader')
        .maybeSingle();

      if (agentError) {
        debug('Error retrieving agent config', agentError);
        return new Response(JSON.stringify({ 
          error: `Failed to retrieve GitHub configuration: ${agentError.message}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        })
      }

      if (!agentConfig || !agentConfig.config || !agentConfig.config.accessToken) {
        debug('No GitHub access token found in config');
        return new Response(JSON.stringify({ 
          error: 'GitHub access token not found in configuration' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
      }

      finalAccessToken = agentConfig.config.accessToken;
      
      // If repository is not provided, get it from the config
      if (!repository && agentConfig.config.repository) {
        repository = agentConfig.config.repository;
      }
      
      // If branch is not provided, get it from the config
      if (branch === 'main' && agentConfig.config.branch) {
        branch = agentConfig.config.branch;
      }
    }

    // Validate repository
    if (!repository) {
      return new Response(JSON.stringify({ 
        error: 'Repository name is required' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    try {
      debug('Fetching commits from GitHub API');
      
      // Fetch commits from the GitHub API
      const commitsUrl = `https://api.github.com/repos/${repository}/commits?sha=${branch}&per_page=1`;
      
      const commitsResponse = await fetch(commitsUrl, {
        headers: {
          'Authorization': `token ${finalAccessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Workflow-Agent'
        }
      });
      
      if (!commitsResponse.ok) {
        const errorData = await commitsResponse.json();
        debug('GitHub API error', errorData);
        throw new Error(`GitHub API error: ${errorData.message || commitsResponse.statusText}`);
      }
      
      const commitsData = await commitsResponse.json();
      
      // Process the commits to extract relevant information
      const commits = commitsData.map(commit => {
        return {
          id: commit.sha,
          message: commit.commit.message,
          author: commit.commit.author.name,
          timestamp: commit.commit.author.date,
          url: commit.html_url,
          // Other commit details
        };
      });
      
      // Create a more focused summary for a single commit
      const summary = commits.length > 0 
        ? `Latest commit: "${commits[0].message}" by ${commits[0].author} on ${new Date(commits[0].timestamp).toLocaleString()}`
        : `No commits found in ${repository} on branch ${branch}`;
      
      // Store the result in the agent_outputs table
      const { error: outputError } = await supabaseClient
        .from('agent_outputs')
        .insert({
          user_id: user.id,
          element_id: elementId,
          output: {
            repoName: repository,
            branch: branch,
            commits: commits,
            summary: summary
          },
          created_at: new Date().toISOString()
        });
      
      if (outputError) {
        debug('Error storing output', outputError);
        // Non-critical error, continue
      }
      
      return new Response(JSON.stringify({ 
        success: true,
        repoName: repository,
        branch: branch,
        commits: commits,
        summary: summary
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } catch (error) {
      // Safely handle error object
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug('GitHub API error', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
      
      return new Response(JSON.stringify({ 
        error: 'Failed to fetch GitHub data: ' + errorMessage
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