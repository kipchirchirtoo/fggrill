// useMutation — offline-first write hook: local first, outbox queue, sync when online

import { useState, useCallback } from 'react';
import { bridge, MutateParams } from '../bridge';
import { toast } from 'sonner';

interface UseMutationOptions {
  onSuccess?: (result: unknown) => void;
  onError?: (error: string) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseMutationResult {
  mutate: (params: MutateParams) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useMutation(options: UseMutationOptions = {}): UseMutationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(async (params: MutateParams) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await bridge.data.mutate(params);

      if (result.offline) {
        toast.info('Saved locally — will sync when online');
      } else if (options.successMessage) {
        toast.success(options.successMessage);
      }

      options.onSuccess?.(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      toast.error(options.errorMessage ?? msg);
      options.onError?.(msg);
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  return { mutate, isLoading, error };
}
