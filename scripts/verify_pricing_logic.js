
// Mock logic of calculatePricing for verification
function calculatePricing(roomRate, nights) {
    const subtotal = roomRate * nights;

    // Implicit Inclusive Pricing Logic
    const totalAmount = subtotal;
    const baseAmount = totalAmount / 1.26;
    const taxAmount = baseAmount * 0.16; // 16% VAT
    const serviceCharge = baseAmount * 0.10; // 10% Service Charge
    const discountAmount = 0;

    return {
        roomRate,
        subtotal: baseAmount,
        taxAmount,
        serviceCharge,
        discountAmount,
        totalAmount,
        nights
    };
}

const rate = 8000;
const nights = 1;

console.log(`Calculating pricing for Rate: ${rate}, Nights: ${nights}`);
const result = calculatePricing(rate, nights);

console.log('Result:', result);

const sumCheck = result.subtotal + result.taxAmount + result.serviceCharge;
console.log(`Sum Check (Base + Tax + Service): ${sumCheck}`);
console.log(`Expected Total: ${result.totalAmount}`);
console.log(`Difference: ${Math.abs(sumCheck - result.totalAmount)}`);

if (Math.abs(sumCheck - result.totalAmount) < 0.01) {
    console.log('SUCCESS: Components sum up to Total.');
} else {
    console.error('FAILURE: Components do not sum up to Total.');
}

if (result.totalAmount === 8000) {
    console.log('SUCCESS: Total Amount matches Inclusive Rate.');
} else {
    console.error(`FAILURE: Total Amount (${result.totalAmount}) does not match Rate (8000).`);
}
