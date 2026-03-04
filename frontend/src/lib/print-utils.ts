
export const printReservationInvoice = ({ reservation, branch, user }: {
    reservation: any,
    branch?: any,
    user?: any
}) => {
    const activeBranch = branch || { name: 'Famous Gates Hotels', location: 'Bomet, Kenya', settings: { phone: '0706782828', pin: 'P051503313Y', email: 'famousgatesbmt@gmail.com' } };
    const companyName = (activeBranch.name || 'FAMOUS GATES HOTELS').toUpperCase();
    const companyAddress = activeBranch.location || 'Bomet, Kenya';
    const companyPhone = activeBranch.settings?.phone || '0706782828';
    const companyEmail = activeBranch.settings?.email || 'famousgatesbmt@gmail.com';
    const companyPin = activeBranch.settings?.pin || 'P051503313Y';

    const invoiceNumber = reservation.confirmation_number || reservation.booking_number || `INV-${Date.now().toString(36).toUpperCase()}`;
    const guestName = (reservation.guest_name || 'Guest').toUpperCase();
    const guestPhone = reservation.guest_phone || '';
    const roomNumber = reservation.room_number || '';
    const roomType = reservation.room_type || '';
    const checkIn = new Date(reservation.check_in).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const checkOut = new Date(reservation.check_out).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const nights = Math.ceil((new Date(reservation.check_out).getTime() - new Date(reservation.check_in).getTime()) / (1000 * 60 * 60 * 24));

    const totalAmount = parseFloat(reservation.total_amount || 0);
    const paidAmount = parseFloat(reservation.amount_paid || reservation.deposit_amount || 0);
    const balance = totalAmount - paidAmount;

    // Generate a simple digital signature/security hash
    const securityHash = btoa(reservation.id || invoiceNumber).slice(0, 12).toUpperCase();

    const createdBy = `${user?.first_name || user?.firstName || ''} ${user?.last_name || user?.lastName || ''}`.trim() || 'RECEPTION STAFF';
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const printHtml = `
        <html>
        <head>
            <title>Invoice ${invoiceNumber} - ${companyName}</title>
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
                    border: 1px solid #ddd;
                    box-shadow: 0 0 10px rgba(0,0,0,0.05);
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
                .logo { width: 45px; height: 45px; object-fit: contain; margin-bottom: 4px; filter: grayscale(100%); }
                .co-name { font-size: 18px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; color: #000; }
                .co-details { font-size: 9px; color: #444; letter-spacing: 0.2px; line-height: 1.5; margin-top: 2px; }
                .bill-title {
                    font-size: 14px;
                    font-weight: 900;
                    letter-spacing: 3px;
                    text-transform: uppercase;
                    margin-top: 12px;
                    padding: 6px 0;
                    background: #f8f9fa;
                    border-top: 2px solid #000;
                    border-bottom: 2px solid #000;
                }

                /* Info Section */
                .info-section { padding: 12px 0; }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 3px 0;
                    font-size: 10px;
                }
                .info-row .lbl {
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    color: #555;
                    font-size: 9px;
                    min-width: 100px;
                }
                .info-row .data { font-weight: bold; text-align: right; color: #000; }

                /* Items Table */
                .items-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 12px 0;
                }
                .items-table th {
                    text-align: left;
                    border-bottom: 2px solid #000;
                    padding: 6px 0;
                    font-size: 9px;
                    text-transform: uppercase;
                    color: #555;
                }
                .items-table td {
                    padding: 7px 0;
                    border-bottom: 1px solid #eee;
                }
                .item-desc { font-weight: bold; }
                .item-qty { text-align: center; width: 40px; }
                .item-price { text-align: right; width: 80px; }
                .item-total { text-align: right; width: 90px; font-weight: bold; }

                /* Totals */
                .totals-section {
                    margin-top: 10px;
                    border-top: 2px solid #000;
                    padding-top: 8px;
                }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 0;
                }
                .total-grand {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    font-size: 18px;
                    font-weight: 900;
                    border-top: 1px solid #000;
                    margin-top: 8px;
                    background: #f8f9fa;
                }

                /* Security */
                .security-badge {
                    margin-top: 15px;
                    padding: 8px;
                    border: 1px dashed #aaa;
                    background: #fff;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .security-text { font-size: 7px; color: #777; line-height: 1.1; }

                /* Signatures */
                .sig-section { margin: 25px 0 10px; }
                .sig-row { display: flex; justify-content: space-between; gap: 40px; }
                .sig-block { flex: 1; text-align: center; }
                .sig-line { border-bottom: 1px solid #111; margin-bottom: 4px; height: 30px; }
                .sig-label { font-size: 8px; text-transform: uppercase; letter-spacing: 1px; color: #555; }

                /* Footer */
                .footer { text-align: center; font-size: 8px; color: #666; padding-top: 15px; }
                .footer-notice { font-size: 10px; font-weight: bold; margin-bottom: 5px; color: #000; }
                .footer-sys { font-size: 7px; color: #999; margin-top: 12px; padding-top: 8px; border-top: 1px solid #eee; }
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
                        TEL: ${companyPhone} | EMAIL: ${companyEmail}<br/>
                        ${companyPin ? `KRA PIN: ${companyPin}` : ''}
                    </div>
                    <div class="bill-title">HOTEL RESERVATION BILL</div>
                </div>

                <!-- Info Section -->
                <div class="info-section">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="flex: 1;">
                            <div class="info-row">
                                <span class="lbl">BILL NO:</span>
                                <span class="data">${invoiceNumber}</span>
                            </div>
                            <div class="info-row">
                                <span class="lbl">DATE:</span>
                                <span class="data">${dateStr} | ${timeStr}</span>
                            </div>
                            <div class="info-row">
                                <span class="lbl">GUEST:</span>
                                <span class="data">${guestName}</span>
                            </div>
                        </div>
                        <div style="text-align: right; padding-left: 15px;">
                            <img src="https://services.hirall.com/api/barcode/barcode-image/${invoiceNumber}?format=code128&height=40&scale=2" 
                                 style="height: 45px; max-width: 180px; object-fit: contain;" 
                                 onerror="this.style.display='none'" />
                            <div style="font-size: 8px; font-weight: bold; margin-top: 2px;">* ${invoiceNumber} *</div>
                        </div>
                    </div>
                    
                    <div class="dash-line" style="margin-top: 12px;"></div>
                    
                    <div class="info-row">
                        <span class="lbl">ROOM DETAILS:</span>
                        <span class="data">ROOM ${roomNumber} - ${roomType}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">CHECK-IN:</span>
                        <span class="data">${checkIn}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">CHECK-OUT:</span>
                        <span class="data">${checkOut}</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">STAY DURATION:</span>
                        <span class="data">${nights} Night(s)</span>
                    </div>
                    <div class="info-row">
                        <span class="lbl">ISSUED BY:</span>
                        <span class="data">${createdBy}</span>
                    </div>
                </div>

                <!-- Items Table -->
                <table class="items-table">
                    <thead>
                        <tr>
                            <th>DESCRIPTION</th>
                            <th class="center">DAY(S)</th>
                            <th class="right">RATE (KES)</th>
                            <th class="right">TOTAL (KES)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td class="item-desc">Accommodation Services</td>
                            <td class="item-qty center">${nights}</td>
                            <td class="item-price right">${(totalAmount / nights).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td class="item-total right">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        </tr>
                    </tbody>
                </table>

                <!-- Totals -->
                <div class="totals-section">
                    <div class="total-row">
                        <span class="lbl">GROSS AMOUNT</span>
                        <span class="data">KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="total-row">
                        <span class="lbl">TAXES & LEVIES (INCL)</span>
                        <span class="data">KES ${(totalAmount * 0.16).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="single-line"></div>
                    <div class="total-row" style="font-weight: bold;">
                        <span class="lbl">TOTAL PAYABLE</span>
                        <span class="data">KES ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="total-row" style="color: #444;">
                        <span class="lbl">TOTAL PAID (DEPOSIT)</span>
                        <span class="data">KES ${paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="total-grand">
                        <span>BALANCE DUE</span>
                        <span>KES ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <!-- Security Feature -->
                <div class="security-badge">
                    <div class="security-text">
                        <strong>DIGITAL SECURITY AUTHENTICATION</strong><br/>
                        VERIFICATION CODE: ${securityHash}<br/>
                        TIMESTAMP: ${now.getTime()}<br/>
                        This bill is electronically signed and scannable for cashier verification.
                    </div>
                    <div style="font-weight: bold; font-size: 14px; transform: rotate(-15deg); color: #ccc; border: 2px solid #ccc; padding: 2px 5px;">ORIGINAL</div>
                </div>

                <!-- Remarks -->
                <div class="sig-section">
                    <div class="sig-row">
                        <div class="sig-block">
                            <div class="sig-line"></div>
                            <div class="sig-label">GUEST ACKNOWLEDGEMENT</div>
                        </div>
                        <div class="sig-block">
                            <div class="sig-line" style="position: relative;">
                                <div style="position: absolute; bottom: 5px; left: 50%; transform: translateX(-50%); font-family: 'Brush Script MT', cursive; font-size: 24px; color: rgba(0,0,128,0.7); pointer-events: none;">kyogongs</div>
                            </div>
                            <div class="sig-label">FOR ${companyName}</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <div class="footer-notice">*** THANK YOU FOR STAYING WITH US ***</div>
                    <div class="footer-notice">PLEASE RETAIN THIS RECEIPT FOR CHECK-OUT</div>
                    <div class="footer-sys">SYSTEM AUTH: ${securityHash} | GEN: ${dateStr} ${timeStr}</div>
                </div>
            </div>
            <script>
                window.onload = () => {
                    window.print();
                    // window.close();
                };
            </script>
        </body>
        </html>
    `;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (printWindow) {
        printWindow.document.write(printHtml);
        printWindow.document.close();
    }
};
