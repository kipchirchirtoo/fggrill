'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, XCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type DialogType = 'confirm' | 'warning' | 'danger' | 'success' | 'info';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  type?: DialogType;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  showCancel?: boolean;
}

const typeConfig: Record<DialogType, { icon: React.ElementType; iconBg: string; iconColor: string; buttonBg: string; buttonHover: string }> = {
  confirm: {
    icon: Info,
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600',
    buttonBg: 'bg-blue-600',
    buttonHover: 'hover:bg-blue-700',
  },
  warning: {
    icon: AlertTriangle,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    buttonBg: 'bg-amber-600',
    buttonHover: 'hover:bg-amber-700',
  },
  danger: {
    icon: XCircle,
    iconBg: 'bg-red-100',
    iconColor: 'text-red-600',
    buttonBg: 'bg-red-600',
    buttonHover: 'hover:bg-red-700',
  },
  success: {
    icon: CheckCircle,
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    buttonBg: 'bg-emerald-600',
    buttonHover: 'hover:bg-emerald-700',
  },
  info: {
    icon: Info,
    iconBg: 'bg-stone-100',
    iconColor: 'text-stone-600',
    buttonBg: 'bg-stone-600',
    buttonHover: 'hover:bg-stone-700',
  },
};

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  showCancel = true,
}: ConfirmationDialogProps) {
  const config = typeConfig[type];
  const Icon = config.icon;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={!isLoading ? onClose : undefined}
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
          >
            <div className="p-6">
              {/* Icon */}
              <div className={cn('w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4', config.iconBg)}>
                <Icon className={cn('h-6 w-6', config.iconColor)} />
              </div>

              {/* Content */}
              <div className="text-center">
                <h3 className="text-lg font-semibold text-stone-900 mb-2">{title}</h3>
                <p className="text-sm text-stone-600">{message}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex border-t border-stone-100">
              {showCancel && (
                <button
                  onClick={onClose}
                  disabled={isLoading}
                  className="flex-1 py-3.5 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors disabled:opacity-50 border-r border-stone-100"
                >
                  {cancelText}
                </button>
              )}
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={cn(
                  'flex-1 py-3.5 text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2',
                  config.buttonBg,
                  config.buttonHover
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  confirmText
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default ConfirmationDialog;
