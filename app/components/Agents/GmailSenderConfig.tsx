import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

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
  
  const { session } = useAuth();
  
  // Check if Gmail is already authorized
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!session?.access_token) return;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-api-keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            action: 'get',
            keyType: 'gmail'
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
    } catch (err: any) {
      setError(err.message || 'Failed to send email');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Gmail Sender Configuration</h2>
      
      {/* Authorization Status */}
      <div className={`mb-4 p-4 rounded-md border ${isAuthorized ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              {isAuthorized ? (
                <>
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <p className="font-medium text-blue-800">Connected to Gmail</p>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 bg-amber-500 rounded-full mr-2"></div>
                  <p className="font-medium text-amber-800">Gmail connection required</p>
                </>
              )}
            </div>
            {isAuthorized && userEmail && (
              <p className="text-sm text-blue-700 mt-1 ml-5">
                Using account: <span className="font-medium">{userEmail}</span>
              </p>
            )}
          </div>
          <button
            onClick={authorizeGmail}
            className={`px-3 py-1.5 text-white text-sm font-medium rounded-md ${
              isAuthorized 
                ? 'bg-blue-600 hover:bg-blue-700' 
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isAuthorized ? 'Reconnect Account' : 'Connect Gmail'}
          </button>
        </div>
      </div>
      
      {/* Test Email Form */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Recipient Email</label>
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Subject</label>
          <input
            type="text"
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            placeholder="Email subject"
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1 text-black">Email Body</label>
          <textarea
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            placeholder="Email content..."
            rows={5}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
          />
        </div>
      </div>
      
      {/* Action Button */}
      <div className="mb-4">
        <button
          onClick={sendTestEmail}
          disabled={isLoading || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()}
          className={`w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 ${
            (isLoading || !isAuthorized || !testRecipient.trim() || !testSubject.trim() || !testBody.trim()) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending...
            </span>
          ) : (
            'Send Test Email'
          )}
        </button>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {/* Response Output */}
      {response && (
        <div className="mb-2 p-3 bg-green-100 border border-green-300 text-green-800 rounded-md">
          <div className="flex">
            <svg className="h-5 w-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            {response}
          </div>
        </div>
      )}
    </div>
  );
} 