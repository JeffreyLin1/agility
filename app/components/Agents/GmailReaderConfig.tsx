import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { runWorkflow } from '@/app/lib/workflowRunner';

interface GmailReaderConfigProps {
  elementId: string;
  onClose: () => void;
}

export default function GmailReaderConfig({ elementId, onClose }: GmailReaderConfigProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [fromEmail, setFromEmail] = useState('');
  const [maxResults, setMaxResults] = useState(5);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [setAsTrigger, setSetAsTrigger] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const { session } = useAuth();
  
  // Check if Gmail is already authorized
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-credentials'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.isAuthorized) {
          setIsAuthorized(true);
          setUserEmail(data.email || 'Your Gmail Account');
        }
      } catch (err) {
        console.log('No Gmail authorization found or error checking authorization');
      }
    };
    
    checkAuthorization();
  }, [session]);

  // Load saved configuration
  useEffect(() => {
    const loadConfig = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get-config',
            elementId,
            agentType: 'gmail_reader'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          if (data.config.fromEmail) setFromEmail(data.config.fromEmail);
          if (data.config.maxResults) setMaxResults(data.config.maxResults);
          if (data.config.onlyUnread !== undefined) setOnlyUnread(data.config.onlyUnread);
          if (data.config.setAsTrigger !== undefined) setSetAsTrigger(data.config.setAsTrigger);
        }
      } catch (err) {
        console.log('No saved configuration found or error loading configuration');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Save configuration
  const saveConfiguration = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to save configuration');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-gmail-credentials`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save-config',
          elementId,
          agentType: 'gmail_reader',
          config: {
            fromEmail: fromEmail.trim(),
            maxResults,
            onlyUnread,
            setAsTrigger,
            gmail_authorized: isAuthorized
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
  
  // Start the OAuth flow
  const authorizeGmail = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to authorize Gmail');
      return;
    }
    
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gmail-oauth?action=authorize&state=${elementId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to start Gmail authorization');
      }
      
      // Redirect to Google's authorization page
      window.location.href = data.authUrl;
    } catch (err: any) {
      setError(err.message || 'Failed to start Gmail authorization');
    }
  };
  
  // Read emails from Gmail
  const readEmails = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to read emails');
      return;
    }
    
    if (!isAuthorized) {
      setError('You must authorize Gmail first');
      return;
    }
    
    if (!fromEmail.trim()) {
      setError('Sender email address is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setMessages([]);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/read-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          fromEmail: fromEmail.trim(),
          maxResults,
          onlyUnread
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to read emails');
      }
      
      setMessages(data.messages || []);
      if (data.messages.length === 0) {
        setError(`No emails found from ${fromEmail}`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to read emails');
    } finally {
      setIsLoading(false);
    }
  };

  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };

  return (
    <div className="font-mono">
      {/* Authorization Status */}
      <div className={`mb-5 p-4 rounded-sm border-2 ${isAuthorized ? 'border-black bg-white' : 'border-black bg-white'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              {isAuthorized ? (
                <>
                  <div className="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
                  <p className="font-bold text-black uppercase text-sm">Connected to Gmail</p>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-red-600 rounded-full mr-2"></div>
                  <p className="font-bold text-black uppercase text-sm">Gmail connection required</p>
                </>
              )}
            </div>
            {isAuthorized && userEmail && (
              <p className="text-sm text-black mt-1 ml-5">
                Using account: <span className="font-bold">{userEmail}</span>
              </p>
            )}
          </div>
          <button
            onClick={authorizeGmail}
            className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm`}
            style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
          >
            {isAuthorized ? 'RECONNECT ACCOUNT' : 'CONNECT GMAIL'}
          </button>
        </div>
      </div>
      
      {/* Configuration Form */}
      <div className="space-y-5 mb-6">
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Search for emails from <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="sender@example.com"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">Maximum results</label>
          <input
            type="number"
            value={maxResults}
            onChange={(e) => setMaxResults(parseInt(e.target.value) || 5)}
            min="1"
            max="50"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="onlyUnread"
            checked={onlyUnread}
            onChange={(e) => setOnlyUnread(e.target.checked)}
            className="h-5 w-5 text-black focus:ring-0 border-2 border-black rounded-sm"
          />
          <label htmlFor="onlyUnread" className="ml-2 font-bold text-black uppercase text-sm">Only show unread emails</label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="setAsTrigger"
            checked={setAsTrigger}
            onChange={(e) => setSetAsTrigger(e.target.checked)}
            className="h-5 w-5 text-black focus:ring-0 border-2 border-black rounded-sm"
          />
          <label htmlFor="setAsTrigger" className="ml-2 font-bold text-black uppercase text-sm">
            Set as workflow trigger
          </label>
        </div>
        {setAsTrigger && (
          <p className="mt-1 text-xs text-black ml-7">
            This agent will automatically start the workflow when new emails arrive
          </p>
        )}
      </div>
      
      {/* Buttons Container - Grid Layout */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* Save Configuration Button */}
        <button
          onClick={saveConfiguration}
          disabled={isSaving || !fromEmail.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm col-span-2 ${
            (isSaving || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isSaving ? 'SAVING...' : 'SAVE CONFIG'}
        </button>
        
        {/* Test Agent Button */}
        <button
          onClick={readEmails}
          disabled={isLoading || !isAuthorized || !fromEmail.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isLoading || !isAuthorized || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              LOADING...
            </span>
          ) : (
            'TEST AGENT'
          )}
        </button>
        
        {/* Test Workflow Button */}
        <button
          onClick={testWorkflow}
          disabled={isWorkflowRunning || !isAuthorized || !fromEmail.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isWorkflowRunning || !isAuthorized || !fromEmail.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
      
      {/* Email Results */}
      {messages.length > 0 && (
        <div className="mt-5 border-t-2 border-black pt-4">
          <h3 className="text-md font-bold mb-3 uppercase text-black">Emails from {fromEmail}</h3>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="p-3 border-2 border-black rounded-sm bg-white">
                <div className="font-bold text-black">{message.subject}</div>
                <div className="text-xs text-gray-600">{new Date(message.date).toLocaleString()}</div>
                <div className="mt-2 text-sm text-black">{message.snippet}...</div>
                <details className="mt-2">
                  <summary className="text-xs text-black cursor-pointer hover:underline font-bold">VIEW FULL MESSAGE</summary>
                  <div className="mt-2 p-3 bg-gray-50 text-sm whitespace-pre-line border-2 border-black rounded-sm text-black">
                    {message.body}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 