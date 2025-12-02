import React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const inputVariants = cva(
  "flex w-full rounded-ios-lg border bg-white text-sm font-sf-pro text-black transition-shadow focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#1C1C1E] dark:text-white", 
  {
    variants: {
      variant: {
        default: "border-ios-gray-4 focus:border-ios-blue-light focus:ring-1 focus:ring-ios-blue-light dark:border-[#3A3A3C] dark:focus:border-ios-blue-dark dark:focus:ring-ios-blue-dark",
        error: "border-ios-red-light focus:border-ios-red-light focus:ring-1 focus:ring-ios-red-light dark:border-ios-red-dark dark:focus:border-ios-red-dark dark:focus:ring-ios-red-dark",
        success: "border-ios-green-light focus:border-ios-green-light focus:ring-1 focus:ring-ios-green-light dark:border-ios-green-dark dark:focus:border-ios-green-dark dark:focus:ring-ios-green-dark",
      },
      size: {
        sm: "h-8 px-3 py-1 text-sm",
        md: "h-11 px-4 py-2 text-base",
        lg: "h-12 px-5 py-2.5 text-lg",
      },
      rounded: {
        default: "rounded-ios-lg",
        full: "rounded-ios-full",
        none: "rounded-none",
      },
      filled: {
        true: "bg-ios-gray-6 dark:bg-[#2C2C2E] border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
      rounded: "default",
    }
  }
);

export interface IOSInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'>, 
    VariantProps<typeof inputVariants> {
  containerClassName?: string;
  label?: string;
  labelClassName?: string;
  caption?: string;
  error?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  rightElement?: React.ReactNode;
  hideLabel?: boolean;
  showLabelOnFocus?: boolean;
  floatingLabel?: boolean;
}

export const IOSInput = React.forwardRef<HTMLInputElement, IOSInputProps>(
  ({
    className,
    containerClassName,
    label,
    labelClassName,
    caption,
    error,
    icon,
    iconPosition = 'left',
    rightElement,
    variant = error ? 'error' : 'default',
    size,
    rounded,
    filled,
    hideLabel = false,
    showLabelOnFocus = false,
    floatingLabel = false,
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);
    const [hasValue, setHasValue] = React.useState(false);
    
    React.useEffect(() => {
      setHasValue(!!props.value || !!props.defaultValue);
    }, [props.value, props.defaultValue]);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      props.onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      props.onBlur?.(e);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setHasValue(!!e.target.value);
      props.onChange?.(e);
    };

    const showLabel = !hideLabel && ((showLabelOnFocus && isFocused) || (!showLabelOnFocus && label));
    
    return (
      <div className={cn('space-y-2 w-full', containerClassName)}>
        {showLabel && !floatingLabel && (
          <label
            htmlFor={props.id}
            className={cn(
              "block text-sm font-medium font-sf-pro text-black dark:text-white mb-1.5",
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {floatingLabel && (
            <label
              htmlFor={props.id}
              className={cn(
                "absolute pointer-events-none font-sf-pro transition-all duration-200 ease-out",
                (isFocused || hasValue) 
                  ? "text-xs top-1.5 left-3 text-ios-blue-light dark:text-ios-blue-dark"
                  : "text-base text-ios-gray-1 dark:text-ios-gray-3 top-1/2 -translate-y-1/2 left-4",
                labelClassName
              )}
            >
              {label}
            </label>
          )}
          
          {icon && iconPosition === 'left' && (
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-ios-gray-1 dark:text-ios-gray-3">
              {icon}
            </div>
          )}
          
          <input
            ref={ref}
            className={cn(
              inputVariants({ variant, size, rounded, filled }),
              icon && iconPosition === 'left' && 'pl-10',
              icon && iconPosition === 'right' && 'pr-10',
              rightElement && 'pr-12',
              floatingLabel && (isFocused || hasValue) && 'pt-6 pb-2',
              floatingLabel && !(isFocused || hasValue) && 'pt-4 pb-4',
              className
            )}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChange={handleChange}
            {...props}
          />
          
          {icon && iconPosition === 'right' && (
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-ios-gray-1 dark:text-ios-gray-3">
              {icon}
            </div>
          )}
          
          {rightElement && (
            <div className="absolute inset-y-0 right-4 flex items-center">
              {rightElement}
            </div>
          )}
        </div>
        
        {(caption && !error) && (
          <p className="text-xs text-ios-gray-1 dark:text-ios-gray-3 mt-1.5">{caption}</p>
        )}
        
        {error && (
          <p className="text-xs text-ios-red-light dark:text-ios-red-dark mt-1.5 flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M7 14C10.866 14 14 10.866 14 7C14 3.13401 10.866 0 7 0C3.13401 0 0 3.13401 0 7C0 10.866 3.13401 14 7 14ZM7 9.33333C6.63166 9.33333 6.33333 9.03501 6.33333 8.66667V4.66667C6.33333 4.29833 6.63166 4 7 4C7.36834 4 7.66667 4.29833 7.66667 4.66667V8.66667C7.66667 9.03501 7.36834 9.33333 7 9.33333ZM7 11.6667C6.44772 11.6667 6 11.219 6 10.6667C6 10.1144 6.44772 9.66667 7 9.66667C7.55228 9.66667 8 10.1144 8 10.6667C8 11.219 7.55228 11.6667 7 11.6667Z" fill="currentColor" />
            </svg>
            {error}
          </p>
        )}
      </div>
    );
  }
);

IOSInput.displayName = 'IOSInput';
