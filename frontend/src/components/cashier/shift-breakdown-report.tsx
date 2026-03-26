'use client';

import { CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface ShiftBreakdownReportProps {
    shift: any;
}

const KES = (v: number) =>
    `KES ${(v || 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Row = ({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-slate-50 last:border-0">
        <span className={`text-xs ${bold ? 'font-black text-slate-800' : 'text-slate-500 font-medium'}`}>{label}</span>
        <span className={`text-xs font-black tabular-nums ${color || (bold ? 'text-slate-900' : 'text-slate-700')}`}>{value}</span>
    </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
        </div>
        <div className="px-5 py-3 space-y-0.5">{children}</div>
    </div>
);

export function ShiftBreakdownReport({ shift }: ShiftBreakdownReportProps) {
    const openingFloat   = Number(shift.opening_float || 0);
    const cashSales      = Number(shift.total_cash_sales || 0);
    const mpesaSales     = Number(shift.total_mpesa_sales || 0);
    const cardSales      = Number(shift.total_card_sales || 0);
    const totalSales     = Number(shift.total_sales || 0);
    const otherSales     = Math.max(0, totalSales - cashSales - mpesaSales - cardSales);

    const creditCreated  = Number(shift.credit_bills_taken || 0);
    const creditPaid     = Number(shift.paid_bills_value || 0);
    const creditOutstanding = Math.max(0, creditCreated - creditPaid);

    const expectedClosing = Number(shift.expected_closing_float || (openingFloat + cashSales + creditPaid));
    const actualClosing   = Number(shift.closing_float || 0);
    const variance        = Number(shift.variance ?? (actualClosing - expectedClosing));

    const varianceLabel = variance === 0 ? 'Balanced' : variance > 0 ? 'Surplus' : 'Shortage';
    const varianceColor = variance === 0 ? 'text-emerald-600' : variance > 0 ? 'text-blue-600' : 'text-rose-600';
    const varianceBg    = variance === 0 ? 'bg-emerald-50 border-emerald-200' : variance > 0 ? 'bg-blue-50 border-blue-200' : 'bg-rose-50 border-rose-200';
    const VarianceIcon  = variance === 0 ? CheckCircle2 : variance > 0 ? TrendingUp : TrendingDown;

    // Revenue streams
    const streams = [
        { label: 'Restaurant',    value: shift.restaurant_revenue,    na: false },
        { label: 'Bar',           value: shift.bar_revenue,           na: false },
        { label: 'Rooms',         value: shift.room_booking_revenue,  na: shift.rooms_na },
        { label: 'Conference',    value: shift.conference_revenue,    na: shift.conference_na },
        { label: 'Swimming Pool', value: shift.swimming_pool_revenue, na: shift.pool_na },
        { label: 'Pool Tokens',   value: shift.pool_token_revenue,    na: false },
        { label: 'Other',         value: shift.other_revenue,         na: false },
    ];
    const streamSubtotal = streams.filter(s => !s.na).reduce((sum, s) => sum + Number(s.value || 0), 0);

    return (
        <div className="space-y-3 text-xs">

            {/* 1. Cash Reconciliation */}
            <Section title="1. Cash Reconciliation">
                <Row label="Opening Float"              value={KES(openingFloat)} />
                <Row label="+ Cash Sales"               value={KES(cashSales)} />
                <Row label="+ Credit Payments Received" value={KES(creditPaid)} />
                <Row label="= Expected Closing Amount"  value={KES(expectedClosing)} bold />
                <Row label="Actual Cash Counted"        value={KES(actualClosing)} bold />
            </Section>

            {/* 2. Sales by Payment Method */}
            <Section title="2. Sales by Payment Method">
                <Row label="Cash Sales"   value={cashSales  > 0 ? KES(cashSales)  : '—'} />
                <Row label="M-Pesa Sales" value={mpesaSales > 0 ? KES(mpesaSales) : '—'} />
                <Row label="Card Sales"   value={cardSales  > 0 ? KES(cardSales)  : '—'} />
                <Row label="Other Sales"  value={otherSales > 0 ? KES(otherSales) : '—'} />
                <Row label="Total Sales"  value={KES(totalSales)} bold />
            </Section>

            {/* 3. Sales by Revenue Stream */}
            <Section title="3. Sales by Revenue Stream">
                {streams.map(s => (
                    <Row
                        key={s.label}
                        label={s.label}
                        value={s.na ? 'N/A' : Number(s.value || 0) > 0 ? KES(Number(s.value)) : '—'}
                        color={s.na ? 'text-slate-300' : undefined}
                    />
                ))}
                <Row label="Stream Subtotal" value={KES(streamSubtotal)} bold />
                {Math.abs(streamSubtotal - totalSales) > 0.01 && (
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-[9px] font-black text-amber-700 uppercase tracking-wider">
                            ⚠ Stream subtotal ({KES(streamSubtotal)}) ≠ Total Sales ({KES(totalSales)}) — review required
                        </p>
                    </div>
                )}
            </Section>

            {/* 4. Credit & Bills Summary */}
            <Section title="4. Credit & Bills Summary">
                <Row label="Credit Bills Created"    value={creditCreated     > 0 ? KES(creditCreated)     : '—'} color="text-orange-600" />
                <Row label="Credit Bills Paid"       value={creditPaid        > 0 ? KES(creditPaid)        : '—'} color="text-emerald-600" />
                <Row label="Outstanding Credit"      value={creditOutstanding > 0 ? KES(creditOutstanding) : 'None'} bold color={creditOutstanding > 0 ? 'text-rose-600' : 'text-emerald-600'} />
                {/* Individual credit bill entries */}
                {(shift.credit_bills_details || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Credit Issued</p>
                        {(shift.credit_bills_details || []).map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-[10px] text-slate-500 pl-2">
                                <span>{b.name}</span>
                                <span className="font-bold text-orange-600">{KES(b.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}
                {(shift.paid_bills_details || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Credit Paid</p>
                        {(shift.paid_bills_details || []).map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-[10px] text-slate-500 pl-2">
                                <span>{b.name}</span>
                                <span className="font-bold text-emerald-600">{KES(b.amount)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </Section>

            {/* 5. Variance Analysis */}
            <div className={`rounded-xl border p-5 ${varianceBg}`}>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">5. Variance Analysis</p>
                <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
                    Opening Float ({KES(openingFloat)}) + Cash Sales ({KES(cashSales)}) + Credit Paid ({KES(creditPaid)}) = Expected ({KES(expectedClosing)})
                    <br />
                    Actual ({KES(actualClosing)}) − Expected ({KES(expectedClosing)}) = Variance
                </p>
                <div className={`flex items-center justify-between p-3 rounded-lg bg-white/60`}>
                    <div className="flex items-center gap-2">
                        <VarianceIcon className={`h-5 w-5 ${varianceColor}`} />
                        <span className={`text-sm font-black uppercase tracking-wider ${varianceColor}`}>{varianceLabel}</span>
                    </div>
                    <span className={`text-xl font-black tabular-nums ${varianceColor}`}>
                        {variance >= 0 ? `+${KES(variance)}` : KES(variance)}
                    </span>
                </div>
                {variance !== 0 && (
                    <p className="text-[9px] text-slate-500 mt-2 font-medium">
                        {variance > 0
                            ? `KES ${Math.abs(variance).toLocaleString()} more cash than expected — possible over-collection or recording error.`
                            : `KES ${Math.abs(variance).toLocaleString()} less cash than expected — possible shortage or unrecorded payment.`}
                    </p>
                )}
            </div>
        </div>
    );
}
