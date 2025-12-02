'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
        toast.error("Please select a file");
        return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_URL}/api/store/import_data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' // Do not set content-type manually with FormData
        },
        body: formData
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.detail || 'Failed to import data');
      }
      
      const resData = await response.json();
      
      toast.success('Data imported successfully');
      if (resData.skipped_skus) {
          toast.warning(`Skipped ${resData.skipped_skus.length} invalid SKUs`);
      }
      
      setFile(null);
      onClose();
      window.location.reload();

    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to import data');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Stock Data (Excel)</DialogTitle>
        </DialogHeader>
          
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="space-y-2">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                    <input 
                        type="file" 
                        id="file-upload" 
                        className="hidden" 
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-sm text-gray-600 font-medium">
                            {file ? file.name : "Click to upload Excel file"}
                        </span>
                        <span className="text-xs text-gray-400">.xlsx files only</span>
                    </label>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !file}>
                {isLoading ? 'Importing...' : 'Import'}
              </Button>
            </div>
          </form>
      </DialogContent>
    </Dialog>
  );
}
