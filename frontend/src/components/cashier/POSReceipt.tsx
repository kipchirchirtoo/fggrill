import React from 'react';

interface ReceiptProps {
    transaction: any;
    items: any[];
    businessInfo: any;
}

export const POSReceipt: React.FC<ReceiptProps> = ({ transaction, items, businessInfo }) => {
    return (
        <div id="pos-receipt" className="p-4 bg-white text-black font-mono text-sm max-w-[300px] border">
            <div className="text-center mb-4">
                <h1 className="text-lg font-bold uppercase">{businessInfo.name}</h1>
                <p>{businessInfo.address}</p>
                <p>Tel: {businessInfo.phone}</p>
                <p>PIN: {businessInfo.pin}</p>
            </div>

            <div className="border-t border-b border-dashed py-2 mb-4">
                <p>REF: {transaction.transaction_ref}</p>
                <p>DATE: {new Date(transaction.created_at).toLocaleString()}</p>
                <p>CASHIER: {transaction.cashier_name}</p>
            </div>

            <div className="mb-4">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-dashed">
                            <th className="text-left">ITEM</th>
                            <th className="text-right">QTY</th>
                            <th className="text-right">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                <td>{item.name}</td>
                                <td className="text-right">{item.qty}</td>
                                <td className="text-right">{item.line_total.toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="border-t border-dashed pt-2 space-y-1">
                <div className="flex justify-between font-bold text-lg">
                    <span>TOTAL</span>
                    <span>KES {transaction.total_amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                    <span>METHOD</span>
                    <span>{transaction.payment_method}</span>
                </div>
            </div>

            <div className="text-center mt-8 text-xs italic">
                <p>Thank you for choosing us!</p>
                <p>Powered by FG Grill POS</p>
            </div>
        </div>
    );
};
