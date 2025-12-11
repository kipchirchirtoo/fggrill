"""
Branch Comparison Report Generator functions
"""

from datetime import datetime
from typing import Dict, Any, List

def _generate_branch_comparison_report(self, data: Dict[str, Any], filters: Dict[str, Any] = None) -> str:
    """Generate Branch Comparison Report
    
    This report compares different branches based on revenue, occupancy, or staff count metrics
    """
    # Extract data
    title = data.get('title', 'Branch Comparison Report')
    period = data.get('period', 'month')
    metric = data.get('metric', 'revenue')
    branches = data.get('branches', [])
    
    # Build elements list for the PDF
    elements = []
    
    # Add report header
    self._add_report_header(elements, title)
    
    # Add report metadata
    metadata = [
        ('Report Date:', datetime.now().strftime('%d %b %Y, %H:%M')),
        ('Period:', period.capitalize()),
        ('Metric:', metric.replace('_', ' ').capitalize()),
    ]
    self._add_metadata_table(elements, metadata)
    
    # Prepare data for chart
    period_label = {
        'week': 'Weekly',
        'month': 'Monthly',
        'quarter': 'Quarterly',
        'year': 'Yearly'
    }.get(period, 'Period')
    
    metric_label = {
        'revenue': 'Revenue (KES)',
        'occupancy': 'Occupancy Rate (%)',
        'staff_count': 'Staff Count'
    }.get(metric, metric.replace('_', ' ').capitalize())
    
    # Sort branches by metric value (descending)
    sorted_branches = sorted(branches, key=lambda x: x.get(metric, 0), reverse=True)
    
    # Add summary text
    if branches:
        best_branch = sorted_branches[0]['name']
        best_value = sorted_branches[0].get(metric, 0)
        formatted_value = self._format_currency(best_value) if metric == 'revenue' else (
            f"{best_value}%" if metric == 'occupancy' else str(best_value)
        )
        
        summary = f"Based on {metric_label} data for the selected {period}, {best_branch} is the top performing branch with a {metric_label} of {formatted_value}."
        elements.append(self._create_paragraph(summary, self.styles['Normal'], 12))
        
        # Add spacer
        elements.append(self._create_spacer(0.2))
    
    # Add comparison chart
    if branches:
        # Create data for chart
        chart_data = []
        chart_labels = []
        max_value = max([b.get(metric, 0) for b in branches])
        
        for branch in sorted_branches:
            chart_data.append(branch.get(metric, 0))
            chart_labels.append(branch.get('name', 'Unknown'))
        
        # Add horizontal bar chart
        chart_title = f"{period_label} {metric_label} by Branch"
        elements.append(self._create_horizontal_bar_chart(chart_data, chart_labels, chart_title))
    
    # Add spacer
    elements.append(self._create_spacer(0.2))
    
    # Add comparison table
    if branches:
        # Table data
        table_data = [
            ['Branch', metric_label, 'Rank']
        ]
        
        for i, branch in enumerate(sorted_branches, 1):
            branch_name = branch.get('name', 'Unknown')
            value = branch.get(metric, 0)
            
            # Format based on metric type
            if metric == 'revenue':
                formatted_value = self._format_currency(value)
            elif metric == 'occupancy':
                formatted_value = f"{value}%"
            else:
                formatted_value = str(value)
                
            table_data.append([branch_name, formatted_value, str(i)])
        
        # Create and add the table
        elements.append(self._create_table(
            table_data, 
            colWidths=[250, 150, 80],
            style=[
                ('BACKGROUND', (0, 0), (-1, 0), self.HEADER_GRAY),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 10),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                ('ALIGN', (2, 1), (2, -1), 'CENTER'),
                ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                ('FONTSIZE', (0, 1), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ]
        ))
    
    # Add notes
    elements.append(self._create_spacer(0.3))
    elements.append(self._create_paragraph("Notes:", self.styles['Heading5']))
    notes = [
        "This report provides a comparison of branch performance based on selected metrics.",
        f"The period shown is: {period_label}.",
        "Rankings are based on current data and may change over time.",
    ]
    for note in notes:
        elements.append(self._create_paragraph(f"• {note}", self.styles['Normal'], 9))
    
    # Create the PDF
    return self._create_pdf(elements)

# Add the method to BrandedPDFGenerator class
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.legends import Legend
from reportlab.graphics.charts.textlabels import Label
from reportlab.graphics import renderPDF
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

def _create_horizontal_bar_chart(self, data, labels, title, width=500, height=300):
    """Create a horizontal bar chart"""
    drawing = Drawing(width, height)
    
    # Create chart
    bc = HorizontalBarChart()
    bc.x = 50
    bc.y = 50
    bc.height = height - 100
    bc.width = width - 100
    bc.data = [data]
    bc.categoryAxis.categoryNames = labels
    bc.categoryAxis.labels.fontName = 'Helvetica'
    bc.categoryAxis.labels.fontSize = 8
    bc.categoryAxis.tickLeft = 0
    bc.categoryAxis.tickRight = 0
    bc.valueAxis.labels.fontName = 'Helvetica'
    bc.valueAxis.labels.fontSize = 8
    bc.valueAxis.visibleGrid = True
    bc.valueAxis.gridStrokeWidth = 0.25
    bc.valueAxis.gridStrokeColor = colors.grey
    bc.bars[0].fillColor = colors.gray
    bc.barLabels.nudge = 10
    bc.barLabelFormat = '%0.1f'
    bc.barLabels.dy = -5
    bc.barLabels.fontSize = 8
    bc.barLabels.fontName = 'Helvetica'
    bc.barLabels.visible = True
    
    # Add title
    title_label = Label()
    title_label.setOrigin(width/2, height-20)
    title_label.boxAnchor = 'n'
    title_label.setText(title)
    title_label.fontName = 'Helvetica-Bold'
    title_label.fontSize = 12
    
    drawing.add(bc)
    drawing.add(title_label)
    
    return drawing
