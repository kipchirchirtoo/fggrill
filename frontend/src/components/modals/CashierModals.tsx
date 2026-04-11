import React, { useState } from 'react';
import {
    X, Receipt, User, Building2, Calendar,
    DollarSign, FileText, Plus, Hash, CheckCircle,
    Waves, Car, Shirt, Sparkles, ChevronRight,
    Trash2, PlusCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IOSButton } from '../ui/ios-button';
import { IOSCard } from '../ui/ios-card';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { cashierAPI } from '@/lib/api';
import { printHtml as printHtmlHelper } from '@/lib/tauri-print';
import { useBranch } from '@/lib/branch-context';
import { useAuth } from '@/lib/auth-context';

export const revenueStreams = [
    { id: 'Conference', label: 'Conference / Hall', icon: Building2, color: 'text-indigo-600', bg: 'bg-indigo-50', activeBg: 'bg-indigo-600', activeBorder: 'border-indigo-600' },
    { id: 'Pool', label: 'Swimming Pool', icon: Waves, color: 'text-cyan-600', bg: 'bg-cyan-50', activeBg: 'bg-cyan-600', activeBorder: 'border-cyan-600' },
    { id: 'CarWash', label: 'Car Wash', icon: Car, color: 'text-blue-600', bg: 'bg-blue-50', activeBg: 'bg-blue-600', activeBorder: 'border-blue-600' },
    { id: 'Laundry', label: 'Laundry Service', icon: Shirt, color: 'text-violet-600', bg: 'bg-violet-50', activeBg: 'bg-violet-600', activeBorder: 'border-violet-600' },
    { id: 'Other', label: 'Other Services', icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-50', activeBg: 'bg-amber-600', activeBorder: 'border-amber-600' }
];

export const printBrandedBill = ({ billData, activeBranch, user, items, billType, totalAmount }: {
    billData: any,
    activeBranch: any,
    user: any,
    items: any[],
    billType: string,
    totalAmount: number
}) => {
    const branch = activeBranch || { name: 'Famous Gates Hotels', location: 'Bomet, Kenya', settings: { phone: '0706782828', pin: 'P051503313Y', email: 'famousgatesbmt@gmail.com' } };
    const companyName = 'FAMOUSGATE HOTELS';
    const companyAddress = branch.location || 'Bomet, Kenya';
    const companyPhone = branch.settings?.phone || '0706782828';
    const companyEmail = branch.settings?.email || 'famousgatesbmt@gmail.com';
    const companyPin = branch.settings?.pin || 'P051503313Y';
    const serviceLabel = revenueStreams.find(s => s.id === billType)?.label || billType;
    const billNumber = billData?.bill_number || billData?.credit_number || `DYN-${Date.now().toString(36).toUpperCase()}`;
    const createdBy = `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || 'Staff';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const printHtml = `
        <html>
        <head>
            <title>Bill ${billNumber} - ${companyName}</title>
            <style>
                @page { size: A5; margin: 10mm; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Courier New', 'Courier', 'Lucida Console', monospace;
                    color: #111;
                    background: #fff;
                    font-size: 11px;
                    line-height: 1.4;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }
                .bill {
                    max-width: 480px;
                    margin: 0 auto;
                    padding: 15px;
                    border: 2px solid #111;
                }
                .dbl-line { border-top: 3px double #111; margin: 10px 0; }
                .single-line { border-top: 1px solid #111; margin: 8px 0; }
                .dash-line { border-top: 1px dashed #555; margin: 8px 0; }
                .center { text-align: center; }
                .right { text-align: right; }
                .bold { font-weight: bold; }
                .row { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 0; }
                
                /* Header */
                .header { text-align: center; padding-bottom: 8px; }
                .logo { width: 50px; height: 50px; object-fit: contain; margin-bottom: 4px; }
                .co-name { font-size: 18px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; }
                .co-details { font-size: 9px; color: #444; letter-spacing: 0.5px; line-height: 1.6; margin-top: 2px; }
                .bill-title {
                    font-size: 14px;
                    font-weight: bold;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    margin-top: 10px;
                    padding: 5px 0;
                    border-top: 1px solid #111;
                    border-bottom: 1px solid #111;
                }

                /* Info Section */
                .info-section { padding: 8px 0; }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 3px 0;
                    font-size: 10px;
                }
                .info-row .lbl {
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #555;
                    font-size: 9px;
                    min-width: 100px;
                }
                .info-row .data { font-weight: bold; text-align: right; }

                /* Items Table */
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 10px 0;
                }
                .items-table th {
                    text-align: left;
                    border-bottom: 1px solid #111;
                    padding: 4px 0;
                    font-size: 9px;
                    text-transform: uppercase;
                    color: #555;
                }
                .items-table td {
                    padding: 5px 0;
                    border-bottom: 1px dashed #eee;
                }
                .item-desc { font-weight: bold; }
                .item-qty { text-align: center; width: 40px; }
                .item-price { text-align: right; width: 80px; }
                .item-total { text-align: right; width: 90px; font-weight: bold; }

                /* Totals */
                .totals-section {
                    margin-top: 10px;
                    border-top: 2px solid #111;
                    padding-top: 5px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 3px 0;
                }
                .total-grand {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 0;
                    font-size: 16px;
                    font-weight: bold;
                    border-top: 1px solid #111;
                    margin-top: 5px;
                }

                /* Remarks */
                .remarks {
                    border: 1px dashed #999;
                    padding: 8px 12px;
                    margin: 10px 0;
                    font-size: 10px;
                }
                .remarks-hdr { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #555; font-weight: bold; margin-bottom: 3px; }

                /* Signatures */
                .sig-section { margin: 16px 0 10px; }
                .sig-row { display: flex; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
                .sig-block { flex: 1; text-align: center; }
                .sig-line { border-bottom: 1px solid #111; margin-bottom: 3px; height: 20px; }
                .sig-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #555; }

                /* Footer */
                .footer { text-align: center; font-size: 8px; color: #777; padding-top: 8px; }
                .footer-notice { font-size: 9px; margin-bottom: 4px; letter-spacing: 0.5px; }
                .footer-sys { font-size: 7px; color: #aaa; margin-top: 8px; padding-top: 6px; border-top: 1px dashed #ccc; }
            </style>
        </head>
        <body>
            <div class="bill">
                <!-- Header -->
                <div class="header">
                    <img src="/fglogo.png" class="logo" onerror="this.style.display='none'" />
                    <div class="co-name">${companyName}</div>
                    <div class="co-details">
                        ${companyAddress}<br/>
                        Tel: ${companyPhone} | ${companyEmail}<br/>
                        ${companyPin ? `KRA PIN: ${companyPin}` : ''}
                    </div>
                    <div class="bill-title">SERVICE BILL</div>
                </div>

                <!-- Bill Info -->
                <div class="info-section">
                    <div class="info-row">
                        <span class="lbl">Bill No:</span>
                        <span class="data">${billNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">Date:</span>
                        <span class="data">${dateStr} | ${timeStr}</span>
                    </div>
                    <div class="dash-line"></div>
                    <div class="info-row">
                        <span class="lbl">Customer:</span>
                        <span class="data">${(billData.customer_name || 'WALK IN').toUpperCase()}</span>
                    </div>
                    ${billData.room_number ? `
                    <div class="info-row">
                        <span class="lbl">Room/Ref:</span>
                        <span class="data">${billData.room_number}</span>
                    </div>` : ''}
                    <div class="info-row">
                        <span class="lbl">Service Category:</span>
                        <span class="data">${serviceLabel}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">Branch:</span>
                        <span class="data">${(branch.name || 'Main Branch').toUpperCase()}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">Issued By:</span>
                        <span class="data">${createdBy.toUpperCase()}</span>
                    </div>
                </div>

                <!-- Items Table -->
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>Description</th>
                            <th class="center">Qty</th>
                            <th class="right">Price</th>
                            <th class="right">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${(items && items.length > 0 ? items : [{ description: serviceLabel, quantity: 1, unitPrice: totalAmount }]).map(item => `
                            <tr>
                                <td class="item-desc">${item.description || 'Service Item'}</td>
                                <td class="item-qty center">${item.quantity}</td>
                                <td class="item-price right">${item.unitPrice.toLocaleString()}</td>
                                <td class="item-total right">${(item.quantity * item.unitPrice).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>

                <!-- Totals -->
                <div class="totals-section">
                    <div class="total-row">
                        <span class="lbl">SUBTOTAL</span>
                        <span class="data">KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="total-row">
                        <span class="lbl">VAT (INCL 16%)</span>
                        <span class="data">KES ${Math.round(totalAmount - (totalAmount / 1.16)).toLocaleString()}.00</span>
                    </div>
                    <div class="total-grand">
                        <span>TOTAL DUE</span>
                        <span>KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                ${billData.remarks ? `
                <!-- Remarks -->
                <div class="remarks">
                    <div class="remarks-hdr">Remarks:</div>
                    <div>${billData.remarks}</div>
                </div>` : ''}

                <!-- Signature Lines -->
                <div class="sig-section">
                    <div class="sig-row">
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Accountant</div>
                        </div>
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Auditor</div>
                        </div>
                    </div>
                    <div class="sig-row">
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Authorized By</div>
                        </div>
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">Received By</div>
                        </div>
                    </div>
                </div>

                <div class="dbl-line"></div>

                <!-- Footer -->
                <div class="footer">
                    <div class="footer-notice">This is a system-generated bill.</div>
                    <div class="footer-notice">Present for payment. Thank you for your patronage.</div>
                    <div>${companyName} &copy; ${now.getFullYear()}</div>
                    <div class="footer-sys">
                        Powered by Hirall Systems | +254 710 944 249
                    </div>
                </div>
            </div>

            <script>
                window.onload = function() {
                    setTimeout(function() { window.print(); }, 300);
                };
            </script>
        </body>
        </html>
    `;

    printHtmlHelper(printHtml, { width: 600, height: 800, title: `Bill ${billNumber}` });
};

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export const CreateDynamicBillModal = ({ isOpen, onClose, onSuccess }: ModalProps) => {
    const { user } = useAuth() as any;
    const { activeBranchId, activeBranch } = useBranch();
    const [isLoading, setIsLoading] = useState(false);

    const initialFormData = {
        customer_name: '',
        room_number: '',
        bill_type: 'Conference',
        total_amount: '0',
        remarks: '',
        items: [{ description: '', quantity: 1, unitPrice: 0 }],
        due_date: new Date().toISOString().split('T')[0]
    };

    const [formData, setFormData] = useState(initialFormData);

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { description: '', quantity: 1, unitPrice: 0 }]
        });
    };

    const handleRemoveItem = (index: number) => {
        if (formData.items.length <= 1) return;
        const newItems = formData.items.filter((_, i) => i !== index);
        setFormData({ ...formData, items: newItems });
    };

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        (newItems[index] as any)[field] = value;
        setFormData({ ...formData, items: newItems });
    };

    // Auto-calculate total
    React.useEffect(() => {
        const total = formData.items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
        setFormData(prev => ({ ...prev, total_amount: total.toString() }));
    }, [formData.items]);

    React.useEffect(() => {
        if (!isOpen) {
            setFormData(initialFormData);
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.customer_name || !formData.total_amount) {
            toast.error('Please fill in customer name and amount');
            return;
        }

        if (!activeBranchId) {
            toast.error('No active branch selected');
            return;
        }

        setIsLoading(true);
        try {
            const res = await cashierAPI.createUnpaidBill({
                ...formData,
                branch_id: activeBranchId,
                total_amount: parseFloat(formData.total_amount),
                customer_type: 'walk_in',
            });

            if (res.success) {
                toast.success('Bill created & printing...');
                printBrandedBill({
                    billData: res.data,
                    activeBranch,
                    user,
                    items: formData.items,
                    billType: formData.bill_type,
                    totalAmount: parseFloat(formData.total_amount)
                });
                onSuccess?.();
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to create bill');
        } finally {
            setIsLoading(false);
        }
    };

    const selectedStream = revenueStreams.find(s => s.id === formData.bill_type);

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
                initial={{ opacity: 0, scale: 0.92, y: 40 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: 40 }}
                transition={{ type: "spring", damping: 28, stiffness: 350 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-10 flex flex-col"
                style={{ maxHeight: 'min(92vh, 850px)' }}
            >
                {/* ── Fixed Header ── */}
                <div className="shrink-0 px-6 py-5 border-b border-stone-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg shadow-emerald-500/25">
                            <Receipt className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-extrabold text-stone-900 tracking-tight">Create Dynamic Bill</h2>
                            <p className="text-sm text-stone-500 mt-0.5">Generate a service bill for non-F&B revenue</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onClose(); }}
                        className="p-2.5 hover:bg-stone-100 rounded-xl transition-all group active:scale-90"
                    >
                        <X className="h-5 w-5 text-stone-400 group-hover:text-stone-700" />
                    </button>
                </div>

                {/* ── Scrollable Body ── */}
                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6" style={{ scrollbarWidth: 'thin', scrollbarColor: '#d6d3d1 transparent' }}>

                        {/* Service Type Selection */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                Service Category
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {revenueStreams.map((stream) => {
                                    const isActive = formData.bill_type === stream.id;
                                    return (
                                        <button
                                            key={stream.id}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, bill_type: stream.id })}
                                            className={`relative flex flex-col items-center gap-2 px-3 py-3.5 rounded-2xl border-2 transition-all duration-200 group
                                                ${isActive
                                                    ? `${stream.activeBorder} bg-white shadow-md`
                                                    : 'border-stone-100 bg-stone-50/50 hover:border-stone-200 hover:bg-white active:scale-95'
                                                }`}
                                        >
                                            <div className={`p-2 rounded-xl transition-all ${isActive
                                                ? `${stream.activeBg} shadow-sm`
                                                : `${stream.bg} group-hover:scale-105`
                                                }`}>
                                                <stream.icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : stream.color}`} style={{ width: '18px', height: '18px' }} />
                                            </div>
                                            <span className={`text-[10px] sm:text-[11px] font-bold leading-tight text-center
                                                ${isActive ? 'text-stone-900' : 'text-stone-500 group-hover:text-stone-700'}`}>
                                                {stream.label}
                                            </span>
                                            {isActive && (
                                                <motion.div
                                                    layoutId="service-indicator"
                                                    className={`absolute -top-1 -right-1 w-4 h-4 ${stream.activeBg} rounded-full flex items-center justify-center shadow-sm`}
                                                    transition={{ type: "spring", damping: 20, stiffness: 400 }}
                                                >
                                                    <CheckCircle className="h-2.5 w-2.5 text-white" />
                                                </motion.div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Customer Details */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                Customer Details
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="relative group">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors z-10" />
                                    <Input
                                        id="dyn_customer_name"
                                        name="customer_name"
                                        required
                                        placeholder="Customer / Company Name *"
                                        value={formData.customer_name}
                                        onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                                        className="pl-10 h-12 bg-stone-50/80 border-stone-200 hover:border-stone-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all rounded-xl text-sm"
                                    />
                                </div>
                                <div className="relative group">
                                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors z-10" />
                                    <Input
                                        id="dyn_room_number"
                                        name="room_number"
                                        placeholder="Room / Ref # (Optional)"
                                        value={formData.room_number}
                                        onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                                        className="pl-10 h-12 bg-stone-50/80 border-stone-200 hover:border-stone-300 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Line Items Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                    Line Items
                                </label>
                                <button
                                    type="button"
                                    onClick={handleAddItem}
                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-emerald-50 transition-all"
                                >
                                    <PlusCircle className="h-3.5 w-3.5" />
                                    Add Item
                                </button>
                            </div>
                            <div className="space-y-2">
                                {formData.items.map((item, index) => (
                                    <div key={index} className="flex items-start gap-2 bg-stone-50/50 p-3 rounded-xl border border-stone-100 group hover:border-stone-200 transition-all">
                                        <div className="flex-1 space-y-2">
                                            <Input
                                                placeholder="Service Description (e.g. Hall Hire)"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                                                className="h-9 bg-white text-sm"
                                            />
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative group/qty">
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">QTY</span>
                                                    <Input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                                        className="h-9 bg-white text-sm pl-3 pr-10"
                                                    />
                                                </div>
                                                <div className="flex-[2] relative group/price">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-stone-400">KES</span>
                                                    <Input
                                                        type="number"
                                                        value={item.unitPrice}
                                                        onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                                                        className="h-9 bg-white text-sm pl-10"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveItem(index)}
                                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all self-center"
                                            disabled={formData.items.length <= 1}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Billing Summary */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                Billing Summary
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-4 bg-emerald-50/50 border-2 border-emerald-100 rounded-2xl flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Total Amount</span>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-sm font-bold text-emerald-600">KES</span>
                                        <span className="text-2xl font-black text-emerald-700 tracking-tight">
                                            {Number(formData.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 bg-stone-50 border border-stone-100 rounded-2xl">
                                    <label className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 block">Due Date</label>
                                    <div className="relative">
                                        <Calendar className="absolute left-0 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                                        <input
                                            type="date"
                                            value={formData.due_date}
                                            onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                                            className="w-full pl-5 bg-transparent border-none text-sm font-bold text-stone-700 outline-none p-0 cursor-pointer"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Remarks */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-stone-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-stone-400 rounded-full"></div>
                                Additional Remarks <span className="text-stone-300 font-normal normal-case">(Optional)</span>
                            </label>
                            <div className="relative group">
                                <FileText className="absolute left-3.5 top-3.5 h-4 w-4 text-stone-400 group-focus-within:text-emerald-500 transition-colors" />
                                <textarea
                                    id="dyn_remarks"
                                    name="remarks"
                                    rows={3}
                                    placeholder="e.g. Conference for ABC Corp, 50 pax, full day..."
                                    value={formData.remarks}
                                    onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                                    className="w-full pl-10 pr-4 py-3 bg-stone-50/80 border border-stone-200 rounded-xl text-sm focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all resize-none group-hover:border-stone-300"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Fixed Footer ── */}
                    <div className="shrink-0 px-6 py-4 border-t border-stone-100 bg-stone-50/50 flex items-center gap-3">
                        <div className="mr-auto" />
                        <IOSButton
                            type="button"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); onClose(); }}
                            className="px-6 h-12 rounded-xl font-bold border-stone-200 text-stone-600 hover:bg-stone-100 transition-all font-sans"
                        >
                            Cancel
                        </IOSButton>
                        <IOSButton
                            type="submit"
                            loading={isLoading}
                            className="px-8 h-12 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white hover:from-emerald-700 hover:to-emerald-600 active:scale-[0.97] rounded-xl shadow-lg shadow-emerald-500/25 font-bold transition-all flex items-center gap-2 font-sans"
                        >
                            <Plus className="h-4 w-4" />
                            Create Bill
                        </IOSButton>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export const BillDetailsModal = ({
    isOpen, onClose, onSuccess, bill, type = 'unpaid'
}: ModalProps & { bill: any; type?: 'unpaid' | 'credit' }) => {
    const { user } = useAuth() as any;
    const { activeBranch } = useBranch();
    const [isConfirming, setIsConfirming] = useState(false);

    if (!isOpen || !bill) return null;

    const handleConfirm = async (role: 'accountant' | 'auditor') => {
        setIsConfirming(true);
        try {
            const res = type === 'credit'
                ? await cashierAPI.confirmCreditBill(bill.id, role)
                : await cashierAPI.confirmUnpaidBill(bill.id, role);

            if (res.success) {
                toast.success(`Bill confirmed by ${role}`);
                onSuccess?.();
            }
        } catch (error: any) {
            toast.error(error.message || 'Confirmation failed');
        } finally {
            setIsConfirming(false);
        }
    };

    const isAccountant = ['super_admin', 'branch_manager', 'accountant', 'branch_accountant'].includes(user?.role);
    const isAuditor = ['super_admin', 'auditor'].includes(user?.role);

    const billNumber = bill.bill_number || bill.credit_number;
    const amount = bill.total_amount || bill.grand_total;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
                >
                    <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-stone-100 rounded-xl">
                                <Receipt className="h-5 w-5 text-stone-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Bill Details</h3>
                                <p className="text-xs text-stone-400">View and confirm transaction</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-full transition-colors">
                            <X className="h-5 w-5 text-stone-400" />
                        </button>
                    </div>

                    <div className="p-5 space-y-6">
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Bill Number</p>
                                <p className="font-mono font-bold text-stone-900">{billNumber}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Customer</p>
                                <p className="font-bold text-stone-900">{bill.customer_name || 'Walk-in'}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Total Amount</p>
                                <p className="text-lg font-black text-emerald-600">KES {parseFloat(amount).toLocaleString()}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase mb-1">Date Issued</p>
                                <p className="font-medium text-stone-600">{new Date(bill.created_at).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-stone-50 rounded-2xl space-y-3">
                            <h4 className="text-xs font-bold text-stone-400 uppercase">Confirmation Status</h4>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1 rounded-full ${bill.accountant_confirmed_at ? 'bg-emerald-100 text-emerald-600' : 'bg-stone-200 text-stone-400'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">Accountant</span>
                                </div>
                                {bill.accountant_confirmed_at ? (
                                    <span className="text-xs text-stone-400">{new Date(bill.accountant_confirmed_at).toLocaleDateString()}</span>
                                ) : (
                                    isAccountant && (
                                        <IOSButton size="sm" onClick={() => handleConfirm('accountant')} loading={isConfirming}>Confirm</IOSButton>
                                    )
                                )}
                            </div>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className={`p-1 rounded-full ${bill.auditor_confirmed_at ? 'bg-blue-100 text-blue-600' : 'bg-stone-200 text-stone-400'}`}>
                                        <CheckCircle className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium">Auditor</span>
                                </div>
                                {bill.auditor_confirmed_at ? (
                                    <span className="text-xs text-stone-400">{new Date(bill.auditor_confirmed_at).toLocaleDateString()}</span>
                                ) : (
                                    isAuditor && (
                                        <IOSButton
                                            size="sm"
                                            onClick={() => handleConfirm('auditor')}
                                            loading={isConfirming}
                                            disabled={!bill.accountant_confirmed_at}
                                            className={!bill.accountant_confirmed_at ? 'opacity-50 cursor-not-allowed' : ''}
                                        >
                                            Verify
                                        </IOSButton>
                                    )
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <IOSButton variant="ghost" onClick={onClose} className="flex-1">Close</IOSButton>
                            <IOSButton
                                className="flex-1"
                                onClick={() => printBrandedBill({
                                    billData: bill,
                                    activeBranch,
                                    user,
                                    items: bill.items || [],
                                    billType: bill.bill_type || 'Other',
                                    totalAmount: parseFloat(bill.total_amount || bill.grand_total || '0')
                                })}
                            >
                                Print Copy
                            </IOSButton>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};

export const CashierModals = {
    CreateDynamicBillModal,
    BillDetailsModal
};
