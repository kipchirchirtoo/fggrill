import { randomInt } from 'crypto';

interface BillVerificationCodeInput {
  code?: string | null;
  billRef: string;
  billType: string;
  branchId: number;
  outletId: string;
  amount: number;
  generatedBy: string;
  notes?: string;
  metadata?: Record<string, any>;
}

interface BillVerificationCodeResult {
  code: string;
}

const generateCode = (): string => String(randomInt(100000, 1000000));

// Generates the human-readable code printed on a bill/receipt so a customer
// can verify it at the front desk. Reuses an existing code (e.g. an
// order's current short_code) when one is already set, so callers only
// see a "changed" code the first time a bill is created.
export const createBillVerificationCode = async (
  input: BillVerificationCodeInput
): Promise<BillVerificationCodeResult> => {
  const code = input.code && String(input.code).trim() ? String(input.code).trim() : generateCode();
  return { code };
};
