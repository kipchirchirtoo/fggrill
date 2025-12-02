"use client";

import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const iosModalVariants = cva(
  "relative overflow-hidden bg-white dark:bg-[#1C1C1E] text-black dark:text-white shadow-[0_2px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_24px_rgba(0,0,0,0.25)]",
  {
    variants: {
      variant: {
        default: "rounded-ios-xl",
        sheet: "rounded-t-ios-xl rounded-b-none",
        full: "",
      },
      position: {
        center: "mx-auto my-auto",
        bottom: "mx-auto mt-auto",
        top: "mx-auto mb-auto",
      },
      size: {
        sm: "max-w-md w-full", // Increased from sm to md
        md: "max-w-lg w-full", // Increased from md to lg
        lg: "max-w-xl w-full", // Increased from lg to xl
        xl: "max-w-2xl w-full", // Increased from xl to 2xl
        '2xl': "max-w-3xl w-full", // Increased from 2xl to 3xl
        full: "w-full h-full",
      }
    },
    defaultVariants: {
      variant: "default",
      position: "center",
      size: "md",
    }
  }
);

export interface IOSModalProps extends React.HTMLAttributes<HTMLDivElement>, 
  VariantProps<typeof iosModalVariants> {
  isOpen: boolean;
  onClose: () => void;
  showCloseButton?: boolean;
  hideBackdrop?: boolean;
  blurBackdrop?: boolean;
  preventScroll?: boolean;
  closeOnEsc?: boolean;
  closeOnOutsideClick?: boolean;
}

const IOSModal = React.forwardRef<HTMLDivElement, IOSModalProps>(
  ({ 
    className,
    variant,
    position,
    size,
    isOpen,
    onClose,
    showCloseButton = true,
    hideBackdrop = false,
    blurBackdrop = true,
    preventScroll = true,
    closeOnEsc = true,
    closeOnOutsideClick = true,
    children,
    ...props
  }, ref) => {
    // Handle ESC key press to close modal
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (isOpen && closeOnEsc && e.key === 'Escape') {
          onClose();
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, closeOnEsc]);

    // Prevent body scroll when modal is open
    useEffect(() => {
      if (preventScroll) {
        if (isOpen) {
          document.body.style.overflow = 'hidden';
          document.body.style.paddingRight = '15px'; // Prevent layout shift
        } else {
          document.body.style.overflow = '';
          document.body.style.paddingRight = '';
        }
      }
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
      };
    }, [isOpen, preventScroll]);

    // Animation variants
    const backdropAnimation = {
      hidden: { opacity: 0 },
      visible: { opacity: 1 }
    };

    const modalAnimation = {
      hidden: { 
        opacity: 0,
        scale: 0.95,
        y: variant === 'sheet' ? 20 : 0
      },
      visible: { 
        opacity: 1,
        scale: 1,
        y: 0,
        transition: {
          duration: 0.2,
          ease: "easeOut"
        }
      },
      exit: { 
        opacity: 0,
        scale: variant === 'sheet' ? 1 : 0.95,
        y: variant === 'sheet' ? 20 : 0,
        transition: {
          duration: 0.15,
          ease: "easeIn"
        }
      }
    };

    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Backdrop */}
            {!hideBackdrop && (
              <motion.div
                className={cn(
                  "fixed inset-0 bg-black/25",
                  blurBackdrop && "backdrop-blur-[8px]"
                )}
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={backdropAnimation}
                onClick={closeOnOutsideClick ? onClose : undefined}
              />
            )}
            
            {/* Modal */}
            <motion.div
              ref={ref}
              className={cn(
                "z-50 p-8 max-h-[90vh] sm:max-h-[95vh] w-[95vw] max-w-4xl",
                position === 'bottom' && "mb-0 w-full",
                position === 'top' && "mt-0 w-full",
                variant === 'sheet' && "w-full max-w-none",
                variant === 'full' && "h-full w-full max-h-full max-w-none rounded-none",
              )}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={modalAnimation}
              onClick={(e) => e.stopPropagation()}
            >
              <div 
                className={cn(
                  iosModalVariants({ variant, position, size }),
                  className
                )}
                {...props}
              >
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    className="absolute right-6 top-6 p-1.5 rounded-full text-[#8E8E93] hover:bg-[#F2F2F7] dark:text-[#98989D] dark:hover:bg-[#2C2C2E] transition-colors focus:outline-none"
                    aria-label="Close modal"
                  >
                    <X className="h-6 w-6" />
                  </button>
                )}
                {children}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  }
);

IOSModal.displayName = 'IOSModal';

// Subcomponents
interface IOSModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  centered?: boolean;
}

const IOSModalHeader = React.forwardRef<HTMLDivElement, IOSModalHeaderProps>(
  ({ className, centered = false, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mb-6 mt-2",
        centered && "text-center",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);

IOSModalHeader.displayName = 'IOSModalHeader';

// Modal Title
const IOSModalTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xl font-semibold font-sf-pro-display font-sf-pro-display text-black dark:text-white",
      className
    )}
    {...props}
  >
    {children}
  </h3>
));

IOSModalTitle.displayName = 'IOSModalTitle';

// Modal Description
const IOSModalDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, children, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      "mt-2 text-sm text-ios-gray-1 dark:text-ios-gray-3",
      className
    )}
    {...props}
  >
    {children}
  </p>
));

IOSModalDescription.displayName = 'IOSModalDescription';

// Modal Content
const IOSModalContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("overflow-auto", className)}
    {...props}
  >
    {children}
  </div>
));

IOSModalContent.displayName = 'IOSModalContent';

// Modal Footer
const IOSModalFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2",
      className
    )}
    {...props}
  >
    {children}
  </div>
));

IOSModalFooter.displayName = 'IOSModalFooter';

// Sheet Handle (for bottom sheets)
const IOSSheetHandle = React.forwardRef<HTMLDivElement>(
  ({ }, ref) => (
    <div 
      ref={ref}
      className="flex justify-center w-full -mt-1 mb-4"
    >
      <div className="w-12 h-1.5 rounded-full bg-ios-gray-3 dark:bg-ios-gray-2/50" />
    </div>
  )
);

IOSSheetHandle.displayName = 'IOSSheetHandle';

export {
  IOSModal,
  IOSModalHeader,
  IOSModalTitle,
  IOSModalDescription,
  IOSModalContent,
  IOSModalFooter,
  IOSSheetHandle
};
