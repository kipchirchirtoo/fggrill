/**
 * FAMOUS GATE HOTEL - SKU & Order Number Generation Service
 * 
 * SKU Format: FGH-[CATEGORY]-[PRODUCT]-[SERIAL]
 * Order Format: FGH-[TYPE]-YYYYMMDD-XXXX
 */

import { supabase } from '../config/database';
import { logger } from '../utils/logger';

// Category codes mapping
export const CATEGORY_CODES: Record<string, { code: string; name: string }> = {
  'Bar': { code: 'BAR', name: 'Bar & Beverages' },
  'Bar & Beverages': { code: 'BAR', name: 'Bar & Beverages' },
  'Kitchen': { code: 'KIT', name: 'Kitchen' },
  'Housekeeping': { code: 'HK', name: 'Housekeeping' },
  'Maintenance': { code: 'MNT', name: 'Maintenance' },
  'Laundry': { code: 'LDR', name: 'Laundry' },
  'Food & Beverage': { code: 'FNB', name: 'Food & Beverage' },
  'General': { code: 'GEN', name: 'General' },
  'Office': { code: 'OFF', name: 'Office' },
  'Auto': { code: 'AUTO', name: 'Auto-Generated' }
};

// Order number types
export type OrderType = 'STKIN' | 'STKOUT' | 'PO' | 'DN' | 'INV' | 'TRF';

/**
 * Get category code from category name
 */
export function getCategoryCode(category: string): string {
  const mapped = CATEGORY_CODES[category];
  if (mapped) return mapped.code;
  
  // Try to find partial match
  const lowerCat = category.toLowerCase();
  if (lowerCat.includes('bar') || lowerCat.includes('drink') || lowerCat.includes('beverage')) return 'BAR';
  if (lowerCat.includes('kitchen') || lowerCat.includes('food') || lowerCat.includes('cook')) return 'KIT';
  if (lowerCat.includes('house') || lowerCat.includes('clean')) return 'HK';
  if (lowerCat.includes('maint') || lowerCat.includes('repair') || lowerCat.includes('tool')) return 'MNT';
  if (lowerCat.includes('laund')) return 'LDR';
  if (lowerCat.includes('office') || lowerCat.includes('station')) return 'OFF';
  
  return 'GEN';
}

/**
 * Generate product code from item name (max 6 chars, uppercase, alphanumeric only)
 */
export function generateProductCode(itemName: string): string {
  if (!itemName) return 'ITEM';
  
  // Remove special characters, keep alphanumeric
  const cleaned = itemName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  
  // Take first 6 characters
  const code = cleaned.substring(0, 6);
  
  return code || 'ITEM';
}

/**
 * Get next serial number for a category
 */
export async function getNextSerial(categoryCode: string): Promise<number> {
  try {
    // Try to use database function if available
    const { data, error } = await supabase.rpc('get_next_sku_serial', {
      p_category_code: categoryCode
    });
    
    if (!error && data) {
      return data;
    }
    
    // Fallback: Manual increment
    const { data: category, error: catError } = await supabase
      .from('sku_categories')
      .select('current_serial')
      .eq('code', categoryCode)
      .single();
    
    let nextSerial = 1;
    
    if (category) {
      nextSerial = (category.current_serial || 0) + 1;
      await supabase
        .from('sku_categories')
        .update({ current_serial: nextSerial })
        .eq('code', categoryCode);
    } else {
      // Create new category
      await supabase
        .from('sku_categories')
        .insert({ code: categoryCode, name: categoryCode, current_serial: 1 });
    }
    
    return nextSerial;
  } catch (err) {
    logger.error('Error getting next serial:', err);
    // Return timestamp-based fallback
    return parseInt(Date.now().toString().slice(-4));
  }
}

/**
 * Check if SKU already exists
 */
export async function skuExists(sku: string): Promise<boolean> {
  const { data } = await supabase
    .from('simple_items')
    .select('sku')
    .eq('sku', sku)
    .single();
  
  return !!data;
}

/**
 * Find item by barcode
 */
export async function findByBarcode(barcode: string): Promise<any | null> {
  const { data } = await supabase
    .from('simple_items')
    .select('*')
    .eq('barcode', barcode)
    .single();
  
  return data;
}

