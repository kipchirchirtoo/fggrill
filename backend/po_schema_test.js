const { z } = require('zod');

// ---- Replicate the exact Zod schema from purchaseOrder.schema.ts ----
const SourceModuleEnum = z.enum([
    'central_store', 'branch_store', 'branch_accounting', 'inventory', 'restaurant'
]);
const PaymentTermsEnum = z.enum([
    'cash','credit_7_days','credit_15_days','credit_30_days',
    'credit_45_days','credit_60_days','credit_90_days','advance_payment'
]);
const POItemSchema = z.object({
    item_id: z.string().min(1, 'Item ID is required'),
    quantity: z.number().positive('Quantity must be positive'),
    unit_price: z.number().nonnegative('Unit price cannot be negative'),
    tax_amount: z.number().nonnegative().optional().default(0),
    total_price: z.number().nonnegative().optional(),
});
const CreatePOSchema = z.object({
    supplier_id: z.string().uuid('Invalid supplier ID'),
    po_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    expected_delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    items: z.array(POItemSchema).min(1, 'At least one item is required'),
    payment_terms: PaymentTermsEnum.optional().default('credit_30_days'),
    delivery_terms: z.string().optional(),
    special_instructions: z.string().optional(),
    source_module: SourceModuleEnum.optional(),
    branch_id: z.number().int().positive().optional(),
    auto_approve: z.boolean().optional().default(false),
}).refine(
    (data) => {
        if (data.expected_delivery_date && data.po_date) {
            return new Date(data.expected_delivery_date) >= new Date(data.po_date);
        }
        return true;
    },
    { message: 'Expected delivery date cannot be before PO date', path: ['expected_delivery_date'] }
);

// ---- Simulate the exact payload the Flutter app sends ----
const testPayload = {
    supplier_id: 'f5ac3cdc-6220-4620-9a48-c8ef240a11a8',
    po_date: '2026-06-25',
    payment_terms: 'credit_30_days',
    delivery_terms: 'Central Store',
    auto_approve: false,
    source_module: 'central_store',
    items: [
        { item_id: 'FG-434', quantity: 200, unit_price: 0, tax_amount: 0, total_price: 0 },
        { item_id: 'FG-226', quantity: 40,  unit_price: 0, tax_amount: 0, total_price: 0 },
        { item_id: 'FG-277', quantity: 24,  unit_price: 0, tax_amount: 0, total_price: 0 },
    ]
};

console.log("=== TESTING EXACT FLUTTER PAYLOAD AGAINST ZOD SCHEMA ===\n");
const result = CreatePOSchema.safeParse(testPayload);
if (result.success) {
    console.log("✅ Validation PASSED - payload is valid");
    console.log("Parsed data:", JSON.stringify(result.data, null, 2).substring(0, 300));
} else {
    console.log("❌ Validation FAILED - errors:");
    result.error.errors.forEach(e => {
        console.log(`  Path: ${e.path.join('.')} | Code: ${e.code} | Message: ${e.message}`);
    });
}

// Also test with quantity as string (common Flutter serialization issue)
console.log("\n=== TESTING WITH QUANTITY AS STRING (common Flutter bug) ===");
const payloadWithStringQty = {
    ...testPayload,
    items: [
        { item_id: 'FG-434', quantity: '200', unit_price: 0, tax_amount: 0, total_price: 0 },
    ]
};
const r2 = CreatePOSchema.safeParse(payloadWithStringQty);
if (r2.success) {
    console.log("✅ String quantity PASSED");
} else {
    console.log("❌ String quantity FAILED:");
    r2.error.errors.forEach(e => {
        console.log(`  Path: ${e.path.join('.')} | Code: ${e.code} | Message: ${e.message}`);
    });
}

// Test with unit_price as string
console.log("\n=== TESTING WITH unit_price AS STRING ===");
const payloadWithStringPrice = {
    ...testPayload,
    items: [
        { item_id: 'FG-434', quantity: 200, unit_price: '0', tax_amount: 0, total_price: 0 },
    ]
};
const r3 = CreatePOSchema.safeParse(payloadWithStringPrice);
if (r3.success) {
    console.log("✅ String unit_price PASSED");
} else {
    console.log("❌ String unit_price FAILED:");
    r3.error.errors.forEach(e => {
        console.log(`  Path: ${e.path.join('.')} | Code: ${e.code} | Message: ${e.message}`);
    });
}
