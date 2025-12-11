from datetime import date
from typing import Optional

class ExcelExporter:
    async def generate_report(self, report_type: str, report_date: date, branch_id: Optional[str] = None) -> str:
        return "/tmp/dummy_report.xlsx"

    async def export_sales(self, start_date: date, end_date: date, branch_id: Optional[str] = None) -> str:
        return "/tmp/dummy_sales.xlsx"

    async def export_inventory(self, branch_id: Optional[str] = None) -> str:
        return "/tmp/dummy_inventory.xlsx"
