from flask import Flask, render_template, request, send_file
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
import io
import base64
from datetime import datetime
from PIL import Image as PILImage

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/generate-pdf', methods=['POST'])
def generate_pdf():
    data = request.json
    
    customer = data.get('customer', 'Client').strip()
    email = data.get('email', '').strip()
    invoice_no = data.get('invoice_no', 'INV-001').strip()
    inv_date = data.get('inv_date', datetime.now().strftime('%Y-%m-%d')).strip()
    due_date = data.get('due_date', '').strip()
    currency_symbol = data.get('currency', '₹')
    accent_theme = data.get('accent_theme', 'emerald')
    
    # Theme color map for ReportLab
    theme_colors = {
        'emerald': colors.HexColor('#10B981'),
        'cyan': colors.HexColor('#06B6D4'),
        'indigo': colors.HexColor('#6366F1'),
        'violet': colors.HexColor('#8B5CF6'),
        'amber': colors.HexColor('#F59E0B')
    }
    primary_color = theme_colors.get(accent_theme, colors.HexColor('#10B981'))

    tax_rate = float(data.get('tax_rate', 0))
    discount_val = float(data.get('discount_val', 0))
    discount_type = data.get('discount_type', 'flat')
    items = data.get('items', [])
    bank_details = data.get('bank_details', '').strip()
    notes = data.get('notes', '').strip()
    logo_b64 = data.get('logo_b64', '')

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    # Dynamic proportional logo scaling
    logo_img = None
    if logo_b64 and ',' in logo_b64:
        try:
            header, encoded = logo_b64.split(',', 1)
            img_data = base64.b64decode(encoded)
            img_buffer = io.BytesIO(img_data)
            
            pil_img = PILImage.open(img_buffer)
            orig_width, orig_height = pil_img.size
            img_buffer.seek(0)

            max_height, max_width = 55.0, 140.0
            aspect = orig_width / float(orig_height)
            calc_width = max_height * aspect
            calc_height = max_height

            if calc_width > max_width:
                calc_width = max_width
                calc_height = max_width / aspect

            logo_img = Image(img_buffer, width=calc_width, height=calc_height)
            logo_img.hAlign = 'LEFT'
        except Exception as e:
            print(f"Error handling logo: {e}")

    title_style = ParagraphStyle('DocTitle', parent=styles['Heading1'], fontSize=24, leading=28, textColor=colors.HexColor('#0F172A'), fontName='Helvetica-Bold')
    meta_style = ParagraphStyle('DocMeta', parent=styles['Normal'], fontSize=9, leading=14, textColor=colors.HexColor('#475569'), alignment=2)

    left_header = logo_img if logo_img else Paragraph("<b>INVOICE</b>", title_style)
    due_text = f"<br/><b>Due Date:</b> {due_date}" if due_date else ""
    meta_text = f"<b>Invoice #:</b> {invoice_no}<br/><b>Date:</b> {inv_date}{due_text}"

    header_table = Table([[left_header, Paragraph(meta_text, meta_style)]], colWidths=[270, 270])
    header_table.setStyle(TableStyle([('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))

    # Billed to Card
    client_info = Paragraph(f"<b>BILLED TO:</b><br/><font size=11 color='#0F172A'><b>{customer}</b></font><br/>{email if email else ''}", styles['Normal'])
    client_table = Table([[client_info]], colWidths=[540])
    client_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
        ('PADDING', (0, 0), (-1, -1), 10),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#E2E8F0')),
    ]))

    # Table with accent primary color
    table_data = [["Description", "Qty", "Unit Price", "Total"]]
    subtotal = 0.0

    for item in items:
        qty, price = int(item['qty']), float(item['price'])
        total = qty * price
        subtotal += total
        table_data.append([
            Paragraph(item['desc'], styles['Normal']),
            str(qty),
            f"{currency_symbol}{price:,.2f}",
            f"{currency_symbol}{total:,.2f}"
        ])

    discount_amount = (subtotal * (discount_val / 100)) if discount_type == 'percent' else discount_val
    discount_amount = min(discount_amount, subtotal)
    discounted_subtotal = subtotal - discount_amount

    tax_amount = discounted_subtotal * (tax_rate / 100)
    grand_total = discounted_subtotal + tax_amount

    table_data.append(["", "", "Subtotal:", f"{currency_symbol}{subtotal:,.2f}"])
    if discount_amount > 0:
        disc_label = f"Discount ({discount_val}%):" if discount_type == 'percent' else "Discount:"
        table_data.append(["", "", disc_label, f"-{currency_symbol}{discount_amount:,.2f}"])
    table_data.append(["", "", f"Tax ({tax_rate}%):", f"{currency_symbol}{tax_amount:,.2f}"])
    table_data.append(["", "", "Grand Total:", f"{currency_symbol}{grand_total:,.2f}"])

    item_table = Table(table_data, colWidths=[270, 50, 110, 110])
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), primary_color),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('PADDING', (0, 0), (-1, -1), 7),
        ('GRID', (0, 0), (-1, len(items)), 0.5, colors.HexColor('#E2E8F0')),
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('FONTNAME', (2, -1), (-1, -1), 'Helvetica-Bold'),
        ('BACKGROUND', (2, -1), (-1, -1), primary_color),
        ('TEXTCOLOR', (2, -1), (-1, -1), colors.whitesmoke),
    ]))

    elements = [header_table, Spacer(1, 15), client_table, Spacer(1, 15), item_table]

    if bank_details or notes:
        elements.append(Spacer(1, 15))
        info_blocks = []
        if bank_details:
            info_blocks.append(Paragraph(f"<b>Payment / Bank Details:</b><br/>{bank_details.replace('\\n', '<br/>')}", styles['Normal']))
        if notes:
            info_blocks.append(Paragraph(f"<b>Terms & Notes:</b><br/>{notes.replace('\\n', '<br/>')}", styles['Normal']))
        
        info_table = Table([[block] for block in info_blocks], colWidths=[540])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#F8FAFC')),
            ('PADDING', (0, 0), (-1, -1), 8),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#CBD5E1')),
        ]))
        elements.append(info_table)

    doc.build(elements)
    buffer.seek(0)
    
    return send_file(
        buffer,
        as_attachment=False,
        mimetype='application/pdf',
        download_name=f"{invoice_no}_{customer.replace(' ', '_')}.pdf"
    )

if __name__ == '__main__':
    app.run(debug=True, port=5000)