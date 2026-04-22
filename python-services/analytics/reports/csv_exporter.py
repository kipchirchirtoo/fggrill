import csv
import tempfile
from typing import Dict, List, Any
from datetime import datetime


class CSVExporter:
    """Service for exporting branch sales data to CSV format."""

    def export_branch_sales(
        self,
        sales_data: Dict[str, Any],
        branch_name: str,
        date_range: Dict[str, str]
    ) -> str:
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv', mode='w', newline='', encoding='utf-8')

        try:
            writer = csv.writer(temp_file)

            writer.writerow(['FamousGate Hotels - Branch Sales Report'])
            writer.writerow(['Branch:', branch_name])
            writer.writerow(['Period:', f"{date_range['start']} to {date_range['end']}"])
            writer.writerow(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])

            writer.writerow(['SALES SUMMARY'])
            writer.writerow(['Metric', 'Value'])
            summary = sales_data['summary']
            writer.writerow(['Total Sales (KES)', f"{summary['total_sales']:,.2f}"])
            writer.writerow(['Transaction Count', summary['transaction_count']])
            writer.writerow(['Average Transaction Value (KES)', f"{summary['avg_transaction_value']:,.2f}"])
            writer.writerow([])

            writer.writerow(['DAILY BREAKDOWN'])
            writer.writerow(['Date', 'Total Sales (KES)', 'Transaction Count', 'Avg Transaction Value (KES)'])
            for day in sales_data['daily_breakdown']:
                writer.writerow([
                    day['date'],
                    f"{day['total_sales']:,.2f}",
                    day['transaction_count'],
                    f"{day['avg_transaction_value']:,.2f}"
                ])
            writer.writerow([])

            writer.writerow(['PAYMENT METHOD BREAKDOWN'])
            writer.writerow(['Payment Method', 'Total Sales (KES)', 'Transaction Count', 'Percentage (%)'])
            for item in sales_data['payment_method_breakdown']:
                writer.writerow([
                    str(item['payment_method']).upper(),
                    f"{item['total_sales']:,.2f}",
                    item['transaction_count'],
                    f"{item['percentage']:.2f}%"
                ])
            writer.writerow([])

            writer.writerow(['CATEGORY BREAKDOWN'])
            writer.writerow(['Category', 'Total Sales (KES)', 'Transaction Count', 'Percentage (%)'])
            for item in sales_data['category_breakdown']:
                writer.writerow([
                    str(item['category']).upper(),
                    f"{item['total_sales']:,.2f}",
                    item['transaction_count'],
                    f"{item['percentage']:.2f}%"
                ])
            writer.writerow([])

            if sales_data.get('transactions'):
                writer.writerow(['DETAILED TRANSACTIONS'])
                writer.writerow([
                    'Transaction ID',
                    'Date',
                    'Category',
                    'Payment Method',
                    'Order Type',
                    'Amount (KES)',
                    'Status',
                    'Source'
                ])

                for txn in sales_data['transactions']:
                    writer.writerow([
                        txn['id'],
                        txn['transaction_date'],
                        txn['category'],
                        txn['payment_method'],
                        txn['order_type'] or 'N/A',
                        f"{txn['total_amount']:,.2f}",
                        txn['status'],
                        txn['source']
                    ])

            temp_file.close()
            return temp_file.name
        except Exception:
            temp_file.close()
            raise
