
from flask import Blueprint, request, send_file, jsonify
import json
import os
import tempfile
import requests
from .generator import IDCardGenerator

id_cards_bp = Blueprint('id_cards', __name__)
generator = IDCardGenerator()

@id_cards_bp.route('/api/id-cards/generate', methods=['POST'])
def generate_id_card():
    """
    Generate an ID card PDF
    Accepts JSON or Multipart (for photo upload)
    """
    try:
        # Handle both JSON and Form Data (for files)
        if request.is_json:
            data = request.get_json()
        else:
            data = request.form.to_dict()
            if 'data' in data: # sometimes sent as a json string in a form field
                data = json.loads(data['data'])
        
        # Handle photo upload
        photo_file = request.files.get('photo')
        temp_photo_path = None
        
        if photo_file:
            # Save to temporary file for ReportLab to read
            ext = os.path.splitext(photo_file.filename)[1]
            fd, temp_photo_path = tempfile.mkstemp(suffix=ext)
            os.close(fd)
            photo_file.save(temp_photo_path)
            data['photo_path'] = temp_photo_path
        elif 'photo_url' in data and data['photo_url']:
            # Download from URL
            try:
                url = data['photo_url']
                # If it's a supabase path but not full URL, construct it? 
                # For now assume full URL or handle
                response = requests.get(url, stream=True)
                if response.status_code == 200:
                    fd, temp_photo_path = tempfile.mkstemp(suffix='.jpg')
                    os.close(fd)
                    with open(temp_photo_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    data['photo_path'] = temp_photo_path
            except Exception as e:
                print(f"Error downloading photo: {e}")

        pdf_bytes = generator.generate(data)
        
        # Cleanup temp file
        if temp_photo_path and os.path.exists(temp_photo_path):
            os.remove(temp_photo_path)
            
        return send_file(
            io.BytesIO(pdf_bytes),
            mimetype='application/pdf',
            as_attachment=True,
            download_name=f"ID_{data.get('id_no', 'Card')}.pdf"
        )
    except Exception as e:
        return jsonify({'error': str(e), 'success': False}), 500

@id_cards_bp.route('/api/id-cards/preview', methods=['POST'])
def preview_id_card():
    # Same as generate for now, or returns a low-res image if needed.
    # For now, let's keep it simple.
    return generate_id_card()

# Add io import at top
import io
