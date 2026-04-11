
from flask import Blueprint, request, send_file, jsonify
import json
import os
import io
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
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Handle both JSON and Form Data (for files)
        data = None
        
        if request.is_json:
            data = request.get_json()
            logger.info("[ID Card] Received JSON request")
        elif request.form:
            logger.info("[ID Card] Received Form Data request")
            if 'data' in request.form:
                # Data sent as JSON string in form field
                data = json.loads(request.form['data'])
            else:
                # Data sent as individual form fields
                data = request.form.to_dict()
        else:
            logger.error("[ID Card] No data received in request")
            return jsonify({'error': 'No data provided', 'success': False}), 400
        
        if not data:
            logger.error("[ID Card] Data is empty after parsing")
            return jsonify({'error': 'Empty data received', 'success': False}), 400
        
        logger.info(f"[ID Card] Generating card for: {data.get('name', 'Unknown')}")
        logger.info(f"[ID Card] Data keys: {list(data.keys())}")
        
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
                logger.info(f"[ID Card] Downloading photo from: {url}")
                
                # Add headers to avoid 403 Forbidden
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
                
                response = requests.get(url, stream=True, timeout=10, headers=headers)
                logger.info(f"[ID Card] Photo download response: HTTP {response.status_code}")
                
                if response.status_code == 200:
                    fd, temp_photo_path = tempfile.mkstemp(suffix='.jpg')
                    os.close(fd)
                    with open(temp_photo_path, 'wb') as f:
                        for chunk in response.iter_content(1024):
                            f.write(chunk)
                    data['photo_path'] = temp_photo_path
                    logger.info(f"[ID Card] Photo downloaded successfully to: {temp_photo_path}")
                    logger.info(f"[ID Card] Photo file size: {os.path.getsize(temp_photo_path)} bytes")
                else:
                    logger.warning(f"[ID Card] Failed to download photo: HTTP {response.status_code}")
                    logger.warning(f"[ID Card] Response content: {response.text[:200]}")
            except Exception as e:
                logger.error(f"[ID Card] Error downloading photo: {e}")
                import traceback
                logger.error(traceback.format_exc())

        logger.info("[ID Card] Calling generator.generate()")
        pdf_bytes = generator.generate(data)
        logger.info(f"[ID Card] PDF generated successfully, size: {len(pdf_bytes)} bytes")
        
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
        logger.error(f"[ID Card] ERROR: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({'error': str(e), 'success': False}), 500

@id_cards_bp.route('/api/id-cards/preview', methods=['POST'])
def preview_id_card():
    # Same as generate for now, or returns a low-res image if needed.
    # For now, let's keep it simple.
    return generate_id_card()
