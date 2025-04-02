// @ts-ignore: Deno imports
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore: Deno imports
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// @ts-ignore: Deno imports
import OpenAI from 'https://esm.sh/openai@4.91.0';

// Import the agents
// @ts-ignore: Deno imports
import { availableAgents } from '../_shared/agents.ts';

function generateId(prefix: string, index: number): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}-${index}`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  try {
    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const apiKey = Deno.env.get('OPENAI_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ 
        error: 'API key not found in environment'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 500,
      });
    }

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Parse the request body
    let prompt;
    try {
      const body = await req.json();
      prompt = body.prompt;
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request body'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 400,
      });
    }

    if (!prompt) {
      return new Response(JSON.stringify({ 
        error: 'Prompt is required'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 400,
      });
    }

    // Make the OpenAI API call with error handling
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a workflow designer that creates agent-based workflows. 
            Generate a workflow based on the user's description using ONLY the following available agents:
            
            ${availableAgents.map(agent => `- ${agent.name}: ${agent.description}`).join('\n')}
            
            The workflow should be LINEAR (start to finish, left to right) with a clear beginning and end.
            Each element should use the exact name of one of the available agents.
            Connections should flow from left to right in a linear fashion.
            
            Return the result as a JSON object with:
            1. 'elements' array: Each element must have a 'name' that exactly matches one of the available agents
            2. 'connections' array: Each connection must specify 'sourceId' and 'targetId' to create a linear flow
            
            Keep the workflow focused and use 3-7 agents maximum.`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Failed to generate workflow with OpenAI'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 500,
      });
    }

    const responseContent = completion.choices[0].message.content;

    if (!responseContent) {
      return new Response(JSON.stringify({ 
        error: 'No response from OpenAI'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 500,
      });
    }

    // Parse the JSON response with error handling
    let workflowData;
    try {
      workflowData = JSON.parse(responseContent);
    } catch (e) {
      return new Response(JSON.stringify({ 
        error: 'Failed to parse OpenAI response'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 500,
      });
    }

    // Validate the response structure
    if (!workflowData.elements || !Array.isArray(workflowData.elements)) {
      return new Response(JSON.stringify({ 
        error: 'Invalid workflow structure from OpenAI'
      }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        },
        status: 500,
      });
    }
    
    // Map the generated elements to actual agents from our list
    const elements = workflowData.elements.map((element: any, index: number) => {
      // Find the matching agent from our available agents
      const matchingAgent = availableAgents.find(agent => 
        agent.name.toLowerCase() === element.name.toLowerCase()
      );

      if (!matchingAgent) {
        // Use a default agent if no match is found
        return {
          id: generateId('element', index),
          type: 'agent',
          agentId: '1', // Default to Text Generator
          position: { 
            x: 200 + (index * 250), // Position horizontally with spacing
            y: 300 // All at the same vertical position
          },
          data: {
            name: 'Text Generator',
            description: 'Generates text based on prompts',
            color: '#f0f9ff',
          }
        };
      }

      return {
        id: generateId('element', index),
        type: 'agent',
        agentId: matchingAgent.id,
        position: { 
          x: 200 + (index * 250), // Position horizontally with spacing
          y: 300 // All at the same vertical position
        },
        data: {
          name: matchingAgent.name,
          description: matchingAgent.description,
          color: matchingAgent.color,
        }
      };
    });

    // Create connections between adjacent elements for a linear flow
    const connections = [];
    for (let i = 0; i < elements.length - 1; i++) {
      connections.push({
        id: generateId('connection', i),
        sourceId: elements[i].id,
        targetId: elements[i + 1].id,
        type: 'default'
      });
    }

    return new Response(
      JSON.stringify({
        workflow: {
          elements,
          connections
        }
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to generate workflow' }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }, 
        status: 500 
      }
    );
  }
}); 