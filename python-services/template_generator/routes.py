"""
Template Generator Blueprint
Consolidated template management and rendering service
"""
from flask import Blueprint, request, jsonify
import os
import logging
from jinja2 import Template
import json
import sqlite3
import uuid

logger = logging.getLogger(__name__)

# Create blueprint
template_generator_bp = Blueprint('template_generator', __name__, url_prefix='/api/templates')

class TemplateService:
    def __init__(self):
        self.db_path = os.path.join(os.path.dirname(__file__), 'templates.db')
        self.conn = sqlite3.connect(self.db_path, check_same_thread=False)
        self.conn.execute('''
            CREATE TABLE IF NOT EXISTS templates (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                template_content TEXT NOT NULL,
                variables TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        self.conn.commit()
    
    def save_template(self, template_id, name, category, content, variables):
        try:
            self.conn.execute('''
                INSERT OR REPLACE INTO templates 
                (id, name, category, template_content, variables)
                VALUES (?, ?, ?, ?, ?)
            ''', (template_id, name, category, content, json.dumps(variables)))
            self.conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error saving template: {e}")
            return False
    
    def get_template(self, template_id):
        cursor = self.conn.execute(
            'SELECT * FROM templates WHERE id = ?', (template_id,)
        )
        return cursor.fetchone()
    
    def get_all_templates(self, category=None):
        if category:
            cursor = self.conn.execute(
                'SELECT * FROM templates WHERE category = ?', (category,)
            )
        else:
            cursor = self.conn.execute('SELECT * FROM templates')
        return cursor.fetchall()
    
    def render_template(self, template_id, data):
        template_row = self.get_template(template_id)
        if not template_row:
            return None
        
        template = Template(template_row[3])  # template_content
        return template.render(**data)
    
    def delete_template(self, template_id):
        try:
            self.conn.execute('DELETE FROM templates WHERE id = ?', (template_id,))
            self.conn.commit()
            return True
        except Exception as e:
            logger.error(f"Error deleting template: {e}")
            return False

# Initialize service
template_service = TemplateService()

# Routes
@template_generator_bp.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'service': 'template_generator'})

@template_generator_bp.route('', methods=['POST'])
def create_template():
    """Create or update a template"""
    data = request.json
    template_id = data.get('id', str(uuid.uuid4()))
    
    success = template_service.save_template(
        template_id,
        data['name'],
        data['category'], 
        data['content'],
        data.get('variables', [])
    )
    
    if success:
        return jsonify({'id': template_id, 'message': 'Template saved successfully'})
    return jsonify({'error': 'Failed to save template'}), 500

@template_generator_bp.route('', methods=['GET'])
def list_templates():
    """List all templates or filter by category"""
    category = request.args.get('category')
    templates = template_service.get_all_templates(category)
    
    result = []
    for t in templates:
        result.append({
            'id': t[0],
            'name': t[1],
            'category': t[2],
            'variables': json.loads(t[4]),
            'created_at': t[5]
        })
    
    return jsonify({'templates': result})

@template_generator_bp.route('/<template_id>', methods=['GET'])
def get_template(template_id):
    """Get a specific template"""
    template = template_service.get_template(template_id)
    
    if template:
        return jsonify({
            'id': template[0],
            'name': template[1],
            'category': template[2],
            'content': template[3],
            'variables': json.loads(template[4]),
            'created_at': template[5]
        })
    return jsonify({'error': 'Template not found'}), 404

@template_generator_bp.route('/<template_id>/render', methods=['POST'])
def render_template(template_id):
    """Render a template with provided data"""
    data = request.json or {}
    rendered = template_service.render_template(template_id, data)
    
    if rendered:
        return jsonify({'content': rendered})
    return jsonify({'error': 'Template not found'}), 404

@template_generator_bp.route('/<template_id>', methods=['DELETE'])
def delete_template(template_id):
    """Delete a template"""
    success = template_service.delete_template(template_id)
    
    if success:
        return jsonify({'message': 'Template deleted successfully'})
    return jsonify({'error': 'Failed to delete template'}), 500
