import { supabase } from '../config/supabase';
import { logger } from '../utils/logger';

export class PayrollService {
    /**
     * Fetches HR settings by key
     */
    static async getSetting(key: string): Promise<any> {
        const { data, error } = await supabase
            .from('hr_settings')
            .select('value')
            .eq('key', key)
            .single();

        if (error) {
            logger.error(`Error fetching HR setting ${key}:`, error);
            return null;
        }
        return data.value;
    }

    /**
     * Calculates PAYE based on Kenyan tax bands from settings
     */
    static async calculatePAYE(grossPay: number): Promise<number> {
        const bands = await this.getSetting('paye_bands');
        const relief = await this.getSetting('personal_relief');

        if (!bands) return 0; // Fallback to 0 if settings missing

        let taxableIncome = grossPay;
        let tax = 0;
        let previousThreshold = 0;

        for (const band of bands) {
            const amountInBand = Math.min(taxableIncome - previousThreshold, band.threshold - previousThreshold);
            if (amountInBand > 0) {
                tax += amountInBand * band.rate;
            }
            previousThreshold = band.threshold;
            if (taxableIncome <= band.threshold) break;
        }

        // Apply personal relief
        const personalRelief = relief?.amount || 2400;
        tax = Math.max(0, tax - personalRelief);

        return Math.round(tax);
    }

    /**
     * Calculates SHIF (Social Health Insurance Fund) - 2.75% of gross
     */
    static async calculateSHIF(grossPay: number): Promise<number> {
        const setting = await this.getSetting('shif_rate');
        const rate = setting?.rate || 0.0275;
        return Math.round(grossPay * rate);
    }

    /**
     * Calculates Affordable Housing Levy - 1.5% of gross
     */
    static async calculateHousingLevy(grossPay: number): Promise<number> {
        const setting = await this.getSetting('housing_levy_rate');
        const rate = setting?.rate || 0.015;
        return Math.round(grossPay * rate);
    }

    /**
     * Calculates NSSF Tier I & II based on settings
     */
    static async calculateNSSF(grossPay: number): Promise<number> {
        const config = await this.getSetting('nssf_rates');
        if (!config) {
            // Fallback to basic 2024 rule if settings missing
            const pensionablePay = Math.min(grossPay, 18000);
            return Math.round(pensionablePay * 0.06);
        }

        // Tier 1 & 2 logic
        const rate = config.rate || 0.06;
        const tier1Limit = config.tier_1_limit || 7000;
        const tier2Limit = config.tier_2_limit || 36000;

        const pensionablePay = Math.min(grossPay, tier2Limit);
        return Math.round(pensionablePay * rate);
    }
}
