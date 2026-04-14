import React from 'react';

interface ReceiptProps {
    transaction?: any;
    items?: any[];
    businessInfo?: any;
    // Allow passing data directly or structured
    [key: string]: any;
}

export const POSReceipt: React.FC<ReceiptProps> = (props) => {
    // extract data whether it comes from props directly or nested
    const transaction = props.transaction || {};
    const items = Array.isArray(props.items) ? props.items : (Array.isArray(transaction.items) ? transaction.items : []);

    // Default business info if not provided
    const businessInfo = props.businessInfo || {
        name: "FamousGateHotels",
        address: "Bomet, Kenya",
        phone: "0706 782 828",
        email: "famous-gates-hotelsbmt@gmail.com",
        pin: "P051234567Z"
    };

    // Helper to format date
    const formatDate = (date: any) => {
        try {
            if (!date) return new Date().toLocaleString();
            return new Date(date).toLocaleString('en-US', {
                month: 'numeric',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true
            });
        } catch (e) {
            return new Date().toLocaleString();
        }
    };

    const totalAmount = transaction.total_amount || transaction.total || 0;
    const subtotal = totalAmount / 1.16; // Assuming 16% VAT inclusive
    const tax = totalAmount - subtotal;
    const receiptNumber = transaction.transaction_ref || transaction.receipt_number || 'N/A';
    const staffLabel = transaction.staff_label || (transaction.table_number ? 'Waiter' : 'Cashier');
    const staffName = transaction.served_by || transaction.cashier_name || 'Staff';

    return (
        <div id="pos-receipt" className="p-2 bg-white text-black font-mono text-[10px] w-[80mm] leading-tight mx-auto">
            {/* Header */}
            <div className="text-center mb-2">
                <div className="flex justify-center mb-1" suppressHydrationWarning>
                    <img src="/fglogo.png" alt="FG Logo" className="w-12 h-12 object-contain" suppressHydrationWarning />
                </div>
                <h1 className="text-sm font-bold uppercase">{businessInfo.name}</h1>
                <p>{businessInfo.address}</p>
                <p>Tel: {businessInfo.phone}</p>
                <p className="text-[9px] mt-1">CASH RECEIPT</p>
            </div>

            <div className="border-t border-b border-dashed border-black py-1 mb-2 space-y-0.5">
                <p>Receipt #: {receiptNumber}</p>
                <p>Date: {formatDate(transaction.created_at || transaction.date)}</p>

                {transaction.table_number && <p>Table: {transaction.table_number}</p>}
                {transaction.room_number && <p>Room: {transaction.room_number}</p>}
                {transaction.customer_name && <p>Customer: {transaction.customer_name}</p>}

                <p>{staffLabel}: {staffName}</p>
            </div>

            {/* Items */}
            <div className="mb-2">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-black">
                            <th className="w-8">Qty</th>
                            <th>Description</th>
                            <th className="text-right">Price</th>
                        </tr>
                    </thead>
                    <tbody className="text-[10px]">
                        {items.map((item: any, idx: number) => {
                            const qty = item.qty || item.quantity || 1;
                            const name = item.name || item.item_name || 'Item';
                            const price = item.line_total || item.total || (item.unit_price * qty) || 0;

                            return (
                                <tr key={idx}>
                                    <td className="align-top py-0.5">{qty}</td>
                                    <td className="align-top py-0.5 pr-1">{name}</td>
                                    <td className="align-top py-0.5 text-right">{price.toLocaleString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Totals */}
            <div className="border-t border-dashed border-black pt-1 mb-2 space-y-0.5">
                <div className="flex justify-between">
                    <span>SUBTOTAL</span>
                    <span>KES {subtotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="flex justify-between">
                    <span>TAX (16% incl.)</span>
                    <span>KES {tax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>

                <div className="flex justify-between font-bold text-xs mt-1 border-t border-black pt-1">
                    <span>TOTAL:</span>
                    <span>KES {totalAmount.toLocaleString()}</span>
                </div>
            </div>

            {/* Payment Info */}
            <div className="mb-3 space-y-0.5">
                <div className="flex justify-between">
                    <span>Payment:</span>
                    <span className="uppercase">{transaction.payment_method || 'Cash'}</span>
                </div>
                {transaction.amount_paid && (
                    <div className="flex justify-between">
                        <span>Paid:</span>
                        <span>KES {parseFloat(transaction.amount_paid).toLocaleString()}</span>
                    </div>
                )}
                {transaction.change_amount > 0 && (
                    <div className="flex justify-between">
                        <span>Change:</span>
                        <span>KES {parseFloat(transaction.change_amount).toLocaleString()}</span>
                    </div>
                )}
                {transaction.mpesa_code && (
                    <p className="mt-1">Ref: {transaction.mpesa_code}</p>
                )}
            </div>

            {/* Footer */}
            <div className="text-center border-t border-dashed border-black pt-2 mb-2">
                <p className="font-bold text-xs">THANK YOU!</p>
                <p className="text-[9px]">Please come again</p>
                <p className="text-[9px]">{businessInfo.email}</p>
            </div>

            {/* Barcode Placeholder */}
            {receiptNumber !== 'N/A' && (
                <div className="text-center mb-2">
                    <div className="h-8 bg-black w-3/4 mx-auto mb-1 opacity-20"></div>
                    <p className="text-[8px]">{receiptNumber}</p>
                </div>
            )}

            {/* Branding */}
            <div className="text-center text-[7px] text-gray-500 mt-2">
                <p className="font-bold">System managed and made by Hirall</p>
                <p>+254 710 944 249 | admin@hirall.com</p>
            </div>
        </div>
    );
};
