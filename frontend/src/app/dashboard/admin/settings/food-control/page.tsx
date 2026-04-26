'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function FoodControlSettingsPage() {
  const queryClient = useQueryClient();
  const [branchId, setBranchId] = useState<string>('1'); // Default to branch 1
  const [config, setConfig] = useState({
    variance_threshold_kes: 200,
    variance_threshold_percent: 10,
    food_cost_alert_threshold: 35,
    allowed_waste_reason_codes: ['SPOILAGE', 'OVERCOOKING', 'CUSTOMER_RETURN', 'PREPARATION_ERROR', 'THEFT', 'OTHER'],
    require_manager_approval_for_theft: true,
    auto_submit_to_accountant_on_close: true,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await fetch('/api/admin/branches', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch branches');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: currentConfig, isLoading } = useQuery({
    queryKey: ['branch-food-control-config', branchId],
    queryFn: async () => {
      const response = await fetch(`/api/branch-food-control-config/${branchId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch config');
      const result = await response.json();
      return result.data;
    },
    enabled: !!branchId,
  });

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/branch-food-control-config/${branchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to save configuration');
      return response.json();
    },
    onSuccess: () => {
      toast.success('Configuration saved successfully');
      queryClient.invalidateQueries({ queryKey: ['branch-food-control-config', branchId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings className="w-8 h-8" />
          Food Control Settings
        </h1>
        <p className="text-gray-600 mt-1">Configure food cost control thresholds and workflows</p>
      </div>

      {/* Branch Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Branch</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full border rounded-md p-2"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            {branches?.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} ({branch.code})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center py-12">Loading configuration...</div>
      ) : (
        <>
          {/* Variance Thresholds */}
          <Card>
            <CardHeader>
              <CardTitle>Variance Thresholds</CardTitle>
              <CardDescription>
                Set thresholds for when variances should trigger alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="variance_threshold_kes">Variance Threshold (KES)</Label>
                <Input
                  id="variance_threshold_kes"
                  type="number"
                  value={config.variance_threshold_kes}
                  onChange={(e) => setConfig({ ...config, variance_threshold_kes: parseFloat(e.target.value) })}
                  min="0"
                  step="10"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variances above this amount will require explanation
                </p>
              </div>

              <div>
                <Label htmlFor="variance_threshold_percent">Variance Threshold (%)</Label>
                <Input
                  id="variance_threshold_percent"
                  type="number"
                  value={config.variance_threshold_percent}
                  onChange={(e) => setConfig({ ...config, variance_threshold_percent: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variances above this percentage will require explanation
                </p>
              </div>

              <div>
                <Label htmlFor="food_cost_alert_threshold">Food Cost Alert Threshold (%)</Label>
                <Input
                  id="food_cost_alert_threshold"
                  type="number"
                  value={config.food_cost_alert_threshold}
                  onChange={(e) => setConfig({ ...config, food_cost_alert_threshold: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Alert when food cost percentage exceeds this threshold
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Waste Management */}
          <Card>
            <CardHeader>
              <CardTitle>Waste Management</CardTitle>
              <CardDescription>
                Configure waste logging and approval workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Allowed Waste Reason Codes</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {['SPOILAGE', 'OVERCOOKING', 'CUSTOMER_RETURN', 'PREPARATION_ERROR', 'THEFT', 'OTHER'].map((code) => (
                    <div key={code} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={code}
                        checked={config.allowed_waste_reason_codes.includes(code)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfig({
                              ...config,
                              allowed_waste_reason_codes: [...config.allowed_waste_reason_codes, code],
                            });
                          } else {
                            setConfig({
                              ...config,
                              allowed_waste_reason_codes: config.allowed_waste_reason_codes.filter((c) => c !== code),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <label htmlFor={code} className="text-sm">
                        {code.replace('_', ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Require Manager Approval for Theft</p>
                  <p className="text-sm text-gray-600">
                    Waste marked as theft must be approved by a manager
                  </p>
                </div>
                <Switch
                  checked={config.require_manager_approval_for_theft}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, require_manager_approval_for_theft: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Workflow Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Workflow Settings</CardTitle>
              <CardDescription>
                Configure automatic workflows and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Auto-Submit to Accountant on Shift Close</p>
                  <p className="text-sm text-gray-600">
                    Automatically submit shift P&L to accountant when shift closes
                  </p>
                </div>
                <Switch
                  checked={config.auto_submit_to_accountant_on_close}
                  onCheckedChange={(checked) =>
                    setConfig({ ...config, auto_submit_to_accountant_on_close: checked })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="w-4 h-4 mr-2" />
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
