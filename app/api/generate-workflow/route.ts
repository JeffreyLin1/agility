import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// List of available agents to use in workflows
const availableAgents = [
  {
    id: '1',
    name: 'Text Generator',
    description: 'Generates text based on prompts',
    color: '#f0f9ff'
  },
  {
    id: '2',
    name: 'Image Analyzer',
    description: 'Analyzes images and extracts information',
    color: '#f0fdf4'
  },
  {
    id: '3',
    name: 'Data Processor',
    description: 'Processes and transforms data',
    color: '#fef2f2'
  },
  {
    id: '4',
    name: 'Decision Maker',
    description: 'Makes decisions based on input data',
    color: '#fffbeb'
  },
  {
    id: '5',
    name: 'Language Translator',
    description: 'Translates text between languages',
    color: '#f5f3ff'
  },
  {
    id: '6',
    name: 'Sentiment Analyzer',
    description: 'Analyzes sentiment in text',
    color: '#eff6ff'
  },
  {
    id: '7',
    name: 'Code Generator',
    description: 'Generates code based on requirements',
    color: '#ecfdf5'
  },
  {
    id: '8',
    name: 'Speech Recognizer',
    description: 'Converts speech to text',
    color: '#fef2f2'
  },
  {
    id: '9',
    name: 'Text Summarizer',
    description: 'Creates concise summaries of longer texts',
    color: '#fff7ed'
  },
  {
    id: '10',
    name: 'Entity Extractor',
    description: 'Identifies and extracts entities from text',
    color: '#f8fafc'
  },
  {
    id: '11',
    name: 'Image Generator',
    description: 'Creates images from text descriptions',
    color: '#f0fdfa'
  },
  {
    id: '12',
    name: 'Question Answerer',
    description: 'Answers questions based on context',
    color: '#faf5ff'
  },
  {
    id: '13',
    name: 'Data Visualizer',
    description: 'Creates visual representations of data',
    color: '#f0f9ff'
  },
  {
    id: '14',
    name: 'Audio Processor',
    description: 'Processes and analyzes audio files',
    color: '#f0fdf4'
  },
  {
    id: '15',
    name: 'Document Parser',
    description: 'Extracts structured data from documents',
    color: '#fef2f2'
  },
  {
    id: '16',
    name: 'Chatbot',
    description: 'Engages in conversational interactions',
    color: '#fffbeb'
  },
  {
    id: '17',
    name: 'Video Analyzer',
    description: 'Analyzes video content and extracts information',
    color: '#f5f3ff'
  },
  {
    id: '18',
    name: 'Recommendation Engine',
    description: 'Provides personalized recommendations',
    color: '#eff6ff'
  },
  {
    id: '19',
    name: 'Knowledge Base',
    description: 'Stores and retrieves information',
    color: '#ecfdf5'
  },
  {
    id: '20',
    name: 'Anomaly Detector',
    description: 'Identifies unusual patterns in data',
    color: '#fef2f2'
  }
];

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();
    
    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }
    
    const completion = await openai.chat.completions.create({
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
    
    const responseContent = completion.choices[0].message.content;
    
    if (!responseContent) {
      throw new Error('No response from OpenAI');
    }
    
    // Parse the JSON response
    const workflowData = JSON.parse(responseContent);
    
    // Map the generated elements to actual agents from our list
    const elements = workflowData.elements.map((element: any, index: number) => {
      // Find the matching agent from our available agents
      const matchingAgent = availableAgents.find(agent => 
        agent.name.toLowerCase() === element.name.toLowerCase()
      );
      
      if (!matchingAgent) {
        console.warn(`No matching agent found for: ${element.name}`);
        // Use a default agent if no match is found
        return {
          id: `element-${Date.now()}-${index}`,
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
        id: `element-${Date.now()}-${index}`,
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
        id: `connection-${Date.now()}-${i}`,
        sourceId: elements[i].id,
        targetId: elements[i + 1].id,
        type: 'default'
      });
    }
    
    return NextResponse.json({
      workflow: {
        elements,
        connections
      }
    });
  } catch (error) {
    console.error('Error generating workflow:', error);
    return NextResponse.json(
      { error: 'Failed to generate workflow' },
      { status: 500 }
    );
  }
}

// Helper function to generate random colors for nodes
function getRandomColor() {
  const colors = [
    '#FFD1DC', // Light Pink
    '#FFECB3', // Light Yellow
    '#E1BEE7', // Light Purple
    '#C8E6C9', // Light Green
    '#BBDEFB', // Light Blue
    '#D7CCC8', // Light Brown
  ];
  
  return colors[Math.floor(Math.random() * colors.length)];
} 