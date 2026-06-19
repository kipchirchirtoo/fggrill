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

const SHORT_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SHORT_CODE_LENGTH = 6;
const SHORT_CODE_PATTERN = new RegExp(
  `^[${SHORT_CODE_ALPHABET}]{${SHORT_CODE_LENGTH}}$`
);

const generateCode = (): string => {
  let code = '';
  for (let index = 0; index < SHORT_CODE_LENGTH; index += 1) {
    code += SHORT_CODE_ALPHABET[randomInt(0, SHORT_CODE_ALPHABET.length)];
  }
  return code;
};

// Generates the human-readable code printed on a bill/receipt so a customer
// can verify it at the front desk. Reuses an existing code (e.g. an
// order's current short_code) when one is already set, so callers only
// see a "changed" code the first time a bill is created.
export const createBillVerificationCode = async (
  input: BillVerificationCodeInput
): Promise<BillVerificationCodeResult> => {
  const existingCode = String(input.code ?? '').trim().toUpperCase();
  const code = SHORT_CODE_PATTERN.test(existingCode)
    ? existingCode
    : generateCode();
  return { code };
};
