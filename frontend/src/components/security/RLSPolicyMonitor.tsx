'use client';

import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Database, Eye, Lock } from 'lucide-react';
import { toast } from 'sonner';

interface RLSPolicy {
  table_name: string;
  policy_name: string;
  policy_type: string;
  enabled: boolean;
  last_violation?: string;
  violation_count: number;
}

export function RLSPolicyMonitor() {
  const [policies, setPolicies] = useState<RLSPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [violations, setViolations] = useState<any[]>([]);

  useEffect(() => {
    fetchRLSStatus();
  }, []);

  const fetchRLSStatus = async () => {
    try {
      // Mock data - replace with actual API call
      const mockPolicies: RLSPolicy[] = [
        {
          table_name: 'store_purchase_orders',
          policy_name: 'po_module_branch_isolation',
          policy_type: 'SELECT',
          enabled: true,
          violation_count: 0
        },
        {
          table_name: 'accounting_ar_invoices',
          policy_name: 'invoice_branch_isolation',
          policy_type: 'SELECT',
          enabled: true,
          violation_count: 2,
          last_violation: new Date().toISOString()
        },
        {
          table_name: 'payments',
          policy_name: 'payment_branch_isolation',
          policy_type: 'SELECT',
          enabled: true,
          violation_count: 0
        },
        {
          table_name: 'simple_items',
          policy_name: 'items_branch_isolation',
          policy_type: 'SELECT',
          enabled: true,
          violation_count: 1,
          last_violation: new Date(Date.now() - 3600000).toISOString()
        }
      ];

      setPolicies(mockPolicies);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch RLS policies');
      setLoading(false);
    }
  };

  const totalPolicies = policies.length;
  const enabledPolicies = policies.filter(p => p.enabled).length;
  const totalViolations = policies.reduce((sum, p) => sum + p.violation_count, 0);

  return (
    <div className="space-y-6">
      {/* RLS Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-stone-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Total Policies</p>
              <p className="text-2xl font-bold text-stone-900 mt-1">{totalPolicies}</p>
            </div>
            <Database className="h-8 w-8 text-stone-400" />
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-lg p-4 border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Enabled</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{enabledPolicies}</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white border border-amber-200 rounded-lg p-4 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase">Violations (24h)</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{totalViolations}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
        </div>
      </div>

      {/* Policy List */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
          <h3 className="text-sm font-semibold text-stone-900 uppercase tracking-wider">
            Row Level Security Policies
          </h3>
        </div>

        <div className="divide-y divide-stone-100">
          {policies.map((policy, index) => (
            <div key={index} className="px-6 py-4 hover:bg-stone-50 transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Lock className="h-5 w-5 text-stone-600" />
                    <div>
                      <h4 className="font-semibold text-stone-900">{policy.table_name}</h4>
                      <p className="text-sm text-stone-600">{policy.policy_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-stone-600">
                      Type: <span className="font-mono text-stone-900">{policy.policy_type}</span>
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      policy.enabled 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {policy.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    {policy.violation_count > 0 && (
                      <span className="text-amber-600 font-medium">
                        {policy.violation_count} violations
                      </span>
                    )}
                  </div>

                  {policy.last_violation && (
                    <p className="text-xs text-stone-500 mt-2">
                      Last violation: {new Date(policy.last_violation).toLocaleString()}
                    </p>
                  )}
                </div>

                <button className="px-3 py-1 text-sm text-stone-700 hover:text-stone-900 font-medium">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-stone-900 mb-3">Quick Actions</h4>
        <div className="flex flex-wrap gap-2">
          <button className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
            <Eye className="h-4 w-4 inline mr-2" />
            View All Violations
          </button>
          <button className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
            <Database className="h-4 w-4 inline mr-2" />
            Test Policies
          </button>
          <button className="px-4 py-2 bg-white border border-stone-200 rounded-lg text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
            <RefreshCw className="h-4 w-4 inline mr-2" />
            Refresh Status
          </button>
        </div>
      </div>
    </div>
  );
}
