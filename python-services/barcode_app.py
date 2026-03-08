"""
Minimal Python Service for Barcode Generation
Only includes barcode/QR code generation - no database dependencies
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
from dotenv import load_dotenv
import logging
from datetime import datetime
import io
import base64

# Load environment variables
load_dotenv()

# Import barcode service
from barcode_generator.routes import barcode_generator_bp
from pdf_generator.routes import pdf_generator_bp

app = Flask(__name__)
CORS(app, resources={r"/*": {
    "origins": ["http://localhost:3000", "http://localhost:3001", "http://localhost:5000", "*"],
    "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    "allow_headers": ["Content-Type", "Authorization", "X-Requested-With"],
    "supports_credentials": True
}})

# Register blueprints
app.register_blueprint(barcode_generator_bp)
app.register_blueprint(pdf_generator_bp)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'OK',
        'service': 'Barcode & PDF Generation Service',
        'version': '1.0.0',
        'features': ['barcode', 'qr_code', 'pdf_invoice'],
        'timestamp': datetime.now().isoformat()
    }), 200

if __name__ == '__main__':
    port = int(os.getenv('PYTHON_SERVICE_PORT', 5001))
    logger.info(f"Starting Barcode & PDF Service on port {port}")
    logger.info("Available endpoints:")
    logger.info("  - POST /api/barcode/generate")
    logger.info("  - POST /api/reports/generate/branded-pdf")
    app.run(host='0.0.0.0', port=port, debug=True)
