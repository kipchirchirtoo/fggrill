# CSV Exporter for Branch Sales Reports
# Exports sales data to CSV format with proper formatting

import csv
import tempfile
from typing import Dict, List, Any
from datetime import datetime


class CSVExporter:
    """Service for exporting branch sales data to CSV format"""

    def export_branch_sales(
        self,
        sales_data: Dict[str, Any],
        branch_name: str,
        date_range: Dict[str, str]
    ) -> str:
        """
        Export branch sales data to CSV file
        
        Args:
            sales_data: Aggregated sales data from BranchSalesAnalytics
            branch_name: Name of the branch
            date_range: Dictionary with 'start' and 'end' dates
            
        Returns:
            Path to the generated CSV file
        """
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv', mode='w', newline='', encoding='utf-8')
        
        try:
            writer = csv.writer(temp_file)

            # Write header information
            writer.writerow(['FamousGate Hotels - Branch Sales Report'])
            writer.writerow(['Branch:', branch_name])
            writer.writerow(['Period:', f"{date_range['start']} to {date_range['end']}"])
            writer.writerow(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow([])  # Empty row

            # Write summary section
            writer.writerow(['SALES SUMMARY'])
            writer.writerow(['Metric', 'Value'])
            summary = sales_data['summary']
            writer.writerow(['Total Sales (KES)', f"{summary['total_sales']:,.2f}"])
            writer.writerow(['Transaction Count', summary['transaction_count']])
            writer.writerow(['Average Transaction Value (KES)', f"{summary['avg_transaction_value']:,.2f}"])
            writer.writerow([])  # Empty row

            # Write daily breakdown
            writer.writerow(['DAILY BREAKDOWN'])
            writer.writerow(['Date', 'Total Sales (KES)', 'Transaction Count', 'Avg Transaction Value (KES)'])
            for day in sales_data['daily_breakdown']:
                writer.writerow([
                    day['date'],
                    f"{day['total_sales']:,.2f}",
                    day['transaction_count'],
                    f"{day['avg_transaction_value']:,.2f}"
                ])
            writer.writerow([])  # Empty row

            # Write payment method breakdown
            writer.writerow(['PAYMENT METHOD BREAKDOWN'])
            writer.writerow(['Payment Method', 'Total Sales (KES)', 'Transaction Count', 'Percentage (%)'])
            for pm in sales_data['payment_method_breakdown']:
                writer.writerow([
                    pm['payment_method'].upper(),
                    f"{pm['total_sales']:,.2f}",
                    pm['transaction_count'],
                    f"{pm['percentage']:.2f}%"
                ])
            writer.writerow([])  # Empty row

            # Write category breakdown
            writer.writerow(['CATEGORY BREAKDOWN'])
            writer.writerow(['Category', 'Total Sales (KES)', 'Transaction Count', 'Percentage (%)'])
            for cat in sales_data['category_breakdown']:
                writer.writerow([
                    cat['category'].upper(),
                    f"{cat['total_sales']:,.2f}",
                    cat['transaction_count'],
                    f"{cat['percentage']:.2f}%"
                ])
            writer.writerow([])  # Empty row

            # Write detailed transactions (if available)
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

        except Exception as e:
            temp_file.close()
            raise Exception(f"Error generating CSV export: {str(e)}")

    def export_transactions_only(
        self,
        transactions: List[Dict[str, Any]],
        branch_name: str,
        date_range: Dict[str, str]
    ) -> str:
        """
        Export only transaction details to CSV (for large datasets)
        
        Args:
            transactions: List of transaction records
            branch_name: Name of the branch
            date_range: Dictionary with 'start' and 'end' dates
            
        Returns:
            Path to the generated CSV file
        """
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.csv', mode='w', newline='', encoding='utf-8')
        
        try:
            writer = csv.writer(temp_file)

            # Write header information
            writer.writerow(['FamousGate Hotels - Transaction Export'])
            writer.writerow(['Branch:', branch_name])
            writer.writerow(['Period:', f"{date_range['start']} to {date_range['end']}"])
            writer.writerow(['Generated:', datetime.now().strftime('%Y-%m-%d %H:%M:%S')])
            writer.writerow(['Total Records:', len(transactions)])
            writer.writerow([])  # Empty row

            # Write transaction headers
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

            # Write transactions
            for txn in transactions:
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

        except Exception as e:
            temp_file.close()
            raise Exception(f"Error generating transaction CSV: {str(e)}")
