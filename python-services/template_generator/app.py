from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import logging
from jinja2 import Template
import json
import sqlite3
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

class TemplateService:
    def __init__(self):
        self.conn = sqlite3.connect('templates.db', check_same_thread=False)
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
    
    def render_template(self, template_id, data):
        template_row = self.get_template(template_id)
        if not template_row:
            return None
        
        template = Template(template_row[3])  # template_content
        return template.render(**data)

template_service = TemplateService()

@app.route('/health')
def health():
    return jsonify({'status': 'healthy'})

@app.route('/templates', methods=['POST'])
def create_template():
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
        return jsonify({'id': template_id})
    return jsonify({'error': 'Failed'}), 500

@app.route('/templates/<template_id>/render', methods=['POST'])
def render_template(template_id):
    data = request.json or {}
    rendered = template_service.render_template(template_id, data)
    
    if rendered:
        return jsonify({'content': rendered})
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002)
