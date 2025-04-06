import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

// Verify GitHub webhook signature
async function verifySignature(payload: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const signatureHex = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const expectedSignature = `sha256=${signatureHex}`;
  
  return expectedSignature === signature;
}

serve(async (req) => {
  debug('GitHub webhook received');
  
  try {
    // Get the element ID from the query parameters
    const url = new URL(req.url);
    const elementId = url.searchParams.get('elementId');
    
    if (!elementId) {
      debug('No element ID provided');
      return new Response(JSON.stringify({ error: 'Element ID is required' }), {
        status: 400,
      });
    }
    
    // Get the GitHub signature from the headers
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) {
      debug('No signature provided');
      return new Response(JSON.stringify({ error: 'Signature is required' }), {
        status: 401,
      });
    }
    
    // Get the event type
    const event = req.headers.get('x-github-event');
    if (!event) {
      debug('No event type provided');
      return new Response(JSON.stringify({ error: 'Event type is required' }), {
        status: 400,
      });
    }
    
    // Only process push events
    if (event !== 'push') {
      debug('Ignoring non-push event', { event });
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        status: 200,
      });
    }
    
    // Get the payload
    const payload = await req.text();
    const data = JSON.parse(payload);
    
    debug('GitHub webhook payload received', {
      repository: data.repository?.full_name,
      ref: data.ref,
      commits: data.commits?.length || 0
    });
    
    // Create a Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Get the agent configuration to retrieve the webhook secret
    const { data: agentConfig, error: configError } = await supabaseAdmin
      .from('agent_configs')
      .select('config, user_id')
      .eq('element_id', elementId)
      .eq('agent_type', 'github_reader')
      .maybeSingle();
    
    if (configError) {
      debug('Error retrieving agent config', configError);
      return new Response(JSON.stringify({ error: 'Failed to retrieve configuration' }), {
        status: 500,
      });
    }
    
    if (!agentConfig || !agentConfig.config || !agentConfig.config.webhookSecret) {
      debug('No webhook secret found in config');
      return new Response(JSON.stringify({ error: 'Webhook secret not found' }), {
        status: 404,
      });
    }
    
    // Verify the signature
    const isValid = await verifySignature(payload, signature, agentConfig.config.webhookSecret);
    if (!isValid) {
      debug('Invalid signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
      });
    }
    
    // Process the push event
    const branch = data.ref.replace('refs/heads/', '');
    const repository = data.repository.full_name;
    
    // Extract commit information
    const commits = data.commits.map((commit: any) => ({
      id: commit.id,
      message: commit.message,
      author: commit.author.name,
      email: commit.author.email,
      timestamp: commit.timestamp,
      url: commit.url,
      files: {
        added: commit.added,
        removed: commit.removed,
        modified: commit.modified
      }
    }));
    
    // Calculate summary
    const totalFiles = commits.reduce((sum: number, commit: any) => {
      return sum + 
        (commit.files.added?.length || 0) + 
        (commit.files.removed?.length || 0) + 
        (commit.files.modified?.length || 0);
    }, 0);
    
    const summary = `${commits.length} commits with ${totalFiles} file changes`;
    
    // Store the result in the agent_outputs table
    const { error: outputError } = await supabaseAdmin
      .from('agent_outputs')
      .insert({
        user_id: agentConfig.user_id,
        element_id: elementId,
        output: {
          repoName: repository,
          branch: branch,
          commits: commits,
          summary: summary,
          pusher: data.pusher.name,
          timestamp: new Date().toISOString()
        },
        created_at: new Date().toISOString()
      });
    
    if (outputError) {
      debug('Error storing output', outputError);
      return new Response(JSON.stringify({ error: 'Failed to store output' }), {
        status: 500,
      });
    }
    
    // Trigger the workflow
    try {
      const workflowResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/run-workflow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
        },
        body: JSON.stringify({
          elementId,
          userId: agentConfig.user_id,
          triggerType: 'github_webhook'
        })
      });
      
      if (!workflowResponse.ok) {
        const errorData = await workflowResponse.json();
        debug('Error triggering workflow', errorData);
      } else {
        debug('Workflow triggered successfully');
      }
    } catch (error) {
      debug('Error triggering workflow', error);
      // Continue execution even if workflow trigger fails
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Webhook processed successfully'
    }), {
      status: 200,
    });
  } catch (error) {
    // Safely handle error object
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    debug('Error in webhook handler', { error: errorMessage, stack: error instanceof Error ? error.stack : 'No stack trace' });
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error: ' + errorMessage
    }), {
      status: 500,
    })
  }
}) 