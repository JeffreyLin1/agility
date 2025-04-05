import { toast } from 'react-hot-toast';
import { useToast } from '@/app/components/ui/Toast';

// Create a wrapper function that can be used outside of React components
let showToastFunction: (message: string, type: 'success' | 'error' | 'info') => void = 
  (message, type) => toast(message);

export function setToastFunction(fn: (message: string, type: 'success' | 'error' | 'info') => void) {
  showToastFunction = fn;
}

export async function runWorkflow(
  elementId: string, 
  session: any, 
  setIsWorkflowRunning: (isRunning: boolean) => void
) {
  if (!session?.access_token) {
    showToastFunction('You must be logged in to run a workflow', 'error');
    return;
  }
  
  setIsWorkflowRunning(true);
  
  try {
    // Show loading toast
    showToastFunction('Running workflow...', 'info');
    
    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/run-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        startElementId: elementId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `Failed to run workflow (Status: ${response.status})`);
    }
    
    // Count the number of steps executed
    const stepsExecuted = data.results?.length || 0;
    
    // Create a success message with details
    showToastFunction(`Workflow completed successfully! (${stepsExecuted} steps executed)`, 'success');
    
    // Store the results in localStorage for debugging
    try {
      localStorage.setItem('lastWorkflowResults', JSON.stringify(data.results));
    } catch (e) {
      console.warn('Could not save workflow results to localStorage', e);
    }
    
    return data;
  } catch (err: any) {
    console.error('Error running workflow:', err);
    showToastFunction(`Workflow failed: ${err.message || 'Unknown error'}`, 'error');
  } finally {
    setIsWorkflowRunning(false);
  }
} 