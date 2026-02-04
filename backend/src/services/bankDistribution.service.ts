import { Parser } from 'json2csv';
import { logger } from '../utils/logger';

export interface BankTransferRecord {
    account_number: string;
    account_name: string;
    bank_name: string;
    bank_branch: string;
    amount: number;
    reference: string;
}

class BankDistributionService {
    async generateBankCSV(records: BankTransferRecord[]): Promise<string> {
        try {
            const fields = [
                { label: 'Account Number', value: 'account_number' },
                { label: 'Account Name', value: 'account_name' },
                { label: 'Bank Name', value: 'bank_name' },
                { label: 'Bank Branch', value: 'bank_branch' },
                { label: 'Amount', value: 'amount' },
                { label: 'Reference', value: 'reference' }
            ];

            const parser = new Parser({ fields });
            const csv = parser.parse(records);

            logger.info(`Generated bank CSV for ${records.length} records`);
            return csv;
        } catch (error) {
            logger.error('Error generating bank CSV:', error);
            throw new Error('Failed to generate bank distribution file');
        }
    }
}

export const bankDistributionService = new BankDistributionService();
