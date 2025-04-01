import { Workflow } from '@/app/types';
import Button from '../ui/Button';

interface CanvasToolbarProps {
  workflow: Workflow;
  selectedElementId: string | null;
  onWorkflowChange?: (workflow: Workflow) => void;
  onElementDelete?: () => void;
}

export default function CanvasToolbar({ 
  workflow, 
  selectedElementId,
  onWorkflowChange,
  onElementDelete
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-white border-b border-gray-200 mb-0">
      <div className="flex items-center space-x-3">
        <Button variant="outline">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M12 5v14M5 12h14"></path>
          </svg>
          Add Agent
        </Button>
        <Button 
          variant="secondary" 
          disabled={!selectedElementId}
          onClick={onElementDelete}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Remove
        </Button>
      </div>
      <div>
        <Button variant="primary">Save Workflow</Button>
      </div>
    </div>
  );
} 