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
// Digits 2-9 are part of the alphabet (for readability on a 6-char code),
// so a code made entirely of digits still matches SHORT_CODE_PATTERN. Bills
// must show an actual letter+number mix, so reuse additionally requires at
// least one letter — this also forces legacy all-numeric short codes to be
// regenerated into proper alphanumeric ones the next time they're touched.
const HAS_LETTER_PATTERN = /[A-Z]/;

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
  const code =
    SHORT_CODE_PATTERN.test(existingCode) && HAS_LETTER_PATTERN.test(existingCode)
      ? existingCode
      : generateCode();
  return { code };
};
