'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  containerClassName?: string;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative", containerClassName)}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-stone-400 pointer-events-none" />
        <input
          type="text"
          className={cn(
            "flex h-10 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 py-2 text-[13px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export { SearchInput };
