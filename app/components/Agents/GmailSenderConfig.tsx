import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';

interface GmailSenderConfigProps {
  elementId: string;
  onClose?: () => void;
}

export default function GmailSenderConfig({ elementId, onClose }: GmailSenderConfigProps) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [testRecipient, setTestRecipient] = useState('');
  const [testSubject, setTestSubject] = useState('');
  const [testBody, setTestBody] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const { session } = useAuth();
  
  // Load the Gmail credentials using the Edge Function
  useEffect(() => {
    const loadConfig = async () => {
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
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Gmail credentials');
        }
        
        if (data.clientId) setClientId(data.clientId);
        if (data.clientSecret) setClientSecret(data.clientSecret);
        if (data.refreshToken) setRefreshToken(data.refreshToken);
      } catch (err) {
        console.log('No saved Gmail credentials found or error loading credentials');
      }
    };
    
    loadConfig();
  }, [session, elementId]);
  
  // Save the Gmail credentials using the Edge Function
  const saveCredentials = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !refreshToken.trim()) {
      setError('All Gmail credentials are required');
      return;
    }
    
    if (!session?.access_token) {
      setError('You must be logged in to save credentials');
      return;
    }
    
    setIsSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/manage-api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          action: 'save',
          elementId,
          keyType: 'gmail',
          clientId,
          clientSecret,
          refreshToken
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save Gmail credentials');
      }
      
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save Gmail credentials');
    } finally {
      setIsSaving(false);
    }
  };
  
  const testAgent = async () => {
    if (!clientId.trim() || !clientSecret.trim() || !refreshToken.trim()) {
      setError('All Gmail credentials are required');
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
          clientId,
          clientSecret,
          refreshToken,
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
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-bold text-lg text-black">Gmail Sender</h3>
        <p className="text-sm text-gray-600">Configure your Gmail Sender agent</p>
      </div>
      
      {/* Client ID Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Google Client ID
        </label>
        <input
          type="text"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Your Google Client ID"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
        />
      </div>
      
      {/* Client Secret Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Google Client Secret
        </label>
        <input
          type="password"
          value={clientSecret}
          onChange={(e) => setClientSecret(e.target.value)}
          placeholder="Your Google Client Secret"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
        />
      </div>
      
      {/* Refresh Token Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Gmail Refresh Token
        </label>
        <input
          type="password"
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          placeholder="Your Gmail Refresh Token"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black text-black"
        />
        <p className="mt-1 text-xs text-gray-500">
          <a 
            href="https://developers.google.com/gmail/api/auth/about-auth" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            How to get Gmail credentials
          </a>
        </p>
      </div>
      
      <div className="mt-2 mb-4 flex justify-end">
        <button
          onClick={saveCredentials}
          disabled={isSaving}
          className={`px-3 py-1 text-sm font-medium rounded-md bg-black text-white hover:bg-gray-800 ${
            isSaving ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save Configuration'}
        </button>
      </div>
      
      <div className="border-t border-gray-200 my-4 pt-4">
        <h4 className="font-medium text-black mb-2">Test Email</h4>
        
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
          disabled={isLoading}
          className={`w-full px-4 py-2 bg-black text-white font-medium rounded-md hover:bg-gray-800 ${
            isLoading ? 'opacity-50 cursor-not-allowed' : ''
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