'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, RefreshCw, Settings, ToggleLeft, ToggleRight, 
  CheckCircle, XCircle, Clock, ArrowUpDown, Download, Upload,
  Loader2, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { channelManagerAPI } from '@/lib/api';

interface Channel {
  channelId: string;
  channelName: string;
  enabled: boolean;
  lastSync?: string;
  status: string;
}

export default function ChannelManagerPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncingChannel, setSyncingChannel] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      setLoading(true);
      const response = await channelManagerAPI.getSyncStatus();
      if (response.success) {
        setChannels(response.data || []);
      }
    } catch (error) {
      toast.error('Failed to fetch channels');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChannel = async (channelId: string, currentlyEnabled: boolean) => {
    try {
      const response = await channelManagerAPI.toggleChannel(channelId, !currentlyEnabled);
      if (response.success) {
        toast.success(`Channel ${!currentlyEnabled ? 'enabled' : 'disabled'}`);
        fetchChannels();
      } else {
        toast.error('Failed to toggle channel');
      }
    } catch (error) {
      toast.error('Failed to toggle channel');
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const response = await channelManagerAPI.syncAllChannels();
      if (response.success) {
        toast.success('All channels synced successfully');
      } else {
        toast.warning(response.message);
      }
      fetchChannels();
    } catch (error) {
      toast.error('Failed to sync channels');
    } finally {
      setSyncing(false);
    }
  };

  const handlePushAvailability = async (channelId: string) => {
    try {
      setSyncingChannel(channelId);
      // In a real implementation, you'd fetch current availability first
      const response = await channelManagerAPI.pushAvailability(channelId, []);
      if (response.success) {
        toast.success('Availability pushed successfully');
      } else {
        toast.error('Failed to push availability');
      }
      fetchChannels();
    } catch (error) {
      toast.error('Failed to push availability');
    } finally {
      setSyncingChannel(null);
    }
  };

  const handlePullBookings = async (channelId: string) => {
    try {
      setSyncingChannel(channelId);
      const response = await channelManagerAPI.pullBookings(channelId);
      if (response.success) {
        const count = response.data?.bookings?.length || 0;
        toast.success(`Retrieved ${count} bookings`);
      } else {
        toast.error('Failed to pull bookings');
      }
    } catch (error) {
      toast.error('Failed to pull bookings');
    } finally {
      setSyncingChannel(null);
    }
  };

  const getChannelLogo = (channelId: string) => {
    const logos: Record<string, string> = {
      booking_com: '🅱️',
      expedia: '🌐',
      airbnb: '🏠',
      agoda: '🔵',
    };
    return logos[channelId] || '📡';
  };

  const formatLastSync = (lastSync?: string) => {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Globe className="w-8 h-8 text-blue-500" />
            Channel Manager
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage OTA integrations and sync availability across channels
          </p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync All Channels'}
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="font-medium text-amber-800 dark:text-amber-300">Channel Manager Setup Required</h3>
          <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
            To enable channel integrations, you need to configure API credentials for each OTA. 
            Contact support for assistance with Booking.com, Expedia, Airbnb, or Agoda integration.
          </p>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {channels.map((channel) => (
          <motion.div
            key={channel.channelId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-white dark:bg-gray-800 rounded-xl border-2 transition-colors ${
              channel.enabled 
                ? 'border-green-200 dark:border-green-800' 
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <div className="p-5">
              {/* Channel Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getChannelLogo(channel.channelId)}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {channel.channelName}
                    </h3>
                    <div className="flex items-center gap-2 text-sm">
                      {channel.enabled ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" />
                          Connected
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500">
                          <XCircle className="w-3 h-3" />
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggleChannel(channel.channelId, channel.enabled)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  {channel.enabled ? (
                    <ToggleRight className="w-8 h-8 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Last Sync */}
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
                <Clock className="w-4 h-4" />
                <span>Last sync: {formatLastSync(channel.lastSync)}</span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handlePushAvailability(channel.channelId)}
                  disabled={!channel.enabled || syncingChannel === channel.channelId}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  {syncingChannel === channel.channelId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Push Availability
                </button>
                <button
                  onClick={() => handlePullBookings(channel.channelId)}
                  disabled={!channel.enabled || syncingChannel === channel.channelId}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
                >
                  {syncingChannel === channel.channelId ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Pull Bookings
                </button>
              </div>
            </div>

            {/* Configure Footer */}
            <div className="px-5 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
              <button className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                <Settings className="w-4 h-4" />
                Configure API Credentials
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Channels</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {channels.length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Channels</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
            {channels.filter(c => c.enabled).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Pending Setup</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {channels.filter(c => !c.enabled).length}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-500 dark:text-gray-400">Sync Status</div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5" />
            Ready
          </div>
        </div>
      </div>
    </div>
  );
}
