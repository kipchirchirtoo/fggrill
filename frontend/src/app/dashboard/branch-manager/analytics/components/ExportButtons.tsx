'use client';

import { Button } from '@/components/ui/button';
import { Download, FileText, Table } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface ExportButtonsProps {
  onExportPDF: () => void;
  onExportCSV: () => void;
  loading: boolean;
}

export default function ExportButtons({ onExportPDF, onExportCSV, loading }: ExportButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={onExportPDF}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <FileText className="mr-2 h-4 w-4" />
        )}
        Export PDF
      </Button>
      <Button
        variant="outline"
        onClick={onExportCSV}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Table className="mr-2 h-4 w-4" />
        )}
        Export CSV
      </Button>
    </div>
  );
}
