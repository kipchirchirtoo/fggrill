import { useMemo, useEffect, useState } from 'react';
import { useAppState } from '../state/AppStateProvider';
import { bridge } from '../bridge';

export interface Branch {
  id: number;
  name: string;
  location?: string;
  settings?: any;
}

export function useBranch() {
  const { session } = useAppState();
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [userBranches, setUserBranches] = useState<Branch[]>([]);

  const activeBranchId = session?.branch_id;

  useEffect(() => {
    // Fetch all accessible branches
    bridge.data.queryLocal('branches', '')
      .then((data: any) => {
        if (Array.isArray(data)) {
          setUserBranches(data as Branch[]);
        }
      })
      .catch(() => setUserBranches([]));

    if (activeBranchId) {
      bridge.data.queryLocal('branches', String(activeBranchId))
        .then((data) => {
          if (data) {
            setActiveBranch(data as Branch);
          } else {
            setActiveBranch({
              id: activeBranchId,
              name: session?.branch_name || 'Current Branch',
            });
          }
        })
        .catch(() => {
          setActiveBranch({
            id: activeBranchId,
            name: session?.branch_name || 'Current Branch',
          });
        });
    } else {
      setActiveBranch(null);
    }
  }, [activeBranchId, session?.branch_name]);

  return {
    activeBranchId,
    activeBranch,
    userBranches,
    isBranchLoaded: !!activeBranch,
  };
}
