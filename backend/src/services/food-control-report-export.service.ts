import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { DailyFoodControlReport } from './food-control-report.service';

/**
 * Export the Daily Food Control Report in the exact two-panel layout of the
 * manual JUNE_STORE_STOCKSHEET.xlsx: STORE STOCKSHEET on the left, CONTROLS
 * on the right, same column headers and order, so branch staff transitioning
 * from the paper/Excel process recognize it immediately.
 */

const LEFT_HEADERS = [
  'ITEMS', 'O.P/STOCK', 'ADD', 'TOTALS', 'ISSUED', 'C.L/STOCK',
  'C.PRICE', 'O.P VALUE', 'ADD VALUE', 'C.L VALUE',
];
const RIGHT_HEADERS = [
  'ITEMS', 'O.P/STOCK', 'ADDED', 'TOTALS', 'C.STOCK', 'REJECTS',
  'EXPECTED', 'SYSTEM SALES', 'VAR.', 's.p', 'Shorts.v',
];

export async function exportReportXlsx(report: DailyFoodControlReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const dayNum = Number(report.date.split('-')[2]);
  const suffix = [11, 12, 13].includes(dayNum % 100)
    ? 'th'
    : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[dayNum % 10] || 'th';
  const ws = wb.addWorksheet(`${dayNum}${suffix}`);

  const RIGHT_START = LEFT_HEADERS.length + 2; // one spacer column between panels

  // Panel titles
  ws.getCell(1, 1).value = 'STORE STOCKSHEET';
  ws.getCell(1, RIGHT_START).value = 'CONTROLS';
  [ws.getCell(1, 1), ws.getCell(1, RIGHT_START)].forEach((c) => {
    c.font = { bold: true, size: 12 };
  });
  ws.getCell(2, 1).value = `Date: ${report.date}${report.is_provisional ? '  (LIVE / PROVISIONAL)' : ''}`;

  // Headers
  const HEADER_ROW = 3;
  LEFT_HEADERS.forEach((h, i) => {
    const c = ws.getCell(HEADER_ROW, i + 1);
    c.value = h;
    c.font = { bold: true };
    c.border = { bottom: { style: 'thin' } };
  });
  RIGHT_HEADERS.forEach((h, i) => {
    const c = ws.getCell(HEADER_ROW, RIGHT_START + i);
    c.value = h;
    c.font = { bold: true };
    c.border = { bottom: { style: 'thin' } };
  });

  // Left panel rows
  report.left_panel.forEach((r, i) => {
    const row = HEADER_ROW + 1 + i;
    const values = [
      r.item_name, r.opening, r.added, r.totals, r.issued, r.closing,
      r.cost_price, r.opening_value, r.add_value, r.closing_value,
    ];
    values.forEach((v, col) => {
      ws.getCell(row, col + 1).value = v as any;
    });
  });

  // Right panel rows (Shorts.v red when negative, green when positive)
  report.right_panel.forEach((r, i) => {
    const row = HEADER_ROW + 1 + i;
    const values = [
      r.item_name, r.opening, r.added, r.totals, r.closing, r.rejects,
      r.expected, r.system_sales, r.variance, r.selling_price, r.shorts_value,
    ];
    values.forEach((v, col) => {
      ws.getCell(row, RIGHT_START + col).value = v as any;
    });
    const shorts = ws.getCell(row, RIGHT_START + RIGHT_HEADERS.length - 1);
    if (r.shorts_value < 0) shorts.font = { color: { argb: 'FFC62828' }, bold: true };
    else if (r.shorts_value > 0) shorts.font = { color: { argb: 'FF2E7D32' } };
  });

  // Totals row
  const totalsRow = HEADER_ROW + 1 + Math.max(report.left_panel.length, report.right_panel.length) + 1;
  ws.getCell(totalsRow, 1).value = 'TOTALS';
  ws.getCell(totalsRow, 1).font = { bold: true };
  ws.getCell(totalsRow, LEFT_HEADERS.length).value = report.totals.stocksheet_closing_value;
  ws.getCell(totalsRow, RIGHT_START).value = 'TOTAL Shorts.v';
  ws.getCell(totalsRow, RIGHT_START).font = { bold: true };
  const totalShorts = ws.getCell(totalsRow, RIGHT_START + RIGHT_HEADERS.length - 1);
  totalShorts.value = report.totals.controls_shorts_value;
  totalShorts.font = {
    bold: true,
    color: { argb: report.totals.controls_shorts_value < 0 ? 'FFC62828' : 'FF2E7D32' },
  };

  // AI summary appended below, clearly separated (never mixed into numbers)
  if (report.ai_summary) {
    const aiRow = totalsRow + 2;
    ws.getCell(aiRow, 1).value = 'AI SUMMARY (interpretive — numbers above are the record):';
    ws.getCell(aiRow, 1).font = { bold: true, italic: true };
    ws.getCell(aiRow + 1, 1).value = report.ai_summary.summary;
    report.ai_summary.flags.forEach((f, i) => {
      ws.getCell(aiRow + 2 + i, 1).value = `• ${f}`;
    });
  }
  if (report.warnings.length) {
    const wRow = totalsRow + 2 + (report.ai_summary ? 3 + report.ai_summary.flags.length : 0);
    ws.getCell(wRow, 1).value = 'WARNINGS:';
    ws.getCell(wRow, 1).font = { bold: true, color: { argb: 'FFEF6C00' } };
    report.warnings.forEach((w, i) => {
      ws.getCell(wRow + 1 + i, 1).value = `• ${w}`;
    });
  }

  ws.getColumn(1).width = 22;
  ws.getColumn(RIGHT_START).width = 22;
  for (let i = 2; i <= LEFT_HEADERS.length; i++) ws.getColumn(i).width = 11;
  for (let i = 1; i < RIGHT_HEADERS.length; i++) ws.getColumn(RIGHT_START + i).width = 11;

  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function exportReportPdf(report: DailyFoodControlReport): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 24 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawTable = (
      title: string,
      headers: string[],
      rows: (string | number)[][],
      x: number,
      colWidths: number[],
      highlightLastCol: boolean
    ) => {
      let y = 40;
      doc.fontSize(11).font('Helvetica-Bold').text(title, x, y);
      y += 18;
      doc.fontSize(6.5).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
          width: colWidths[i] - 2,
        });
      });
      y += 12;
      doc.moveTo(x, y - 3).lineTo(x + colWidths.reduce((a, b) => a + b, 0), y - 3).stroke();
      doc.font('Helvetica').fontSize(6.5);
      for (const row of rows) {
        if (y > doc.page.height - 60) {
          doc.addPage();
          y = 40;
        }
        row.forEach((v, i) => {
          const isLast = i === row.length - 1;
          if (highlightLastCol && isLast && typeof v === 'number') {
            doc.fillColor(v < 0 ? '#C62828' : v > 0 ? '#2E7D32' : '#000000');
          }
          doc.text(String(typeof v === 'number' ? v.toFixed(2) : v),
            x + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y,
            { width: colWidths[i] - 2 });
          doc.fillColor('#000000');
        });
        y += 10;
      }
      return y;
    };

    doc.fontSize(14).font('Helvetica-Bold')
      .text(`Daily Food Control Report — ${report.date}${report.is_provisional ? '  (LIVE / PROVISIONAL)' : ''}`, 24, 16);

    const leftWidths = [90, 45, 40, 45, 45, 48, 45, 52, 52, 52];
    const rightWidths = [90, 45, 42, 45, 45, 42, 50, 55, 42, 40, 52];
    const leftRows = report.left_panel.map((r) => [
      r.item_name, r.opening, r.added, r.totals, r.issued, r.closing,
      r.cost_price, r.opening_value, r.add_value, r.closing_value,
    ]);
    const rightRows = report.right_panel.map((r) => [
      r.item_name, r.opening, r.added, r.totals, r.closing, r.rejects,
      r.expected, r.system_sales, r.variance, r.selling_price, r.shorts_value,
    ]);

    const yLeft = drawTable('STORE STOCKSHEET', LEFT_HEADERS, leftRows, 24, leftWidths, false);
    const rightX = 24 + leftWidths.reduce((a, b) => a + b, 0) + 30;
    const yRight = drawTable('CONTROLS', RIGHT_HEADERS, rightRows, rightX, rightWidths, true);

    let y = Math.max(yLeft, yRight) + 16;
    doc.fontSize(8).font('Helvetica-Bold')
      .text(`TOTAL Shorts.v: KES ${report.totals.controls_shorts_value.toFixed(2)}`, 24, y);
    y += 14;

    if (report.ai_summary) {
      doc.fontSize(8).font('Helvetica-Oblique')
        .text('AI SUMMARY (interpretive — the tables above are the record):', 24, y);
      y += 12;
      doc.font('Helvetica').text(report.ai_summary.summary, 24, y, { width: 700 });
      y = doc.y + 6;
      for (const f of report.ai_summary.flags) {
        doc.text(`• ${f}`, 24, y, { width: 700 });
        y = doc.y + 2;
      }
    }
    if (report.warnings.length) {
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#EF6C00').text('WARNINGS:', 24, y + 6);
      y = doc.y + 2;
      doc.font('Helvetica').fillColor('#000000');
      for (const w of report.warnings) {
        doc.text(`• ${w}`, 24, y, { width: 700 });
        y = doc.y + 2;
      }
    }

    doc.end();
  });
}
