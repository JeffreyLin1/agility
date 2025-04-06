import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import InputStructureDisplay from './InputStructureDisplay';
import { runWorkflow } from '@/app/lib/workflowRunner';

interface DiscordMessengerConfigProps {
  elementId: string;
  onClose?: () => void;
}

export default function DiscordMessengerConfig({ elementId, onClose }: DiscordMessengerConfigProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const messageContentTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { session } = useAuth();
  
  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-agent-configs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-config',
            elementId,
            agentType: 'discord_messenger'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          if (data.config.webhookUrl) setWebhookUrl(data.config.webhookUrl);
          if (data.config.username) setUsername(data.config.username);
          if (data.config.avatarUrl) setAvatarUrl(data.config.avatarUrl);
          if (data.config.messageContent) setMessageContent(data.config.messageContent);
        }
      } catch (err) {
        console.log('No saved configuration found or error loading configuration');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Handle inserting fields from input structure
  const handleInsertField = (fieldPath: string) => {
    if (messageContentTextareaRef.current) {
      const textarea = messageContentTextareaRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;
      
      const newValue = 
        messageContent.substring(0, startPos) + 
        `${fieldPath}` + 
        messageContent.substring(endPos);
      
      setMessageContent(newValue);
      
      // Set focus back to the textarea
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = startPos + fieldPath.length + 4; // +4 for the {{ and }}
        textarea.selectionEnd = startPos + fieldPath.length + 4;
      }, 0);
    }
  };
  
  // Save configuration
  const saveConfiguration = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to save configuration');
      return;
    }
    
    if (!webhookUrl.trim()) {
      setError('Discord webhook URL is required');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-agent-configs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save-config',
          elementId,
          agentType: 'discord_messenger',
          config: {
            webhookUrl: webhookUrl.trim(),
            username: username.trim(),
            avatarUrl: avatarUrl.trim(),
            messageContent: messageContent.trim()
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Send a test message to Discord
  const sendTestMessage = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to send messages');
      return;
    }
    
    if (!webhookUrl.trim()) {
      setError('Discord webhook URL is required');
      return;
    }
    
    if (!messageContent.trim()) {
      setError('Message content is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-discord`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          webhookUrl: webhookUrl.trim(),
          username: username.trim(),
          avatarUrl: avatarUrl.trim(),
          content: messageContent.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send Discord message');
      }
      
      setResponse(`Message sent successfully to Discord`);
      
      // Save the configuration after successful test
      await saveConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to send Discord message');
    } finally {
      setIsLoading(false);
    }
  };

  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };

  return (
    <div className="font-mono">
      
      {/* Input Structure Display */}

        <InputStructureDisplay elementId={elementId} onInsertField={handleInsertField} />
      
      {/* Configuration Form */}
      <div className="space-y-5 mb-6">
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Discord Webhook URL <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="mt-1 text-xs text-black">
            Create a webhook in your Discord server settings and paste the URL here.
          </p>
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">Bot Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Workflow Bot"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="mt-1 text-xs text-black">
            Custom name for the webhook bot. Leave empty to use the webhook's default name.
          </p>
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">Avatar URL</label>
          <input
            type="text"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://example.com/avatar.png"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="mt-1 text-xs text-black">
            Custom avatar image URL. Leave empty to use the webhook's default avatar.
          </p>
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Message Content <span className="text-red-600">*</span>
          </label>
          <textarea
            ref={messageContentTextareaRef}
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            placeholder="Enter your message content here. Click on input fields above to insert variables."
            rows={5}
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
        </div>
      </div>
      
      {/* Buttons Container - Grid Layout */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Save Configuration Button */}
        <button
          onClick={saveConfiguration}
          disabled={isSaving || !webhookUrl.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm col-span-2 ${
            (isSaving || !webhookUrl.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isSaving ? 'SAVING...' : 'SAVE CONFIG'}
        </button>
        
        {/* Test Agent Button */}
        <button
          onClick={sendTestMessage}
          disabled={isLoading || !webhookUrl.trim() || !messageContent.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isLoading || !webhookUrl.trim() || !messageContent.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              SENDING...
            </span>
          ) : (
            'TEST AGENT'
          )}
        </button>
        
        {/* Test Workflow Button */}
        <button
          onClick={testWorkflow}
          disabled={isWorkflowRunning || !webhookUrl.trim() || !messageContent.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isWorkflowRunning || !webhookUrl.trim() || !messageContent.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isWorkflowRunning ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              RUNNING...
            </span>
          ) : (
            'TEST WORKFLOW'
          )}
        </button>
      </div>
      
      {/* Saved Confirmation */}
      {isSaved && (
        <div className="mb-5 text-sm text-green-600 border-2 border-green-600 p-2 bg-green-50 font-bold rounded-sm">
          CONFIGURATION SAVED
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="mb-5 p-3 bg-white border-2 border-red-600 text-red-600 font-bold rounded-sm">
          <div className="flex">
            <span className="mr-2">⚠️</span>
            {error}
          </div>
        </div>
      )}
      
      {/* Success Message */}
      {response && (
        <div className="mb-5 p-3 bg-white border-2 border-green-600 text-green-600 font-bold rounded-sm">
          <div className="flex">
            <span className="mr-2">✓</span>
            {response}
          </div>
        </div>
      )}
    </div>
  );
} 