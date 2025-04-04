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
            elementId,
            keyType: 'gmail'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.refreshToken) {
          setIsAuthorized(true);
          setUserEmail(data.email || 'Your Gmail Account');
        }
      } catch (err) {
        console.log('No Gmail authorization found or error checking authorization');
      }
    };
    
    checkAuthorization();
  }, [session, elementId]);
  
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
  
  // Test sending an email
  const testAgent = async () => {
    if (!isAuthorized) {
      setError('You must authorize Gmail before sending emails');
      return;
    }
    
    if (!testRecipient.trim() || !testSubject.trim() || !testBody.trim()) {
      setError('Recipient, subject, and body are required for testing');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      // Call your Edge Function to send a test email
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          elementId, // Only send elementId, credentials will be fetched from the database
          to: testRecipient,
          subject: testSubject,
          body: testBody
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }
      
      setResponse('Email sent successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to test Gmail sender');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-4">Gmail Sender Configuration</h2>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          This agent allows you to send emails from your Gmail account. You'll need to authorize access to your Gmail account.
        </p>
        
        {isAuthorized ? (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md mb-4">
            <p className="text-green-700 font-medium">
              ✓ Gmail authorized
            </p>
            {userEmail && (
              <p className="text-sm text-green-600 mt-1">
                Connected account: {userEmail}
              </p>
            )}
          </div>
        ) : (
          <div className="mb-4">
            <button
              onClick={authorizeGmail}
              className="w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C16.827 16.3285 14.6115 18 12 18C8.6865 18 6 15.3135 6 12C6 8.6865 8.6865 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C6.4775 2 2 6.4775 2 12C2 17.5225 6.4775 22 12 22C17.5225 22 22 17.5225 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#FFC107"/>
                <path d="M3.15295 7.3455L6.43845 9.755C7.32745 7.554 9.48045 6 12 6C13.5295 6 14.921 6.577 15.9805 7.5195L18.809 4.691C17.023 3.0265 14.634 2 12 2C8.15895 2 4.82795 4.1685 3.15295 7.3455Z" fill="#FF3D00"/>
                <path d="M12 22C14.583 22 16.93 21.0115 18.7045 19.404L15.6095 16.785C14.5718 17.5742 13.3038 18.001 12 18C9.39903 18 7.19053 16.3415 6.35853 14.027L3.09753 16.5395C4.75253 19.778 8.11353 22 12 22Z" fill="#4CAF50"/>
                <path d="M21.8055 10.0415H21V10H12V14H17.6515C17.2571 15.1082 16.5467 16.0766 15.608 16.7855L15.6095 16.7845L18.7045 19.4035C18.4855 19.6025 22 17 22 12C22 11.3295 21.931 10.675 21.8055 10.0415Z" fill="#1976D2"/>
              </svg>
              Authorize with Gmail
            </button>
          </div>
        )}
      </div>
      
      {/* Test Email Section */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-md font-medium mb-3">Test Email</h3>
        
        {/* Test Recipient Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient Email
          </label>
          <input
            type="email"
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
          />
        </div>
        
        {/* Test Subject Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject
          </label>
          <input
            type="text"
            value={testSubject}
            onChange={(e) => setTestSubject(e.target.value)}
            placeholder="Test Email Subject"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
          />
        </div>
        
        {/* Test Body Input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Body
          </label>
          <textarea
            value={testBody}
            onChange={(e) => setTestBody(e.target.value)}
            placeholder="Enter your email content here..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
          />
        </div>
      </div>
      
      {/* Test Button */}
      <div className="mb-4">
        <button
          onClick={testAgent}
          disabled={isLoading || !isAuthorized}
          className={`w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 ${
            (isLoading || !isAuthorized) ? 'opacity-50 cursor-not-allowed' : ''
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
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
          {error}
        </div>
      )}
      
      {/* Response Output */}
      {response && (
        <div className="mb-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
          {response}
        </div>
      )}
    </div>
  );
} 