import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import InputStructureDisplay from './InputStructureDisplay';
import { runWorkflow } from '@/app/lib/workflowRunner';

interface GmailSenderConfigProps {
  elementId: string;
  onClose?: () => void;
}

export default function GmailSenderConfig({ elementId, onClose }: GmailSenderConfigProps) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [testRecipient, setTestRecipient] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testBody, setTestBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  
  const { session } = useAuth();
  
  // Add refs for the subject and body inputs
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);
  
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
            agentType: 'gmail_sender'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          // Load saved test email settings if they exist
          if (data.config.testRecipient) setTestRecipient(data.config.testRecipient);
          if (data.config.testSubject) setTestSubject(data.config.testSubject);
          if (data.config.testBody) setTestBody(data.config.testBody);
        }
      } catch (err) {
        console.log('No saved configuration found or error loading configuration');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Handle inserting field into subject or body
  const handleInsertField = (fieldPath: string) => {
    // Determine which field is currently focused
    if (document.activeElement === subjectInputRef.current) {
      // Insert into subject field
      const input = subjectInputRef.current;
      const start = input?.selectionStart || 0;
      const end = input?.selectionEnd || 0;
      
      // Insert the field at cursor position or replace selected text
      const newSubject = testSubject.substring(0, start) + fieldPath + testSubject.substring(end);
      setTestSubject(newSubject);
      
      // Focus the input and set cursor position after the inserted field
      setTimeout(() => {
        if (input) {
          input.focus();
          const newCursorPosition = start + fieldPath.length;
          input.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    } else {
      // Default to inserting into body textarea
      const textarea = bodyTextareaRef.current;
      const start = textarea?.selectionStart || 0;
      const end = textarea?.selectionEnd || 0;
      
      // Insert the field at cursor position or replace selected text
      const newBody = testBody.substring(0, start) + fieldPath + testBody.substring(end);
      setTestBody(newBody);
      
      // Focus the textarea and set cursor position after the inserted field
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const newCursorPosition = start + fieldPath.length;
          textarea.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 0);
    }
  };
  
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
          agentType: 'gmail_sender',
          config: {
            testRecipient: testRecipient.trim(),
            testSubject: testSubject.trim(),
            testBody: testBody.trim(),
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
  
  // Send a test email
  const sendTestEmail = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to send emails');
      return;
    }
    
    if (!isAuthorized) {
      setError('You must authorize Gmail first');
      return;
    }
    
    if (!testRecipient.trim()) {
      setError('Recipient email address is required');
      return;
    }
    
    if (!testSubject.trim()) {
      setError('Subject is required');
      return;
    }
    
    if (!testBody.trim()) {
      setError('Email body is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          to: testRecipient.trim(),
          subject: testSubject.trim(),
          body: testBody.trim()
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }
      
      setResponse(`Email sent successfully to ${testRecipient}`);
      
      // Save the configuration after successful test
      await saveConfiguration();
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
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
          {!isAuthorized && (
            <button
              onClick={authorizeGmail}
              className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm`}
              style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
            >
              CONNECT GMAIL
            </button>
          )}
        </div>
      </div>
      
      {/* Configuration Form */}
      <div className="space-y-5 mb-6">
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Recipient Email <span className="text-red-600">*</span>
          </label>
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Subject <span className="text-red-600">*</span>
          </label>
          <input
            ref={subjectInputRef}
            type="text"
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            placeholder="Email subject (click on input fields above to insert variables)"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Email Body <span className="text-red-600">*</span>
          </label>
          <textarea
            ref={bodyTextareaRef}
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            placeholder="Email content... (click on input fields above to insert variables)"
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
          disabled={isSaving}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm col-span-2 ${
            isSaving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
          style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
        >
          {isSaving ? 'SAVING...' : 'SAVE CONFIG'}
        </button>
        
        {/* Test Agent Button */}
        <button
          onClick={sendTestEmail}
          disabled={isLoading || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isLoading || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
          disabled={isWorkflowRunning || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isWorkflowRunning || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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