'use client';

import { useState } from 'react';
import { useAuth, UserRole } from '@/lib/auth-context';
import { ProtectedRoute } from '@/components/auth/protected-route';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSBadge } from '@/components/ui/ios-badge';
import { 
  Workflow, CheckCircle, Clock, ArrowRight, Settings, Plus,
  Bed, Sparkles, Eye, Wrench, ClipboardCheck
} from 'lucide-react';

interface WorkflowStep {
  id: string;
  name: string;
  icon: any;
  duration: number;
  required: boolean;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  estimatedTime: number;
  isActive: boolean;
}

const defaultWorkflows: WorkflowTemplate[] = [
  {
    id: '1',
    name: 'Checkout Clean',
    description: 'Full room cleaning after guest checkout',
    estimatedTime: 45,
    isActive: true,
    steps: [
      { id: 's1', name: 'Strip bedding', icon: Bed, duration: 5, required: true },
      { id: 's2', name: 'Clean bathroom', icon: Sparkles, duration: 15, required: true },
      { id: 's3', name: 'Vacuum & mop', icon: Sparkles, duration: 10, required: true },
      { id: 's4', name: 'Make bed', icon: Bed, duration: 5, required: true },
      { id: 's5', name: 'Restock amenities', icon: ClipboardCheck, duration: 5, required: true },
      { id: 's6', name: 'Final inspection', icon: Eye, duration: 5, required: true },
    ],
  },
  {
    id: '2',
    name: 'Stayover Clean',
    description: 'Daily cleaning for occupied rooms',
    estimatedTime: 25,
    isActive: true,
    steps: [
      { id: 's1', name: 'Make bed', icon: Bed, duration: 5, required: true },
      { id: 's2', name: 'Clean bathroom', icon: Sparkles, duration: 10, required: true },
      { id: 's3', name: 'Empty trash', icon: Sparkles, duration: 2, required: true },
      { id: 's4', name: 'Restock amenities', icon: ClipboardCheck, duration: 3, required: true },
      { id: 's5', name: 'Vacuum if needed', icon: Sparkles, duration: 5, required: false },
    ],
  },
  {
    id: '3',
    name: 'Deep Clean',
    description: 'Thorough cleaning including hard-to-reach areas',
    estimatedTime: 90,
    isActive: true,
    steps: [
      { id: 's1', name: 'Move furniture', icon: Wrench, duration: 10, required: true },
      { id: 's2', name: 'Deep clean carpets', icon: Sparkles, duration: 20, required: true },
      { id: 's3', name: 'Clean behind furniture', icon: Sparkles, duration: 15, required: true },
      { id: 's4', name: 'Sanitize all surfaces', icon: Sparkles, duration: 15, required: true },
      { id: 's5', name: 'Clean windows', icon: Sparkles, duration: 10, required: true },
      { id: 's6', name: 'Replace furniture', icon: Wrench, duration: 10, required: true },
      { id: 's7', name: 'Final inspection', icon: Eye, duration: 10, required: true },
    ],
  },
  {
    id: '4',
    name: 'Turndown Service',
    description: 'Evening room preparation',
    estimatedTime: 10,
    isActive: true,
    steps: [
      { id: 's1', name: 'Turn down bed', icon: Bed, duration: 2, required: true },
      { id: 's2', name: 'Close curtains', icon: ClipboardCheck, duration: 1, required: true },
      { id: 's3', name: 'Place chocolates', icon: ClipboardCheck, duration: 1, required: true },
      { id: 's4', name: 'Refresh towels', icon: Sparkles, duration: 3, required: false },
      { id: 's5', name: 'Tidy room', icon: Sparkles, duration: 3, required: true },
    ],
  },
];

export default function HousekeepingWorkflowsPage() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowTemplate[]>(defaultWorkflows);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowTemplate | null>(null);

  return (
    <ProtectedRoute allowedRoles={[UserRole.HOUSEKEEPING_SUPERVISOR, UserRole.SUPER_ADMIN, UserRole.GENERAL_MANAGER, UserRole.BRANCH_MANAGER]}>
      <DashboardLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Cleaning Workflows</h1>
              <p className="text-gray-500">Standardized cleaning procedures and checklists</p>
            </div>
            <IOSButton>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </IOSButton>
          </div>

          {/* Workflow Cards */}
          <div className="grid md:grid-cols-2 gap-6">
            {workflows.map((workflow) => (
              <IOSCard 
                key={workflow.id} 
                className={`p-6 cursor-pointer transition hover:shadow-lg ${selectedWorkflow?.id === workflow.id ? 'ring-2 ring-blue-500' : ''}`}
                onClick={() => setSelectedWorkflow(workflow)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg">{workflow.name}</h3>
                    <p className="text-sm text-gray-500">{workflow.description}</p>
                  </div>
                  <IOSBadge variant={workflow.isActive ? 'success' : 'neutral'}>
                    {workflow.isActive ? 'Active' : 'Inactive'}
                  </IOSBadge>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {workflow.estimatedTime} min
                  </span>
                  <span className="flex items-center gap-1">
                    <ClipboardCheck className="h-4 w-4" />
                    {workflow.steps.length} steps
                  </span>
                </div>

                {/* Steps Preview */}
                <div className="flex flex-wrap gap-2">
                  {workflow.steps.slice(0, 4).map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.id} className="flex items-center gap-1 text-xs bg-gray-100 px-2 py-1 rounded">
                        <Icon className="h-3 w-3" />
                        <span>{step.name}</span>
                      </div>
                    );
                  })}
                  {workflow.steps.length > 4 && (
                    <span className="text-xs text-gray-500">+{workflow.steps.length - 4} more</span>
                  )}
                </div>
              </IOSCard>
            ))}
          </div>

          {/* Selected Workflow Details */}
          {selectedWorkflow && (
            <IOSCard className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">{selectedWorkflow.name}</h2>
                  <p className="text-gray-500">{selectedWorkflow.description}</p>
                </div>
                <IOSButton variant="secondary" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </IOSButton>
              </div>

              {/* Steps Timeline */}
              <div className="space-y-4">
                {selectedWorkflow.steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={step.id} className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${step.required ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Icon className={`h-5 w-5 ${step.required ? 'text-blue-600' : 'text-gray-500'}`} />
                        </div>
                        {index < selectedWorkflow.steps.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{step.name}</p>
                            <p className="text-sm text-gray-500">{step.duration} minutes</p>
                          </div>
                          {step.required ? (
                            <IOSBadge variant="info">Required</IOSBadge>
                          ) : (
                            <IOSBadge variant="neutral">Optional</IOSBadge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 pt-6 border-t flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="h-5 w-5" />
                  <span>Total estimated time: <strong>{selectedWorkflow.estimatedTime} minutes</strong></span>
                </div>
                <IOSButton>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Use This Workflow
                </IOSButton>
              </div>
            </IOSCard>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  );
}
