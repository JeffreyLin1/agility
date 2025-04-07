import { useState, useEffect } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { runWorkflow } from '@/app/lib/workflowRunner';
import InputStructureDisplay from './InputStructureDisplay';

interface GitHubReaderConfigProps {
  elementId: string;
  onClose?: () => void;
}

interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes?: number;
  patch?: string | null;
}

export default function GitHubReaderConfig({ elementId, onClose }: GitHubReaderConfigProps) {
  const [accessToken, setAccessToken] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('main');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isWorkflowRunning, setIsWorkflowRunning] = useState(false);
  const [commits, setCommits] = useState<any[]>([]);
  
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
            agentType: 'github_reader'
          })
        });
        
        const data = await response.json();
        
        if (response.ok && data.config) {
          if (data.config.accessToken) setAccessToken(data.config.accessToken);
          if (data.config.repository) setRepository(data.config.repository);
          if (data.config.branch) setBranch(data.config.branch);
          if (data.config.webhookSecret) setWebhookSecret(data.config.webhookSecret);
          if (data.config.webhookUrl) setWebhookUrl(data.config.webhookUrl);
          if (data.config.isAuthorized) setIsAuthorized(data.config.isAuthorized);
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
    
    if (!accessToken.trim()) {
      setError('GitHub access token is required');
      return;
    }
    
    if (!repository.trim()) {
      setError('Repository name is required');
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
          agentType: 'github_reader',
          config: {
            accessToken: accessToken.trim(),
            repository: repository.trim(),
            branch: branch.trim(),
            webhookSecret: webhookSecret.trim(),
            webhookUrl: webhookUrl.trim(),
            isAuthorized: true
          }
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration');
      }
      
      setIsAuthorized(true);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Test the GitHub reader
  const testGitHubReader = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to test the GitHub reader');
      return;
    }
    
    if (!accessToken.trim()) {
      setError('GitHub access token is required');
      return;
    }
    
    if (!repository.trim()) {
      setError('Repository name is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setCommits([]);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/read-github`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          accessToken,
          repository,
          branch
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to read GitHub repository');
      }
      
      setCommits(data.commits || []);
      setResponse(`Successfully retrieved ${data.commits?.length || 0} commits from ${repository}`);
    } catch (err: any) {
      setError(err.message || 'Failed to test GitHub reader');
    } finally {
      setIsLoading(false);
    }
  };
  
  const testWorkflow = async () => {
    await runWorkflow(elementId, session, setIsWorkflowRunning);
  };
  
  const generateWebhook = async () => {
    if (!session?.access_token) {
      setError('You must be logged in to generate a webhook');
      return;
    }
    
    if (!accessToken.trim()) {
      setError('GitHub access token is required');
      return;
    }
    
    if (!repository.trim()) {
      setError('Repository name is required');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/setup-github-webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          elementId,
          accessToken,
          repository,
          regenerate: webhookUrl ? true : false
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        if (data.partialSuccess) {
          setResponse(data.message || 'Configuration saved without webhook');
          setError(data.error || 'Failed to set up GitHub webhook');
        } else {
          throw new Error(data.error || 'Failed to set up GitHub webhook');
        }
      } else {
        setWebhookUrl(data.webhookUrl || '');
        setWebhookSecret(data.webhookSecret || '');
        setResponse(webhookUrl ? 'Successfully regenerated GitHub webhook' : 'Successfully set up GitHub webhook');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set up GitHub webhook');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleInsertField = (fieldPath: string) => {
    console.log('Field path to insert:', fieldPath);
  };
  
  return (
    <div className="font-mono">
      <div className="space-y-5 mb-6">
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            GitHub Personal Access Token <span className="text-red-600">*</span>
          </label>
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="text-xs text-gray-500 mt-1">
            Create a token with 'repo' scope at <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline">GitHub Settings</a>
          </p>
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Repository <span className="text-red-600">*</span>
          </label>
          <input
            type="text"
            value={repository}
            onChange={(e) => setRepository(e.target.value)}
            placeholder="username/repository"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="text-xs text-gray-500 mt-1">
            Format: username/repository (e.g., octocat/Hello-World)
          </p>
        </div>
        
        <div>
          <label className="block font-bold mb-2 text-black uppercase text-sm">
            Branch
          </label>
          <input
            type="text"
            value={branch}
            onChange={(e) => setBranch(e.target.value)}
            placeholder="main"
            className="w-full p-3 border-2 border-black rounded-sm focus:ring-0 focus:outline-none focus:border-black text-black"
          />
          <p className="text-xs text-gray-500 mt-1">
            Default: main
          </p>
        </div>
      </div>
      
      {/* Input Structure Display */}
      <InputStructureDisplay elementId={elementId} onInsertField={handleInsertField} />
      
      {/* Webhook Status Section */}
      <div className="mb-6 p-4 border-2 border-black rounded-sm">
        <h3 className="font-bold text-black uppercase text-sm mb-3">Webhook Status</h3>
        
        {webhookUrl ? (
          <div className="space-y-3">
            <div className="flex items-center">
              <span className="mr-2 text-green-600">✓</span>
              <span className="font-bold text-black">Webhook is set up</span>
            </div>
            
            <div>
              <label className="block font-bold mb-1 text-black text-xs uppercase">Webhook URL</label>
              <div className="flex">
                <input
                  type="text"
                  value={webhookUrl}
                  readOnly
                  className="w-full p-2 border-2 border-black rounded-sm bg-gray-50 text-gray-600 text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    setResponse("Webhook URL copied to clipboard");
                    setTimeout(() => setResponse(null), 3000);
                  }}
                  className="ml-2 px-3 py-2 bg-white border-2 border-black text-black text-sm font-bold hover:bg-gray-100"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div>
              <label className="block font-bold mb-1 text-black text-xs uppercase">Webhook Secret</label>
              <div className="flex">
                <input
                  type="password"
                  value={webhookSecret}
                  readOnly
                  className="w-full p-2 border-2 border-black rounded-sm bg-gray-50 text-gray-600 text-sm"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(webhookSecret);
                    setResponse("Webhook secret copied to clipboard");
                    setTimeout(() => setResponse(null), 3000);
                  }}
                  className="ml-2 px-3 py-2 bg-white border-2 border-black text-black text-sm font-bold hover:bg-gray-100"
                  title="Copy to clipboard"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                This secret is used to verify webhook payloads from GitHub.
              </p>
            </div>
            
            <div className="pt-2">
              <button
                onClick={generateWebhook}
                className="px-4 py-2 bg-white text-black font-bold border-2 border-black hover:bg-gray-100 text-sm uppercase tracking-wide rounded-sm"
              >
                Regenerate Webhook
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center">
              <span className="mr-2 text-yellow-600">⚠️</span>
              <span className="font-bold text-black">Webhook not set up</span>
            </div>
            
            <p className="text-sm text-gray-600">
              Setting up a webhook allows your workflow to automatically trigger when changes are pushed to your repository.
            </p>
            
            <div className="pt-2">
              <button
                onClick={generateWebhook}
                disabled={isLoading || !accessToken.trim() || !repository.trim()}
                className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm w-full ${
                  (isLoading || !accessToken.trim() || !repository.trim()) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                style={{ backgroundColor: 'white', color: 'black', fontWeight: 'bold' }}
              >
                {isLoading ? 'SETTING UP...' : 'SET UP WEBHOOK'}
              </button>
            </div>
            
            <div className="pt-1">
              <p className="text-xs text-gray-500">
                Note: Your GitHub token must have <span className="font-bold">repo</span> and <span className="font-bold">admin:repo_hook</span> permissions.
              </p>
            </div>
          </div>
        )}
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
          onClick={testGitHubReader}
          disabled={isLoading || !accessToken.trim() || !repository.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isLoading || !accessToken.trim() || !repository.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
          disabled={isWorkflowRunning || !accessToken.trim() || !repository.trim()}
          className={`px-4 py-3 bg-white !bg-white text-black font-bold border-2 border-black hover:bg-gray-100 uppercase tracking-wide rounded-sm ${
            (isWorkflowRunning || !accessToken.trim() || !repository.trim()) ? 'opacity-50 cursor-not-allowed' : ''
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
      
      {/* Commits Display */}
      {commits.length > 0 && (
        <div className="mb-5">
          <h3 className="font-bold text-black uppercase text-sm mb-3">Recent Commits</h3>
          <div className="border-2 border-black rounded-sm overflow-hidden">
            {commits.map((commit, index) => (
              <div key={commit.id || index} className={`p-3 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <div className="font-bold text-black">{commit.message}</div>
                <div className="text-sm text-gray-600">
                  <span>{commit.author}</span> • <span>{new Date(commit.timestamp).toLocaleString()}</span>
                </div>
                {commit.files && commit.files.length > 0 && (
                  <div className="mt-2 text-xs">
                    <div className="font-bold text-gray-700">Files changed: {commit.files.length}</div>
                    <ul className="list-disc list-inside">
                      {commit.files.slice(0, 3).map((file: CommitFile, fileIndex) => (
                        <li key={fileIndex} className="text-gray-600">
                          {file.filename} ({file.status}: +{file.additions} -{file.deletions})
                        </li>
                      ))}
                      {commit.files.length > 3 && (
                        <li className="text-gray-600">...and {commit.files.length - 3} more files</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 