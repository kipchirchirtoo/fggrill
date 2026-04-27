'use client';

import { useState } from 'react';
import { Settings, Shield, Key, Bell, Lock, Zap, Database, Globe, AlertTriangle, CheckCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityConfig {
  // Authentication
  jwt_expiry_minutes: number;
  refresh_token_rotation: boolean;
  session_timeout_minutes: number;
  max_failed_attempts: number;
  lockout_duration_minutes: number;
  
  // Rate Limiting
  auth_rate_limit: number;
  financial_rate_limit: number;
  general_rate_limit: number;
  
  // Security Features
  require_2fa_for_admin: boolean;
  require_2fa_for_financial: boolean;
  ip_whitelist_enabled: boolean;
  geo_blocking_enabled: boolean;
  vpn_detection_enabled: boolean;
  
  // Audit & Monitoring
  log_all_api_calls: boolean;
  alert_on_suspicious_activity: boolean;
  alert_on_failed_logins: number;
  alert_on_role_changes: boolean;
  
  // Database Security
  rls_enabled: boolean;
  backup_frequency_hours: number;
  encryption_at_rest: boolean;
}

export function SecurityConfigPanel() {
  const [config, setConfig] = useState<SecurityConfig>({
    jwt_expiry_minutes: 15,
    refresh_token_rotation: true,
    session_timeout_minutes: 480,
    max_failed_attempts: 5,
    lockout_duration_minutes: 15,
    
    auth_rate_limit: 20,
    financial_rate_limit: 30,
    general_rate_limit: 100,
    
    require_2fa_for_admin: true,
    require_2fa_for_financial: false,
    ip_whitelist_enabled: false,
    geo_blocking_enabled: false,
    vpn_detection_enabled: true,
    
    log_all_api_calls: true,
    alert_on_suspicious_activity: true,
    alert_on_failed_logins: 3,
    alert_on_role_changes: true,
    
    rls_enabled: true,
    backup_frequency_hours: 24,
    encryption_at_rest: true
  });

  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'auth' | 'rate' | 'features' | 'audit' | 'database'>('auth');

  const handleSave = async () => {
    setSaving(true);
    try {
      // API call to save configuration
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success('Security configuration saved successfully');
    } catch (error) {
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof SecurityConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <div className="flex border-b border-stone-200">
          {[
            { id: 'auth', label: 'Authentication', icon: Key },
            { id: 'rate', label: 'Rate Limiting', icon: Zap },
            { id: 'features', label: 'Security Features', icon: Shield },
            { id: 'audit', label: 'Audit & Alerts', icon: Bell },
            { id: 'database', label: 'Database Security', icon: Database }
          ].map(section => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                activeSection === section.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-white text-stone-600 hover:bg-stone-50'
              }`}
            >
              <section.icon className="h-4 w-4" />
              {section.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Authentication Settings */}
          {activeSection === 'auth' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Key className="h-5 w-5" />
                Authentication Configuration
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    JWT Token Expiry (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.jwt_expiry_minutes}
                    onChange={(e) => updateConfig('jwt_expiry_minutes', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">Recommended: 15 minutes</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Session Timeout (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.session_timeout_minutes}
                    onChange={(e) => updateConfig('session_timeout_minutes', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">480 minutes = 8 hours</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Max Failed Login Attempts
                  </label>
                  <input
                    type="number"
                    value={config.max_failed_attempts}
                    onChange={(e) => updateConfig('max_failed_attempts', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">Before account lockout</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Lockout Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={config.lockout_duration_minutes}
                    onChange={(e) => updateConfig('lockout_duration_minutes', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">Account lockout period</p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                <div>
                  <p className="font-medium text-stone-900">Refresh Token Rotation</p>
                  <p className="text-sm text-stone-600">Single-use refresh tokens for enhanced security</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.refresh_token_rotation}
                    onChange={(e) => updateConfig('refresh_token_rotation', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                </label>
              </div>
            </div>
          )}

          {/* Rate Limiting Settings */}
          {activeSection === 'rate' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Rate Limiting Configuration
              </h3>

              <div className="space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Important</p>
                      <p className="text-sm text-amber-700">
                        Rate limits protect against brute force attacks and API abuse. Set limits carefully to balance security and usability.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Auth Endpoints
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={config.auth_rate_limit}
                        onChange={(e) => updateConfig('auth_rate_limit', parseInt(e.target.value))}
                        className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                      />
                      <span className="text-sm text-stone-600">req/15min</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">Per IP address</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      Financial Endpoints
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={config.financial_rate_limit}
                        onChange={(e) => updateConfig('financial_rate_limit', parseInt(e.target.value))}
                        className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                      />
                      <span className="text-sm text-stone-600">req/min</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">Per user</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">
                      General API
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={config.general_rate_limit}
                        onChange={(e) => updateConfig('general_rate_limit', parseInt(e.target.value))}
                        className="flex-1 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                      />
                      <span className="text-sm text-stone-600">req/min</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">Per user</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Security Features */}
          {activeSection === 'features' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Features
              </h3>

              <div className="space-y-4">
                {[
                  {
                    key: 'require_2fa_for_admin',
                    label: 'Require 2FA for Admin Users',
                    description: 'Force two-factor authentication for super admin and admin roles',
                    icon: Lock
                  },
                  {
                    key: 'require_2fa_for_financial',
                    label: 'Require 2FA for Financial Operations',
                    description: 'Require 2FA for payments, invoices, and financial transactions',
                    icon: Lock
                  },
                  {
                    key: 'vpn_detection_enabled',
                    label: 'VPN Detection',
                    description: 'Flag and monitor logins from VPN/proxy connections',
                    icon: Globe
                  },
                  {
                    key: 'ip_whitelist_enabled',
                    label: 'IP Whitelist',
                    description: 'Restrict access to whitelisted IP addresses only',
                    icon: Shield
                  },
                  {
                    key: 'geo_blocking_enabled',
                    label: 'Geographic Blocking',
                    description: 'Block access from specific countries or regions',
                    icon: Globe
                  }
                ].map(feature => (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg hover:bg-stone-100 transition-colors">
                    <div className="flex items-start gap-3">
                      <feature.icon className="h-5 w-5 text-stone-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-stone-900">{feature.label}</p>
                        <p className="text-sm text-stone-600">{feature.description}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config[feature.key as keyof SecurityConfig] as boolean}
                        onChange={(e) => updateConfig(feature.key as keyof SecurityConfig, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit & Alerts */}
          {activeSection === 'audit' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Audit & Alert Configuration
              </h3>

              <div className="space-y-4">
                {[
                  {
                    key: 'log_all_api_calls',
                    label: 'Log All API Calls',
                    description: 'Record every API request for audit trail',
                    icon: Database
                  },
                  {
                    key: 'alert_on_suspicious_activity',
                    label: 'Alert on Suspicious Activity',
                    description: 'Send notifications for detected threats',
                    icon: AlertTriangle
                  },
                  {
                    key: 'alert_on_role_changes',
                    label: 'Alert on Role Changes',
                    description: 'Notify when user roles or permissions are modified',
                    icon: Shield
                  }
                ].map(feature => (
                  <div key={feature.key} className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                    <div className="flex items-start gap-3">
                      <feature.icon className="h-5 w-5 text-stone-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-stone-900">{feature.label}</p>
                        <p className="text-sm text-stone-600">{feature.description}</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config[feature.key as keyof SecurityConfig] as boolean}
                        onChange={(e) => updateConfig(feature.key as keyof SecurityConfig, e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                    </label>
                  </div>
                ))}

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Alert After Failed Logins
                  </label>
                  <input
                    type="number"
                    value={config.alert_on_failed_logins}
                    onChange={(e) => updateConfig('alert_on_failed_logins', parseInt(e.target.value))}
                    className="w-full md:w-64 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">Send alert after this many consecutive failures</p>
                </div>
              </div>
            </div>
          )}

          {/* Database Security */}
          {activeSection === 'database' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Security
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-900">Row Level Security (RLS)</p>
                      <p className="text-sm text-green-700">Database-level access control is active</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-green-600 text-white text-sm rounded-full font-medium">
                    Enabled
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-lg">
                  <div>
                    <p className="font-medium text-stone-900">Encryption at Rest</p>
                    <p className="text-sm text-stone-600">All data encrypted in database storage</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.encryption_at_rest}
                      onChange={(e) => updateConfig('encryption_at_rest', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-900"></div>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Automated Backup Frequency (hours)
                  </label>
                  <input
                    type="number"
                    value={config.backup_frequency_hours}
                    onChange={(e) => updateConfig('backup_frequency_hours', parseInt(e.target.value))}
                    className="w-full md:w-64 px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <p className="text-xs text-stone-500 mt-1">24 hours = daily backups</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-black transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </button>
      </div>
    </div>
  );
}
