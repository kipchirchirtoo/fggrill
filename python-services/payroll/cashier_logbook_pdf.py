# -*- coding: utf-8 -*-
import io
import os
from datetime import datetime

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

LOGO_PATH = os.path.join(
    os.path.dirname(__file__), '..', 'assets', 'fglogo.png'
)


def generate_cashier_logbook_pdf(data: dict) -> bytes:
    dark_green = colors.HexColor("#1A4731")
    mid_green = colors.HexColor("#2D6A4F")
    accent = colors.HexColor("#40916C")
    light_green = colors.HexColor("#D8F3DC")
    light_gray = colors.HexColor("#F2F2F2")
    white = colors.white
    border = colors.HexColor("#B0B0B0")
    danger_bg = colors.HexColor("#FEE2E2")
    danger_fg = colors.HexColor("#991B1B")

    def style(name, **kwargs):
        return ParagraphStyle(name, **kwargs)

    styles = {
        "company": style(
            "company", fontName="Helvetica-Bold", fontSize=18, textColor=white, alignment=TA_CENTER
        ),
        "contact": style(
            "contact", fontName="Helvetica-Oblique", fontSize=8, textColor=white, alignment=TA_CENTER
        ),
        "title": style(
            "title", fontName="Helvetica-Bold", fontSize=14, textColor=dark_green, alignment=TA_CENTER
        ),
        "meta_label": style(
            "meta_label", fontName="Helvetica-Bold", fontSize=8, textColor=dark_green
        ),
        "meta_value": style(
            "meta_value", fontName="Helvetica", fontSize=8, textColor=colors.black
        ),
        "sum_lbl": style(
            "sum_lbl", fontName="Helvetica-Bold", fontSize=7, textColor=colors.HexColor("#555555"), alignment=TA_CENTER
        ),
        "sum_val": style(
            "sum_val", fontName="Helvetica-Bold", fontSize=12, textColor=dark_green, alignment=TA_CENTER
        ),
        "col_hdr": style(
            "col_hdr", fontName="Helvetica-Bold", fontSize=7, textColor=white, alignment=TA_CENTER
        ),
        "cell": style(
            "cell", fontName="Helvetica", fontSize=7.5, textColor=colors.black, alignment=TA_LEFT
        ),
        "cell_c": style(
            "cell_c", fontName="Helvetica", fontSize=7.2, textColor=colors.black, alignment=TA_CENTER
        ),
        "cell_r": style(
            "cell_r", fontName="Helvetica", fontSize=7.2, textColor=colors.black, alignment=TA_RIGHT
        ),
        "section": style(
            "section", fontName="Helvetica-Bold", fontSize=10, textColor=colors.black, alignment=TA_LEFT
        ),
        "footer": style(
            "footer", fontName="Helvetica-Oblique", fontSize=7, textColor=colors.HexColor("#666666"), alignment=TA_CENTER
        ),
        "danger": style(
            "danger", fontName="Helvetica-Bold", fontSize=7.5, textColor=danger_fg, alignment=TA_CENTER
        ),
    }

    def p(text, style_key):
        return Paragraph(str(text), styles[style_key])

    def money(value):
        try:
            return f"KES {float(value or 0):,.2f}"
        except Exception:
            return "KES 0.00"

    def text(value, fallback="-"):
        normalized = str(value or "").strip()
        return normalized if normalized else fallback

    branch = data.get("branch", {}) or {}
    cashier = data.get("cashier", {}) or {}
    shift = data.get("shift", {}) or {}
    summary = data.get("summary", {}) or {}
    cash_rec = data.get("cash_reconciliation", {}) or {}
    void_summary = data.get("void_summary", {}) or {}
    payment_breakdown = data.get("payment_breakdown", []) or []
    revenue_breakdown = data.get("revenue_breakdown", []) or []
    credit_bills = data.get("credit_bills", []) or []
    void_lines = data.get("void_lines", []) or []
    lines = data.get("transaction_history", []) or data.get("lines", []) or []

    page_w, page_h = landscape(A4)
    margin = 12 * mm
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=landscape(A4),
        leftMargin=margin,
        rightMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )
    usable_w = page_w - 2 * margin
    story = []

    logo_cell = ""
    if os.path.exists(LOGO_PATH):
        try:
            logo_cell = Image(LOGO_PATH, width=18 * mm, height=18 * mm)
        except Exception:
            logo_cell = p("FG", "company")

    header_inner = Table(
        [[logo_cell, p("FAMOUS GATES HOTELS", "company")]],
        colWidths=[22 * mm, usable_w - 22 * mm],
    )
    header_inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), dark_green),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(header_inner)

    contact = Table(
        [[p("Bomet, Kenya   |   famousgateshotelsbmt@gmail.com   |   Tel: 0706 782 828", "contact")]],
        colWidths=[usable_w],
    )
    contact.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), mid_green),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.extend([contact, Spacer(1, 3 * mm), p("CASHIER SHIFT LOGBOOK", "title")])
    story.append(HRFlowable(width=usable_w, thickness=2, color=dark_green, spaceAfter=3 * mm))

    meta = Table(
        [
            [p("Branch:", "meta_label"), p(text(branch.get("name")), "meta_value"),
             p("Shift:", "meta_label"), p(text(shift.get("shift_number")), "meta_value")],
            [p("Cashier:", "meta_label"), p(text(f"{cashier.get('first_name', '')} {cashier.get('last_name', '')}".strip() or cashier.get("email")), "meta_value"),
             p("Log Date:", "meta_label"), p(text(data.get("log_date")), "meta_value")],
            [p("Status:", "meta_label"), p(text(data.get("status")), "meta_value"),
             p("Submitted:", "meta_label"), p(text(data.get("submitted_at") or data.get("created_at")), "meta_value")],
        ],
        colWidths=[22 * mm, usable_w / 2 - 22 * mm, 22 * mm, usable_w / 2 - 22 * mm],
    )
    meta.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), light_gray),
                ("BACKGROUND", (2, 0), (2, -1), light_gray),
                ("GRID", (0, 0), (-1, -1), 0.4, border),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.extend([meta, Spacer(1, 3 * mm)])

    kpis = Table(
        [
            [
                p("Net Sales", "sum_lbl"),
                p("Gross Sales", "sum_lbl"),
                p("Total Voids", "sum_lbl"),
                p("Cash Variance", "sum_lbl"),
            ],
            [
                p(money(summary.get("net_sales", summary.get("total_sales"))), "sum_val"),
                p(money(summary.get("gross_sales", summary.get("total_sales"))), "sum_val"),
                p(money(summary.get("total_void_amount")), "sum_val"),
                p(money(cash_rec.get("variance")), "sum_val"),
            ],
        ],
        colWidths=[usable_w / 4] * 4,
    )
    kpis.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), light_gray),
                ("GRID", (0, 0), (-1, -1), 0.6, border),
                ("LINEABOVE", (0, 0), (-1, 0), 1.2, dark_green),
                ("LINEBELOW", (0, 1), (-1, 1), 1.2, dark_green),
            ]
        )
    )
    story.extend([kpis, Spacer(1, 4 * mm)])

    def section_title(title):
        tbl = Table([[p(title, "section")]], colWidths=[usable_w])
        tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), accent),
                    ("TEXTCOLOR", (0, 0), (-1, -1), white),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.extend([tbl, Spacer(1, 2 * mm)])

    section_title("Cash Reconciliation")
    cash_rows = [
        ["Opening Float", money(cash_rec.get("opening_float"))],
        ["Cash Sales", money(cash_rec.get("cash_sales"))],
        ["Credit Payments Received", money(cash_rec.get("credit_payments_received"))],
        ["Cash Drops", money(cash_rec.get("cash_drops"))],
        ["Payouts", money(cash_rec.get("payouts"))],
        ["Expected Closing", money(cash_rec.get("expected_closing"))],
        ["Actual Closing", money(cash_rec.get("actual_closing"))],
        ["Variance", money(cash_rec.get("variance"))],
    ]
    cash_tbl = Table(
        [[p(r[0], "cell"), p(r[1], "cell_r")] for r in cash_rows],
        colWidths=[usable_w * 0.6, usable_w * 0.4],
    )
    cash_tbl.setStyle(
        TableStyle(
            [
                ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, light_green]),
                ("GRID", (0, 0), (-1, -1), 0.4, border),
            ]
        )
    )
    story.extend([cash_tbl, Spacer(1, 3 * mm)])

    section_title("Payment Breakdown")
    payment_data = [[
        p("Method", "col_hdr"), p("Count", "col_hdr"), p("Amount", "col_hdr")
    ]]
    for row in payment_breakdown:
        payment_data.append([
            p(text(str(row.get("method", "")).replace("_", " ").upper()), "cell"),
            p(text(row.get("count", 0)), "cell_c"),
            p(money(row.get("amount")), "cell_r"),
        ])
    payment_tbl = Table(payment_data, colWidths=[usable_w * 0.44, usable_w * 0.16, usable_w * 0.40], repeatRows=1)
    payment_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), dark_green),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_green]),
                ("GRID", (0, 0), (-1, -1), 0.4, border),
            ]
        )
    )
    story.extend([payment_tbl, Spacer(1, 3 * mm)])

    if revenue_breakdown:
      section_title("Revenue Streams")
      revenue_data = [[p("Stream", "col_hdr"), p("Amount", "col_hdr")]]
      for row in revenue_breakdown:
          revenue_data.append([
              p(text(row.get("label")), "cell"),
              p(money(row.get("amount")), "cell_r"),
          ])
      revenue_tbl = Table(revenue_data, colWidths=[usable_w * 0.6, usable_w * 0.4], repeatRows=1)
      revenue_tbl.setStyle(
          TableStyle(
              [
                  ("BACKGROUND", (0, 0), (-1, 0), dark_green),
                  ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_green]),
                  ("GRID", (0, 0), (-1, -1), 0.4, border),
              ]
          )
      )
      story.extend([revenue_tbl, Spacer(1, 3 * mm)])

    section_title("Voids and Cancellations Audit")
    void_kpis = Table(
        [
            [
                p("Total Void Amount", "sum_lbl"),
                p("Whole Bill Voids", "sum_lbl"),
                p("Item Voids", "sum_lbl"),
                p("Voided Payments", "sum_lbl"),
            ],
            [
                p(money(void_summary.get("total_void_amount")), "sum_val"),
                p(f"{int(void_summary.get('whole_bill_void_count', 0))} | {money(void_summary.get('whole_bill_void_amount'))}", "sum_val"),
                p(f"{int(void_summary.get('item_void_count', 0))} | {money(void_summary.get('item_void_amount'))}", "sum_val"),
                p(f"{int(void_summary.get('payment_void_count', 0))} | {money(void_summary.get('payment_void_amount'))}", "sum_val"),
            ],
        ],
        colWidths=[usable_w / 4] * 4,
    )
    void_kpis.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), danger_bg),
                ("GRID", (0, 0), (-1, -1), 0.6, border),
                ("LINEABOVE", (0, 0), (-1, 0), 1.0, danger_fg),
                ("LINEBELOW", (0, 1), (-1, 1), 1.0, danger_fg),
            ]
        )
    )
    story.extend([void_kpis, Spacer(1, 2 * mm)])

    if void_lines:
        void_data = [[
            p("Time", "col_hdr"),
            p("Type", "col_hdr"),
            p("Reference", "col_hdr"),
            p("Customer / Item", "col_hdr"),
            p("Reason", "col_hdr"),
            p("Amount", "col_hdr"),
        ]]
        for row in void_lines[:80]:
            void_data.append([
                p(text(row.get("created_at"))[:19], "cell_c"),
                p(text(str(row.get("void_type", "")).replace("_", " ").title()), "cell"),
                p(text(row.get("reference")), "cell"),
                p(text(row.get("customer_name")), "cell"),
                p(text(row.get("void_reason")), "cell"),
                p(money(row.get("amount")), "cell_r"),
            ])
        void_tbl = Table(
            void_data,
            colWidths=[
                usable_w * 0.12,
                usable_w * 0.12,
                usable_w * 0.16,
                usable_w * 0.24,
                usable_w * 0.20,
                usable_w * 0.16,
            ],
            repeatRows=1,
        )
        void_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), danger_fg),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, danger_bg]),
                    ("GRID", (0, 0), (-1, -1), 0.35, border),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
        )
        story.extend([void_tbl, Spacer(1, 3 * mm)])

    if credit_bills:
        section_title("Staff Credit Bills")
        credit_data = [[
            p("Staff", "col_hdr"),
            p("Reference", "col_hdr"),
            p("Department", "col_hdr"),
            p("Status", "col_hdr"),
            p("Amount", "col_hdr"),
        ]]
        for row in credit_bills:
            credit_data.append([
                p(text(row.get("staff_name") or row.get("name")), "cell"),
                p(text(row.get("credit_number") or row.get("reference")), "cell"),
                p(text(row.get("department")), "cell"),
                p(text(row.get("status")), "cell_c"),
                p(money(row.get("amount")), "cell_r"),
            ])
        credit_tbl = Table(
            credit_data,
            colWidths=[usable_w * 0.28, usable_w * 0.18, usable_w * 0.18, usable_w * 0.16, usable_w * 0.20],
            repeatRows=1,
        )
        credit_tbl.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), dark_green),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_green]),
                    ("GRID", (0, 0), (-1, -1), 0.4, border),
                ]
            )
        )
        story.extend([credit_tbl, Spacer(1, 3 * mm)])

    section_title("Transaction History")
    txn_data = [[
        p("#", "col_hdr"),
        p("Time", "col_hdr"),
        p("Reference", "col_hdr"),
        p("Customer", "col_hdr"),
        p("Method", "col_hdr"),
        p("Status", "col_hdr"),
        p("Amount", "col_hdr"),
    ]]
    for index, row in enumerate(lines[:120], start=1):
        is_void = "void" in text(row.get("status")).lower() or "cancel" in text(row.get("section")).lower()
        style_key = "danger" if is_void else "cell"
        style_key_right = "danger" if is_void else "cell_r"
        txn_data.append([
            p(index, "cell_c"),
            p(text(row.get("created_at"))[:19], "cell_c"),
            p(text(row.get("reference")), style_key),
            p(text(row.get("customer_name")), style_key),
            p(text(str(row.get("payment_method", "")).replace("_", " ").title()), style_key),
            p(text(row.get("status")), "danger" if is_void else "cell_c"),
            p(money(row.get("amount")), style_key_right),
        ])
    txn_tbl = Table(
        txn_data,
        colWidths=[
            usable_w * 0.05,
            usable_w * 0.13,
            usable_w * 0.16,
            usable_w * 0.24,
            usable_w * 0.12,
            usable_w * 0.12,
            usable_w * 0.18,
        ],
        repeatRows=1,
    )
    txn_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), dark_green),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, light_green]),
                ("GRID", (0, 0), (-1, -1), 0.35, border),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.extend([txn_tbl, Spacer(1, 4 * mm)])

    generated_at = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
    story.append(p(f"Generated: {generated_at} | Famous Gates Hotels - Confidential", "footer"))

    doc.build(story)
    buf.seek(0)
    return buf.read()
