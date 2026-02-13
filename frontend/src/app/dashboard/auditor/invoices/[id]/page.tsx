'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { IOSButton } from '@/components/ui/ios-button';
import { IOSCard } from '@/components/ui/ios-card';
import { IOSBadge } from '@/components/ui/ios-badge';
import {
    ArrowLeft, FileText, Calendar, Building2, User,
    CreditCard, Package, Receipt, CheckCircle, Clock
} from 'lucide-react';
import { financeAPI } from '@/lib/api';
import { formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';

export default function InvoiceDetailsPage() {
    const { id } = useParams();
    const router = useRouter();
    const [invoice, setInvoice] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchInvoice();
    }, [id]);

    const fetchInvoice = async () => {
        try {
            setIsLoading(true);
            const response = await financeAPI.getSupplierInvoiceById(id as string);
            if (response.success) {
                setInvoice(response.data);
            } else {
                toast.error('Failed to load invoice details');
            }
        } catch (error) {
            console.error('Error:', error);
            toast.error('An error occurred while fetching invoice');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <DashboardLayout>
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!invoice) {
        return (
            <DashboardLayout>
                <div className="text-center py-12">
                    <p className="text-gray-500 mb-4">The requested invoice could not be found.</p>
                    <IOSButton variant="outline" onClick={() => router.back()} leftIcon={<ArrowLeft />}>
                        Go Back
                    </IOSButton>
                </div>
            </DashboardLayout>
        );
    }

    return (
        <DashboardLayout>
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">Invoice: {invoice.invoice_number}</h1>
                        <p className="text-sm text-gray-500">Full audit inspection for supplier invoice</p>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <IOSButton variant="outline" onClick={() => router.back()} leftIcon={<ArrowLeft />}>
                        Back to Search
                    </IOSButton>
                    <div className="flex gap-2">
                        <IOSBadge
                            color={
                                invoice.status === 'approved' ? 'success' :
                                    invoice.status === 'rejected' ? 'danger' : 'warning'
                            }
                            variant="light"
                        >
                            {invoice.status.toUpperCase()}
                        </IOSBadge>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <IOSCard className="md:col-span-2">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Receipt className="h-5 w-5 text-blue-600" />
                                Invoice Summary
                            </h3>
                            <div className="grid grid-cols-2 gap-y-4 gap-x-8">
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Supplier</p>
                                    <p className="font-medium flex items-center gap-2">
                                        <Building2 className="h-4 w-4 text-gray-400" />
                                        {invoice.supplier?.name || 'N/A'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                                    <p className="font-medium">{invoice.invoice_number}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Invoice Date</p>
                                    <p className="font-medium flex items-center gap-2">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        {formatDate(invoice.invoice_date)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-gray-500 mb-1">Due Date</p>
                                    <p className="font-medium flex items-center gap-2">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                        {formatDate(invoice.due_date)}
                                    </p>
                                </div>
                            </div>

                            {invoice.notes && (
                                <div className="mt-6 p-4 bg-gray-50 rounded-ios-lg">
                                    <p className="text-sm text-gray-500 mb-1">Notes</p>
                                    <p className="text-sm italic">"{invoice.notes}"</p>
                                </div>
                            )}
                        </div>
                    </IOSCard>

                    {/* Financial Summary */}
                    <IOSCard>
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-blue-600" />
                                Totals
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Subtotal</span>
                                    <span className="font-medium">KES {invoice.subtotal?.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-blue-600">
                                    <span>VAT ({invoice.vat_rate || 16}%)</span>
                                    <span className="font-medium">KES {invoice.vat_amount?.toLocaleString()}</span>
                                </div>
                                <div className="pt-3 border-t flex justify-between">
                                    <span className="font-bold">Total Amount</span>
                                    <span className="font-bold text-blue-600 text-lg">KES {invoice.total_amount?.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Item Breakdown */}
                    <IOSCard className="md:col-span-3">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <Package className="h-5 w-5 text-blue-600" />
                                Item Breakdown
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b">
                                            <th className="text-left py-3 font-semibold">Description</th>
                                            <th className="text-right py-3 font-semibold">Quantity</th>
                                            <th className="text-right py-3 font-semibold">Unit Price</th>
                                            <th className="text-right py-3 font-semibold">VAT</th>
                                            <th className="text-right py-3 font-semibold">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {invoice.items?.map((item: any, idx: number) => (
                                            <tr key={idx}>
                                                <td className="py-4">
                                                    <p className="font-medium">{item.description}</p>
                                                    {item.item?.name && <p className="text-xs text-gray-500">{item.item.name}</p>}
                                                </td>
                                                <td className="text-right py-4">{item.quantity}</td>
                                                <td className="text-right py-4">KES {item.unit_price?.toLocaleString()}</td>
                                                <td className="text-right py-4">{item.vat_rate}%</td>
                                                <td className="text-right py-4 font-semibold">KES {item.total_amount?.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </IOSCard>

                    {/* Audit Metadata */}
                    <IOSCard className="md:col-span-3">
                        <div className="p-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-blue-600" />
                                Audit Info
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-ios-lg">
                                    <User className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-xs text-gray-500">Recorded By</p>
                                        <p className="text-sm font-medium">{invoice.created_by_user ? `${invoice.created_by_user.first_name} ${invoice.created_by_user.last_name}` : 'Unknown'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-ios-lg">
                                    <Clock className="h-5 w-5 text-gray-400" />
                                    <div>
                                        <p className="text-xs text-gray-500">Processed At</p>
                                        <p className="text-sm font-medium">{formatDate(invoice.created_at)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </IOSCard>
                </div>
            </div>
        </DashboardLayout>
    );
}
