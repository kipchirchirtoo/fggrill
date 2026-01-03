'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, QrCode, BarChart3, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';

interface BookingBarcodeCardProps {
  bookingId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  adults: number;
  children?: number;
  className?: string;
}

export function BookingBarcodeCard({
  bookingId,
  guestName,
  checkIn,
  checkOut,
  roomType,
  adults,
  children,
  className
}: BookingBarcodeCardProps) {
  const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [bookingCard, setBookingCard] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeView, setActiveView] = useState<'barcode' | 'qr' | 'card'>('barcode');

  useEffect(() => {
    generateBarcodes();
  }, [bookingId]);

  const generateBarcodes = async () => {
    setIsLoading(true);
    try {
      // Generate barcode
      const barcodeResponse = await fetch('/api/barcode/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: bookingId,
          format: 'code128',
          include_text: true
        })
      });

      if (barcodeResponse.ok) {
        const barcodeResult = await barcodeResponse.json();
        setBarcodeImage(barcodeResult.barcode);
      }

      // Generate QR code
      const qrResponse = await fetch('/api/barcode/generate-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: bookingId,
          booking_url: `https://fggrillhotel.com/booking/${bookingId}`
        })
      });

      if (qrResponse.ok) {
        const qrResult = await qrResponse.json();
        setQrCodeImage(qrResult.qr_code);
      }

      // Generate booking card
      const cardResponse = await fetch('/api/barcode/generate-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          booking_id: bookingId,
          guest_name: guestName,
          check_in: checkIn,
          check_out: checkOut,
          room_type: roomType,
          adults,
          children: children || 0
        })
      });

      if (cardResponse.ok) {
        const cardResult = await cardResponse.json();
        setBookingCard(cardResult.booking_card);
      }

    } catch (error) {
      console.error('Error generating barcodes:', error);
      toast.error('Failed to generate booking codes');
    } finally {
      setIsLoading(false);
    }
  };

  const copyBookingId = async () => {
    try {
      await navigator.clipboard.writeText(bookingId);
      setCopied(true);
      toast.success('Booking ID copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy booking ID');
    }
  };

  const downloadImage = (imageData: string, filename: string) => {
    try {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${imageData}`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Image downloaded successfully');
    } catch (error) {
      toast.error('Failed to download image');
    }
  };

  const shareBooking = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'FG Grill Hotel Booking',
          text: `Booking ID: ${bookingId}`,
          url: `https://fggrillhotel.com/booking/${bookingId}`
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      // Fallback to copying URL
      try {
        await navigator.clipboard.writeText(`https://fggrillhotel.com/booking/${bookingId}`);
        toast.success('Booking URL copied to clipboard');
      } catch (error) {
        toast.error('Failed to share booking');
      }
    }
  };

  const renderBarcodeView = () => (
    <div className="text-center space-y-4">
      <div className="bg-white p-6 rounded-lg border-2 border-[#E5E5EA]">
        {isLoading ? (
          <div className="h-20 bg-[#F2F2F7] animate-pulse rounded"></div>
        ) : barcodeImage ? (
          <img 
            src={`data:image/png;base64,${barcodeImage}`} 
            alt="Booking Barcode" 
            className="max-w-full h-auto mx-auto"
          />
        ) : (
          <div className="h-20 bg-[#F2F2F7] rounded flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-[#8E8E93]" />
          </div>
        )}
      </div>
      <p className="text-sm text-[#8E8E93]">Show this barcode at check-in</p>
    </div>
  );

  const renderQRView = () => (
    <div className="text-center space-y-4">
      <div className="bg-white p-6 rounded-lg border-2 border-[#E5E5EA] inline-block">
        {isLoading ? (
          <div className="w-32 h-32 bg-[#F2F2F7] animate-pulse rounded"></div>
        ) : qrCodeImage ? (
          <img 
            src={`data:image/png;base64,${qrCodeImage}`} 
            alt="Booking QR Code" 
            className="w-32 h-32 mx-auto"
          />
        ) : (
          <div className="w-32 h-32 bg-[#F2F2F7] rounded flex items-center justify-center">
            <QrCode className="h-8 w-8 text-[#8E8E93]" />
          </div>
        )}
      </div>
      <p className="text-sm text-[#8E8E93]">Scan to view booking details</p>
    </div>
  );

  const renderCardView = () => (
    <div className="text-center space-y-4">
      <div className="bg-white p-4 rounded-lg border-2 border-[#E5E5EA]">
        {isLoading ? (
          <div className="w-full h-48 bg-[#F2F2F7] animate-pulse rounded"></div>
        ) : bookingCard ? (
          <img 
            src={`data:image/png;base64,${bookingCard}`} 
            alt="Booking Card" 
            className="max-w-full h-auto mx-auto rounded"
          />
        ) : (
          <div className="w-full h-48 bg-[#F2F2F7] rounded flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-[#8E8E93]" />
          </div>
        )}
      </div>
      <p className="text-sm text-[#8E8E93]">Complete booking card with details</p>
    </div>
  );

  return (
    <IOSCard className={`p-6 ${className}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-[#3C3C43] mb-2">Booking Codes</h3>
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-[#8E8E93] font-mono">{bookingId}</span>
            <IOSButton
              variant="ghost"
              size="sm"
              onClick={copyBookingId}
              className="p-1"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-[#8E8E93]" />
              )}
            </IOSButton>
          </div>
        </div>

        {/* View Selector */}
        <div className="flex bg-[#F2F2F7] rounded-lg p-1">
          {[
            { id: 'barcode', label: 'Barcode', icon: BarChart3 },
            { id: 'qr', label: 'QR Code', icon: QrCode },
            { id: 'card', label: 'Card', icon: Download }
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveView(view.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeView === view.id
                  ? 'bg-white text-[#3C3C43] shadow-sm'
                  : 'text-[#8E8E93] hover:text-[#3C3C43]'
              }`}
            >
              <view.icon className="h-4 w-4" />
              {view.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeView === 'barcode' && renderBarcodeView()}
          {activeView === 'qr' && renderQRView()}
          {activeView === 'card' && renderCardView()}
        </motion.div>

        {/* Actions */}
        <div className="flex gap-2">
          <IOSButton
            variant="outline"
            size="sm"
            onClick={() => {
              const imageData = activeView === 'barcode' ? barcodeImage : 
                              activeView === 'qr' ? qrCodeImage : bookingCard;
              if (imageData) {
                downloadImage(imageData, `booking-${activeView}-${bookingId}.png`);
              }
            }}
            disabled={!barcodeImage && !qrCodeImage && !bookingCard}
            className="flex-1"
            leftIcon={<Download className="h-4 w-4" />}
          >
            Download
          </IOSButton>
          
          <IOSButton
            variant="outline"
            size="sm"
            onClick={shareBooking}
            className="flex-1"
            leftIcon={<Share2 className="h-4 w-4" />}
          >
            Share
          </IOSButton>
        </div>

        {/* Instructions */}
        <div className="bg-[#F0F9FF] p-4 rounded-lg border border-[#BAE6FD]">
          <h4 className="font-medium text-[#0369A1] mb-2">How to Use</h4>
          <ul className="text-sm text-[#0369A1] space-y-1">
            <li>• Show the barcode at hotel reception for quick check-in</li>
            <li>• Scan the QR code to access your booking online</li>
            <li>• Download the card for offline access</li>
            <li>• Keep your booking ID safe for reference</li>
          </ul>
        </div>
      </div>
    </IOSCard>
  );
}
