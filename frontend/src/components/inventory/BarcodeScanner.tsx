'use client';

import { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface BarcodeScannerProps {
  onScan: (itemCode: string) => void;
  onError?: (error: string) => void;
}

export function BarcodeScanner({ onScan, onError }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'barcode-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true,
      },
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Extract item code from barcode (format: INV:XXXX)
        const match = decodedText.match(/INV:\d{4}/);
        if (match) {
          onScan(match[0]);
          toast.success('Item scanned successfully');
        } else {
          onError?.('Invalid barcode format');
          toast.error('Invalid barcode format');
        }
      },
      (error) => {
        console.error('Scan error:', error);
        onError?.(error.toString());
      }
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [onScan, onError]);

  return (
    <Card className="p-4">
      <div id="barcode-reader" className="w-full max-w-md mx-auto" />
    </Card>
  );
}
