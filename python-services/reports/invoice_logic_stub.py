
    def _generate_invoice(self, data: Dict, filters: Dict) -> str:
        """Generate a Branded Invoice PDF"""
        elements = []
        
        # 1. Header with Logo & Invoice Details
        logo = self._get_logo(width=1.2*inch)
        
        invoice_number = data.get('invoice_number', 'INV-0000')
        invoice_date = data.get('invoice_date', datetime.now().strftime('%d/%m/%Y'))
        due_date = data.get('due_date', datetime.now().strftime('%d/%m/%Y'))
        status = data.get('status', 'PENDING').upper()
        
        # Company Info (Sender)
        sender_info = [
            Paragraph("<b>KyogongS</b>", self.styles['Normal']),
            Paragraph("Kyogongs Bomet Town", self.styles['SmallText']),
            Paragraph("P.O. Box 701 - 20400", self.styles['SmallText']),
            Paragraph("Bomet, Kenya", self.styles['SmallText']),
            Paragraph("Tel: 0706 782 828", self.styles['SmallText']),
            Paragraph("Email: kyogongsbmt@gmail.com", self.styles['SmallText']),
        ]
        
        # Invoice Title Block
        title_block = [
            Paragraph("<b>INVOICE</b>", ParagraphStyle('InvoiceTitle', parent=self.styles['Heading1'], fontSize=24, textColor=FG_BLUE, alignment=TA_RIGHT)),
            Paragraph(f"<b>#{invoice_number}</b>", ParagraphStyle('InvoiceNum', parent=self.styles['Normal'], fontSize=12, alignment=TA_RIGHT)),
            Spacer(1, 0.1*inch),
            Paragraph(f"Date: {invoice_date}", ParagraphStyle('InvoiceDate', parent=self.styles['Normal'], alignment=TA_RIGHT)),
            Paragraph(f"Due Date: {due_date}", ParagraphStyle('InvoiceDate', parent=self.styles['Normal'], alignment=TA_RIGHT)),
            Spacer(1, 0.1*inch),
            Paragraph(f"Status: <font color='{FG_GREEN if status=='PAID' else FG_RED}'>{status}</font>", ParagraphStyle('InvoiceStatus', parent=self.styles['Normal'], alignment=TA_RIGHT)),
        ]
        
        header_data = [[logo if logo else '', sender_info, title_block]]
        header_table = Table(header_data, colWidths=[1.5*inch, 3*inch, 2.5*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (2, 0), (2, 0), 'RIGHT'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # 2. Bill To & Ship To
        customer_name = data.get('customer_name', 'Guest / Customer')
        customer_address = data.get('customer_address', 'N/A')
        customer_phone = data.get('customer_phone', '')
        customer_email = data.get('customer_email', '')
        
        bill_to = [
            Paragraph("<b>BILL TO:</b>", self.styles['Heading4']),
            Paragraph(customer_name, self.styles['Normal']),
            Paragraph(customer_address, self.styles['Normal']),
            Paragraph(customer_phone, self.styles['Normal']),
            Paragraph(customer_email, self.styles['Normal']),
        ]
        
        bill_table = Table([[bill_to]], colWidths=[7*inch])
        bill_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), FG_LIGHT),
            ('Padding', (0, 0), (-1, -1), 12),
            ('ROUNDED', (0, 0), (-1, -1), 8),
        ]))
        elements.append(bill_table)
        elements.append(Spacer(1, 0.3*inch))
        
        # 3. Invoice Items Table
        headers = ['Item Description', 'Quantity', 'Unit Price', 'Total']
        items_data = [headers]
        
        subtotal = 0
        items = data.get('items', [])
        
        if not items:
            items_data.append(['No items', '-', '-', '-'])
        
        for item in items:
            desc = item.get('description', 'Item')
            qty = float(item.get('quantity', 0))
            price = float(item.get('unit_price', 0))
            total = float(item.get('total', qty * price))
            subtotal += total
            
            items_data.append([
                Paragraph(desc, self.styles['Normal']),
                self._format_number(qty),
                self._format_currency(price),
                self._format_currency(total)
            ])
        
        # 4. Totals Calculation
        tax_rate = float(data.get('tax_rate', 0)) # percentage
        tax_amount = subtotal * (tax_rate / 100)
        total_amount = subtotal + tax_amount
        
        items_data.append(['', '', 'Subtotal:', self._format_currency(subtotal)])
        if tax_amount > 0:
            items_data.append(['', '', f'Tax ({tax_rate}%):', self._format_currency(tax_amount)])
        items_data.append(['', '', '<b>TOTAL:</b>', f"<b>{self._format_currency(total_amount)}</b>"])
        
        item_table = Table(items_data, colWidths=[3.5*inch, 1*inch, 1.2*inch, 1.3*inch])
        item_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), FG_BLUE),
            ('TEXTCOLOR', (0, 0), (-1, 0), FG_WHITE),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'), # Desc align left
            ('ALIGN', (1, 1), (-1, -1), 'RIGHT'), # Numbers align right
            ('BACKGROUND', (0, -1), (-1, -1), HEADER_GRAY), # Total row bg
            ('GRID', (0, 0), (-1, -4), 0.5, FG_GRAY), # Grid for items only
            ('LINEBELOW', (0, 0), (-1, 0), 1, FG_DARK),
            ('LINEABOVE', (2, -1), (-1, -1), 1, FG_DARK), # Line above total
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(item_table)
        elements.append(Spacer(1, 0.5*inch))
        
        # 5. Terms & Notes
        notes = data.get('notes', 'Thank you for your business!')
        terms = data.get('terms', 'Payment due within 30 days.')
        
        elements.append(Paragraph("<b>Notes & Terms:</b>", self.styles['Heading4']))
        elements.append(Paragraph(notes, self.styles['Normal']))
        elements.append(Paragraph(terms, self.styles['SmallText']))
        
        # 6. Payment Info
        elements.append(Spacer(1, 0.2*inch))
        elements.append(Paragraph("<b>Payment Methods:</b>", self.styles['Heading4']))
        
        payment_info = [
            "M-Pesa: Paybill 123456, Account: Invoice Number",
            "Bank Transfer: Equity Bank, Acc: 1234567890",
            "Cheque: Payable to Kyogongs"
        ]
        
        for method in payment_info:
             elements.append(Paragraph(f"• {method}", self.styles['Normal']))
        
        return self._create_pdf(elements)
