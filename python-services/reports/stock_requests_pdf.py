# -*- coding: utf-8 -*-
"""
FAMOUSGATE HOTELS - Stock Requests PDF Generator
Branded PDF export for stock requests using the same styling as payroll reports
"""
import io, os
from datetime import datetime
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle,
                                 Paragraph, Spacer, HRFlowable, Image)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

LOGO_PATH = os.path.join(os.path.dirname(__file__), '..', 'assets', 'fglogo.png')

# Brand colors matching payroll theme
THEME = {
    "dark":       "1A4731",
    "mid":        "2D6A4F", 
    "accent":     "40916C",
    "light":      "D8F3DC",
    "light_gray": "F2F2F2",
    "border":     "B0B0B0",
    "pending":    "FFF3CD",
    "approved":   "D1ECF1",
    "rejected":   "F8D7DA",
    "delivered":  "D4EDDA",
}

def generate_stock_requests_pdf(data: dict) -> bytes:
    """Generate branded PDF for stock requests"""
    
    DARK_GREEN  = colors.HexColor("#1A4731")
    MID_GREEN   = colors.HexColor("#2D6A4F")
    ACCENT      = colors.HexColor("#40916C")
    LIGHT_GREEN = colors.HexColor("#D8F3DC")
    LIGHT_GRAY  = colors.HexColor("#F2F2F2")
    WHITE       = colors.white
    BORDER_CLR  = colors.HexColor("#B0B0B0")
    
    # Status colors
    PENDING_BG  = colors.HexColor("#FFF3CD")
    APPROVED_BG = colors.HexColor("#D1ECF1")
    REJECTED_BG = colors.HexColor("#F8D7DA")
    DELIVERED_BG = colors.HexColor("#D4EDDA")

    def S(name, **kw): return ParagraphStyle(name, **kw)
    STYLES = {
        "company":    S("company",    fontName="Helvetica-Bold",   fontSize=18, textColor=WHITE,      alignment=TA_CENTER),
        "contact":    S("contact",    fontName="Helvetica-Oblique",fontSize=8,  textColor=WHITE,      alignment=TA_CENTER),
        "title":      S("title",      fontName="Helvetica-Bold",   fontSize=14, textColor=DARK_GREEN, alignment=TA_CENTER, spaceBefore=4, spaceAfter=4),
        "branch_tag": S("branch_tag", fontName="Helvetica-Bold",   fontSize=11, textColor=WHITE,      alignment=TA_CENTER),
        "meta_label": S("meta_label", fontName="Helvetica-Bold",   fontSize=8,  textColor=DARK_GREEN),
        "meta_value": S("meta_value", fontName="Helvetica",        fontSize=8,  textColor=colors.black),
        "sum_lbl":    S("sum_lbl",    fontName="Helvetica-Bold",   fontSize=7,  textColor=colors.HexColor("#555555"), alignment=TA_CENTER),
        "sum_val":    S("sum_val",    fontName="Helvetica-Bold",   fontSize=12, textColor=DARK_GREEN, alignment=TA_CENTER),
        "col_hdr":    S("col_hdr",    fontName="Helvetica-Bold",   fontSize=7,  textColor=WHITE,      alignment=TA_CENTER, leading=8),
        "cell":       S("cell",       fontName="Helvetica",        fontSize=7,  textColor=colors.black, leading=9),
        "cell_r":     S("cell_r",     fontName="Helvetica",        fontSize=7,  textColor=colors.black, alignment=TA_RIGHT, leading=9),
        "cell_c":     S("cell_c",     fontName="Helvetica",        fontSize=7,  textColor=colors.black, alignment=TA_CENTER, leading=9),
        "req_num":    S("req_num",    fontName="Helvetica-Bold",   fontSize=7,  textColor=MID_GREEN,  alignment=TA_CENTER, leading=9),
        "total_lbl":  S("total_lbl",  fontName="Helvetica-Bold",   fontSize=8,  textColor=WHITE,      alignment=TA_CENTER),
        "total_val":  S("total_val",  fontName="Helvetica-Bold",   fontSize=8,  textColor=WHITE,      alignment=TA_RIGHT, leading=9),
        "status":     S("status",     fontName="Helvetica-Bold",   fontSize=6.5,textColor=colors.black, alignment=TA_CENTER),
        "footer":     S("footer",     fontName="Helvetica-Oblique",fontSize=7,  textColor=colors.HexColor("#888888"), alignment=TA_CENTER),
    }

    def P(text, style): return Paragraph(str(text), STYLES[style])
    def fmt_date(date_str):
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00')).strftime('%d/%m/%Y')
        except:
            return date_str

    requests = data.get("requests", [])
    branch_name = data.get("branch_name", "All Branches")
    report_type = data.get("report_type", "Stock Requests Report")
    generated = datetime.now().strftime("%d/%m/%Y, %H:%M:%S")
    company = "FAMOUSGATE HOTELS"
    address = "Bomet, Kenya"
    email = "famousgateshotelsbmt@gmail.com"
    phone = "0706 782 828"

    page_w, page_h = landscape(A4)
    margin = 12 * mm
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4),
                            leftMargin=margin, rightMargin=margin,
                            topMargin=margin, bottomMargin=margin)
    usable_w = page_w - 2 * margin
    story = []

    # ── HEADER BANNER with logo ───────────────────────────────────────────────
    logo_cell = ""
    if os.path.exists(LOGO_PATH):
        try:
            logo_img = Image(LOGO_PATH, width=18*mm, height=18*mm)
            logo_cell = logo_img
        except Exception:
            logo_cell = P("FG", "company")

    logo_w  = 22 * mm
    text_w  = usable_w - logo_w

    hdr_inner = Table(
        [[logo_cell, P(company, "company")]],
        colWidths=[logo_w, text_w]
    )
    hdr_inner.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), DARK_GREEN),
        ("VALIGN",     (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING",(0,0),(0,0), 4),
        ("TOPPADDING", (0,0),(-1,-1), 10),
        ("BOTTOMPADDING",(0,0),(-1,-1), 10),
    ]))

    contact_row = Table(
        [[P(f"{address}   |   {email}   |   Tel: {phone}", "contact")]],
        colWidths=[usable_w]
    )
    contact_row.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1), MID_GREEN),
        ("TOPPADDING",(0,0),(-1,-1), 4),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
    ]))

    story += [hdr_inner, contact_row, Spacer(1, 3*mm)]

    # ── TITLE + BRANCH TAG ────────────────────────────────────────────────────
    story.append(P(report_type.upper(), "title"))

    # Branch tag — only show if not "All Branches"
    if branch_name and branch_name != "All Branches":
        branch_tbl = Table([[P(f"Branch: {branch_name}", "branch_tag")]],
                           colWidths=[usable_w])
        branch_tbl.setStyle(TableStyle([
            ("BACKGROUND",(0,0),(-1,-1), ACCENT),
            ("TOPPADDING",(0,0),(-1,-1), 5),
            ("BOTTOMPADDING",(0,0),(-1,-1), 5),
            ("ROUNDEDCORNERS", [3]),
        ]))
        story.append(branch_tbl)
        story.append(Spacer(1, 2*mm))

    story.append(HRFlowable(width=usable_w, thickness=2, color=DARK_GREEN, spaceAfter=3*mm))

    # ── META ──────────────────────────────────────────────────────────────────
    hw = usable_w / 2
    meta = Table([
        [P("Report Type:", "meta_label"), P(report_type, "meta_value"), P("Branch:", "meta_label"), P(branch_name, "meta_value")],
        [P("Generated:", "meta_label"), P(generated, "meta_value"), P("Total Requests:", "meta_label"), P(str(len(requests)), "meta_value")],
    ], colWidths=[25*mm, hw-25*mm, 25*mm, hw-25*mm])
    meta.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(0,-1),LIGHT_GRAY),("BACKGROUND",(2,0),(2,-1),LIGHT_GRAY),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),4),("GRID",(0,0),(-1,-1),0.4,BORDER_CLR),
    ]))
    story += [meta, Spacer(1, 3*mm)]

    # ── SUMMARY BOXES ─────────────────────────────────────────────────────────
    status_counts = {}
    for req in requests:
        status = req.get('status', 'UNKNOWN')
        status_counts[status] = status_counts.get(status, 0) + 1
    
    total_items = sum(len(req.get('items', [])) for req in requests)
    
    qw = usable_w / 4
    sum_tbl = Table([
        [P("Total Requests","sum_lbl"), P("Total Items","sum_lbl"),
         P("Pending","sum_lbl"), P("Completed","sum_lbl")],
        [P(str(len(requests)),"sum_val"), P(str(total_items),"sum_val"),
         P(str(status_counts.get('PENDING', 0)),"sum_val"), P(str(status_counts.get('DELIVERED', 0) + status_counts.get('RECEIVED', 0)),"sum_val")],
    ], colWidths=[qw,qw,qw,qw])
    sum_tbl.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),LIGHT_GRAY),("BACKGROUND",(0,1),(-1,1),WHITE),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("GRID",(0,0),(-1,-1),0.8,colors.HexColor("#555555")),
        ("LINEABOVE",(0,0),(-1,0),1.5,DARK_GREEN),("LINEBELOW",(0,1),(-1,1),1.5,DARK_GREEN),
    ]))
    story += [sum_tbl, Spacer(1, 4*mm)]

    # ── REQUESTS TABLE ────────────────────────────────────────────────────────
    col_mm  = [12, 20, 25, 15, 20, 15, 15, 20, 30]
    col_pts = [c*mm for c in col_mm]
    headers = [
        P("Request #","col_hdr"), P("Date Created","col_hdr"), P("Branch","col_hdr"),
        P("Items","col_hdr"), P("Status","col_hdr"), P("Priority","col_hdr"),
        P("Type","col_hdr"), P("Needed By","col_hdr"), P("Reason","col_hdr"),
    ]
    table_data = [headers]
    
    def get_status_bg(status):
        if status == 'PENDING': return PENDING_BG
        elif status in ['APPROVED', 'PARTIALLY_APPROVED']: return APPROVED_BG
        elif status == 'REJECTED': return REJECTED_BG
        elif status in ['DELIVERED', 'RECEIVED', 'FULFILLED']: return DELIVERED_BG
        else: return WHITE
    
    for req in requests:
        status = req.get('status', 'UNKNOWN')
        table_data.append([
            P(req.get("request_number", ""), "req_num"),
            P(fmt_date(req.get("created_at", "")), "cell_c"),
            P(req.get("branch_name", ""), "cell"),
            P(str(len(req.get("items", []))), "cell_c"),
            P(status, "status"),
            P(req.get("priority", "NORMAL"), "cell_c"),
            P(req.get("request_type", "ROUTINE"), "cell_c"),
            P(fmt_date(req.get("needed_by_date", "")) if req.get("needed_by_date") else "-", "cell_c"),
            P(req.get("reason", "")[:40] + ("..." if len(req.get("reason", "")) > 40 else ""), "cell"),
        ])
    
    n_rows = len(table_data)
    tbl = Table(table_data, colWidths=col_pts, repeatRows=1)
    
    # Apply status-based row coloring
    style_commands = [
        ("BACKGROUND",(0,0),(-1,0),DARK_GREEN),
        ("GRID",(0,0),(-1,-1),0.4,BORDER_CLR),
        ("LINEBELOW",(0,0),(-1,0),1.0,WHITE),
        ("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3),
        ("LEFTPADDING",(0,0),(-1,-1),3),("RIGHTPADDING",(0,0),(-1,-1),3),
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
    ]
    
    # Add alternating row colors and status-specific backgrounds
    for i in range(1, n_rows):
        req = requests[i-1] if i-1 < len(requests) else {}
        status = req.get('status', 'UNKNOWN')
        bg_color = get_status_bg(status)
        style_commands.append(("BACKGROUND",(0,i),(-1,i), bg_color))
    
    tbl.setStyle(TableStyle(style_commands))
    story += [tbl, Spacer(1, 8*mm)]

    # ── FOOTER ────────────────────────────────────────────────────────────────
    story += [
        HRFlowable(width=usable_w, thickness=0.5, color=BORDER_CLR),
        Spacer(1, 2*mm),
        P(f"© 2026 {company} — Stock Requests Report   |   Generated: {generated}", "footer")
    ]

    doc.build(story)
    buf.seek(0)
    return buf.read()


def generate_stock_requests_history_pdf(data: dict) -> bytes:
    """Generate branded PDF for stock requests history (completed/cancelled requests)"""
    data["report_type"] = "Stock Requests History Report"
    return generate_stock_requests_pdf(data)