import React from 'react';

interface PageShellProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function PageShell({ title, description, children }: PageShellProps) {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children ?? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          This module is under construction.
        </div>
      )}
    </div>
  );
}