/**
 * MAIN: Generate SKU for a product
 * 
 * @param category - Category name or code
 * @param itemName - Product name
 * @param barcode - Optional barcode (if scanned)
 * @returns Generated SKU string
 */
export async function generateSKU(
  category: string,
  itemName: string,
  barcode?: string
): Promise<{ sku: string; isAuto: boolean; categoryCode: string }> {
  
  // 1. If barcode provided, check if it already has an SKU
  if (barcode) {
    const existing = await findByBarcode(barcode);
    if (existing?.sku) {
      logger.info(`Found existing SKU for barcode ${barcode}: ${existing.sku}`);
      return { 
        sku: existing.sku, 
        isAuto: false, 
        categoryCode: existing.category_code || getCategoryCode(category)
      };
    }
  }
  
  // 2. Get category code
  const categoryCode = getCategoryCode(category || 'General');
  
  // 3. Generate product code from name
  const productCode = generateProductCode(itemName);
  
  // 4. Get next serial
  const serial = await getNextSerial(categoryCode);
  
  // 5. Build SKU: FGH-CATEGORY-PRODUCT-SERIAL
  let sku = `FGH-${categoryCode}-${productCode}-${serial.toString().padStart(4, '0')}`;
  
  // 6. Ensure uniqueness (in case of collision)
  let attempts = 0;
  while (await skuExists(sku) && attempts < 10) {
    const newSerial = await getNextSerial(categoryCode);
    sku = `FGH-${categoryCode}-${productCode}-${newSerial.toString().padStart(4, '0')}`;
    attempts++;
  }
  
  logger.info(`Generated SKU: ${sku} for "${itemName}" in category ${categoryCode}`);
  
  return { sku, isAuto: true, categoryCode };
}

/**
 * Generate Auto-SKU for unknown barcode
 */
export async function generateAutoSKU(barcode?: string): Promise<string> {
  const serial = await getNextSerial('AUTO');
  const sku = `FGH-AUTO-${serial.toString().padStart(4, '0')}`;
  
  logger.info(`Generated AUTO SKU: ${sku} for barcode ${barcode || 'unknown'}`);
  return sku;
}

/**
 * Generate Order Number
 * Format: FGH-TYPE-YYYYMMDD-XXXX
 */
export async function generateOrderNumber(type: OrderType): Promise<string> {
  try {
    // Try to use database function
    const { data, error } = await supabase.rpc('get_next_order_number', {
      p_type: type
    });
    
    if (!error && data) {
      return data;
    }
    
    // Fallback: Manual generation
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    
    // Get or create sequence for today
    const { data: seq } = await supabase
      .from('order_sequences')
      .select('current_number')
      .eq('sequence_type', type)
      .eq('sequence_date', today.toISOString().slice(0, 10))
      .single();
    
    let nextNum = 1;
    
    if (seq) {
      nextNum = (seq.current_number || 0) + 1;
      await supabase
        .from('order_sequences')
        .update({ current_number: nextNum })
        .eq('sequence_type', type)
        .eq('sequence_date', today.toISOString().slice(0, 10));
    } else {
      await supabase
        .from('order_sequences')
        .insert({ 
          sequence_type: type, 
          sequence_date: today.toISOString().slice(0, 10), 
          current_number: 1 
        });
    }
    
    const orderNum = `FGH-${type}-${dateStr}-${nextNum.toString().padStart(4, '0')}`;
    logger.info(`Generated Order Number: ${orderNum}`);
    
    return orderNum;
  } catch (err) {
    logger.error('Error generating order number:', err);
    // Fallback with timestamp
    const ts = Date.now().toString().slice(-8);
    return `FGH-${type}-${ts}`;
  }
}

/**
 * Preview SKU (without saving) - for frontend preview
 */
export function previewSKU(category: string, itemName: string): string {
  const categoryCode = getCategoryCode(category || 'General');
  const productCode = generateProductCode(itemName || 'ITEM');
  return `FGH-${categoryCode}-${productCode}-XXXX`;
}

/**
 * Get all category codes (for dropdown)
 */
export async function getCategories(): Promise<Array<{ code: string; name: string }>> {
  try {
    const { data } = await supabase
      .from('sku_categories')
      .select('code, name')
      .order('name');
    
    return data || Object.entries(CATEGORY_CODES).map(([_, v]) => v);
  } catch {
    return Object.entries(CATEGORY_CODES).map(([_, v]) => v);
  }
}
