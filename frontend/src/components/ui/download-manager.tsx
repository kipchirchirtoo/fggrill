'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Check, X, FolderOpen, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DownloadItem {
  id: string;
  filename: string;
  status: 'downloading' | 'completed' | 'failed';
  progress?: number;
  error?: string;
  filePath?: string;
}

interface DownloadManagerProps {
  className?: string;
}

export function DownloadManager({ className }: DownloadManagerProps) {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  // Add a download to the manager
  const addDownload = (filename: string) => {
    const id = Date.now().toString();
    const newDownload: DownloadItem = {
      id,
      filename,
      status: 'downloading',
      progress: 0,
    };
    
    setDownloads(prev => [...prev, newDownload]);
    setIsVisible(true);
    
    return id;
  };

  // Update download progress
  const updateDownload = (id: string, updates: Partial<DownloadItem>) => {
    setDownloads(prev => 
      prev.map(download => 
        download.id === id ? { ...download, ...updates } : download
      )
    );
  };

  // Remove a download
  const removeDownload = (id: string) => {
    setDownloads(prev => prev.filter(download => download.id !== id));
  };

  // Open downloads folder (Tauri only)
  const openDownloadsFolder = async () => {
    try {
      const { openDownloadsFolder } = await import('../../lib/tauri-downloads');
      await openDownloadsFolder();
    } catch (error) {
      toast.error('Cannot open Downloads folder in browser');
    }
  };

  // Auto-hide when no active downloads
  useEffect(() => {
    const hasActiveDownloads = downloads.some(d => d.status === 'downloading');
    if (!hasActiveDownloads && downloads.length === 0) {
      setIsVisible(false);
    }
  }, [downloads]);

  // Auto-remove completed downloads after 5 seconds
  useEffect(() => {
    const completedDownloads = downloads.filter(d => d.status === 'completed');
    completedDownloads.forEach(download => {
      setTimeout(() => {
        removeDownload(download.id);
      }, 5000);
    });
  }, [downloads]);

  // Expose functions globally for use by other components
  useEffect(() => {
    (window as any).__downloadManager = {
      addDownload,
      updateDownload,
      removeDownload,
    };
  }, []);

  if (!isVisible || downloads.length === 0) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="bg-white rounded-lg shadow-2xl border border-gray-200 w-80 max-h-96 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2">
              <Download className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-gray-900">Downloads</span>
              <span className="text-xs text-gray-500">({downloads.length})</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={openDownloadsFolder}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Open Downloads Folder"
              >
                <FolderOpen className="h-4 w-4 text-gray-600" />
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-gray-200 rounded transition-colors"
                title="Hide"
              >
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </div>

          {/* Downloads List */}
          <div className="max-h-64 overflow-y-auto">
            <AnimatePresence>
              {downloads.map((download) => (
                <motion.div
                  key={download.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 border-b border-gray-50 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {download.status === 'downloading' && (
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      )}
                      {download.status === 'completed' && (
                        <div className="w-5 h-5 bg-green-100 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-green-600" />
                        </div>
                      )}
                      {download.status === 'failed' && (
                        <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                          <AlertCircle className="h-3 w-3 text-red-600" />
                        </div>
                      )}
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {download.filename}
                      </p>
                      {download.status === 'downloading' && (
                        <div className="mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${download.progress || 0}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {download.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-0.5">
                          Download complete
                        </p>
                      )}
                      {download.status === 'failed' && (
                        <p className="text-xs text-red-600 mt-0.5">
                          {download.error || 'Download failed'}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex-shrink-0">
                      {download.status === 'completed' && (
                        <button
                          onClick={() => removeDownload(download.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Remove"
                        >
                          <X className="h-3 w-3 text-gray-400" />
                        </button>
                      )}
                      {download.status === 'failed' && (
                        <button
                          onClick={() => removeDownload(download.id)}
                          className="p-1 hover:bg-gray-100 rounded transition-colors"
                          title="Remove"
                        >
                          <X className="h-3 w-3 text-gray-400" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Helper function to use the download manager
export function useDownloadManager() {
  const startDownload = (filename: string) => {
    const manager = (window as any).__downloadManager;
    if (manager) {
      return manager.addDownload(filename);
    }
    return null;
  };

  const updateDownload = (id: string, updates: Partial<DownloadItem>) => {
    const manager = (window as any).__downloadManager;
    if (manager) {
      manager.updateDownload(id, updates);
    }
  };

  const completeDownload = (id: string, filePath?: string) => {
    const manager = (window as any).__downloadManager;
    if (manager) {
      manager.updateDownload(id, { status: 'completed', progress: 100, filePath });
    }
  };

  const failDownload = (id: string, error: string) => {
    const manager = (window as any).__downloadManager;
    if (manager) {
      manager.updateDownload(id, { status: 'failed', error });
    }
  };

  return {
    startDownload,
    updateDownload,
    completeDownload,
    failDownload,
  };
}