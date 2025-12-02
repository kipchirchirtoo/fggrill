'use client';

import { useState, useEffect } from 'react';

interface DateDisplayProps {
  date: string | Date;
  format?: 'date' | 'time' | 'datetime' | 'relative';
  className?: string;
}

export function DateDisplay({ date, format = 'date', className = '' }: DateDisplayProps) {
  const [formattedDate, setFormattedDate] = useState('');

  useEffect(() => {
    if (!date) {
      setFormattedDate('-');
      return;
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    try {
      switch (format) {
        case 'date':
          setFormattedDate(dateObj.toLocaleDateString());
          break;
        case 'time':
          setFormattedDate(dateObj.toLocaleTimeString());
          break;
        case 'datetime':
          setFormattedDate(dateObj.toLocaleString());
          break;
        case 'relative':
          setFormattedDate(getRelativeTime(dateObj));
          break;
        default:
          setFormattedDate(dateObj.toLocaleDateString());
      }
    } catch (error) {
      setFormattedDate('-');
    }
  }, [date, format]);

  return (
    <span className={className} suppressHydrationWarning>
      {formattedDate || '-'}
    </span>
  );
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSeconds < 60) return 'just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays < 7) return `${diffInDays}d ago`;
  
  return date.toLocaleDateString();
}
