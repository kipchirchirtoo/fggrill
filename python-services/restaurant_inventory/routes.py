"""
Kyogong - Restaurant Inventory & Consumption Tracking
Handles kitchen inventory consumption, wastage tracking, and cost analysis
"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import uuid
from typing import Dict, List, Any, Optional, Tuple
from decimal import Decimal
import logging

# Create blueprint
restaurant_inventory_bp = Blueprint('restaurant_inventory', __name__, url_prefix='/api/restaurant-inventory')

logger = logging.getLogger(__name__)

# In-memory storage for demo (replace with database in production)
inventory_items = {}
consumption_records = {}
wastage_records = {}
production_records = {}
recipes = {}
cost_analysis = {}

def calculate_item_cost(item_code: str, quantity: float) -> float:
    """Calculate cost for an item based on current inventory value"""
    if item_code in inventory_items:
        item = inventory_items[item_code]
        return item['unit_cost'] * quantity
    return 0.0

def calculate_recipe_cost(recipe_id: str, servings: int = 1) -> Dict[str, Any]:
    """Calculate total cost for a recipe"""
    if recipe_id not in recipes:
        return {'total_cost': 0.0, 'cost_per_serving': 0.0, 'ingredients': []}
    
    recipe = recipes[recipe_id]
    total_cost = 0.0
    ingredients_cost = []
    
    for ingredient in recipe['ingredients']:
        item_code = ingredient['item_code']
        quantity_needed = ingredient['quantity'] * servings
        cost = calculate_item_cost(item_code, quantity_needed)
        total_cost += cost
        
        ingredients_cost.append({
            'item_code': item_code,
            'item_name': inventory_items.get(item_code, {}).get('name', 'Unknown'),
            'quantity': quantity_needed,
            'unit': ingredient['unit'],
            'cost': cost
        })
    
    return {
        'total_cost': total_cost,
        'cost_per_serving': total_cost / servings if servings > 0 else 0,
        'ingredients': ingredients_cost
    }

# Inventory Management Routes
@restaurant_inventory_bp.route('/items', methods=['GET'])
def get_inventory_items():
    """Get all restaurant inventory items with current levels"""
    try:
        branch_id = request.args.get('branch_id')
        category = request.args.get('category')
        
        filtered_items = list(inventory_items.values())
        
        if branch_id:
            filtered_items = [item for item in filtered_items if str(item.get('branch_id')) == branch_id]
        
        if category:
            filtered_items = [item for item in filtered_items if item.get('category') == category]
        
        return jsonify({
            'success': True,
            'data': filtered_items,
            'total': len(filtered_items)
        })
    except Exception as e:
        logger.error(f"Error fetching inventory items: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/items', methods=['POST'])
def create_inventory_item():
    """Create a new inventory item"""
    try:
        item_data = request.get_json()
        
        item_id = str(uuid.uuid4())
        item = {
            'id': item_id,
            'item_code': item_data.get('item_code', f'ITM{item_id[:8].upper()}'),
            'name': item_data['name'],
            'description': item_data.get('description', ''),
            'category': item_data['category'],  # produce, meat, dairy, dry_goods, beverages
            'unit': item_data['unit'],  # kg, liters, pieces, packets
            'current_stock': item_data.get('current_stock', 0),
            'min_stock_level': item_data.get('min_stock_level', 0),
            'max_stock_level': item_data.get('max_stock_level', 0),
            'unit_cost': item_data.get('unit_cost', 0),
            'supplier': item_data.get('supplier', ''),
            'storage_location': item_data.get('storage_location', ''),
            'expiry_date': item_data.get('expiry_date'),
            'branch_id': item_data.get('branch_id'),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        inventory_items[item_id] = item
        
        return jsonify({
            'success': True,
            'data': item,
            'message': 'Inventory item created successfully'
        })
    except Exception as e:
        logger.error(f"Error creating inventory item: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Consumption Tracking Routes
@restaurant_inventory_bp.route('/consumption', methods=['GET'])
def get_consumption_records():
    """Get consumption records with filters"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        item_code = request.args.get('item_code')
        
        filtered_records = list(consumption_records.values())
        
        if start_date:
            filtered_records = [r for r in filtered_records if r['date'] >= start_date]
        if end_date:
            filtered_records = [r for r in filtered_records if r['date'] <= end_date]
        if branch_id:
            filtered_records = [r for r in filtered_records if str(r.get('branch_id')) == branch_id]
        if item_code:
            filtered_records = [r for r in filtered_records if r.get('item_code') == item_code]
        
        # Sort by date descending
        filtered_records.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_records,
            'total': len(filtered_records)
        })
    except Exception as e:
        logger.error(f"Error fetching consumption records: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/consumption', methods=['POST'])
def record_consumption():
    """Record inventory consumption for meal preparation"""
    try:
        data = request.get_json()
        
        consumption_id = str(uuid.uuid4())
        total_cost = 0.0
        
        # Calculate total cost for all items consumed
        for item in data['items']:
            item_cost = calculate_item_cost(item['item_code'], item['quantity'])
            total_cost += item_cost
        
        consumption = {
            'id': consumption_id,
            'date': data['date'],
            'meal_period': data['meal_period'],  # breakfast, lunch, dinner, room_service
            'reference': data.get('reference', f'CON{datetime.now().strftime("%Y%m%d%H%M%S")}'),
            'items': data['items'],
            'total_cost': total_cost,
            'prepared_by': data.get('prepared_by', 'System'),
            'branch_id': data.get('branch_id'),
            'notes': data.get('notes', ''),
            'created_at': datetime.now().isoformat()
        }
        
        consumption_records[consumption_id] = consumption
        
        # Update inventory levels
        for item in data['items']:
            item_code = item['item_code']
            quantity = item['quantity']
            
            # Find and update inventory item
            for inv_item in inventory_items.values():
                if inv_item['item_code'] == item_code:
                    inv_item['current_stock'] -= quantity
                    inv_item['updated_at'] = datetime.now().isoformat()
                    break
        
        return jsonify({
            'success': True,
            'data': consumption,
            'message': 'Consumption recorded successfully'
        })
    except Exception as e:
        logger.error(f"Error recording consumption: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Wastage Tracking Routes
@restaurant_inventory_bp.route('/wastage', methods=['GET'])
def get_wastage_records():
    """Get wastage records with analysis"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        reason = request.args.get('reason')
        
        filtered_records = list(wastage_records.values())
        
        if start_date:
            filtered_records = [r for r in filtered_records if r['date'] >= start_date]
        if end_date:
            filtered_records = [r for r in filtered_records if r['date'] <= end_date]
        if branch_id:
            filtered_records = [r for r in filtered_records if str(r.get('branch_id')) == branch_id]
        if reason:
            filtered_records = [r for r in filtered_records if r.get('reason') == reason]
        
        # Sort by date descending
        filtered_records.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_records,
            'total': len(filtered_records)
        })
    except Exception as e:
        logger.error(f"Error fetching wastage records: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/wastage', methods=['POST'])
def record_wastage():
    """Record inventory wastage with reasons"""
    try:
        data = request.get_json()
        
        wastage_id = str(uuid.uuid4())
        total_cost = 0.0
        
        # Calculate total cost for wasted items
        for item in data['items']:
            item_cost = calculate_item_cost(item['item_code'], item['quantity'])
            total_cost += item_cost
        
        wastage = {
            'id': wastage_id,
            'date': data['date'],
            'reference': data.get('reference', f'WST{datetime.now().strftime("%Y%m%d%H%M%S")}'),
            'items': data['items'],
            'total_cost': total_cost,
            'reason': data['reason'],  # spoilage, overproduction, preparation_error, expired, customer_return
            'department': data.get('department', 'Kitchen'),
            'reported_by': data.get('reported_by', 'System'),
            'branch_id': data.get('branch_id'),
            'notes': data.get('notes', ''),
            'preventive_action': data.get('preventive_action', ''),
            'created_at': datetime.now().isoformat()
        }
        
        wastage_records[wastage_id] = wastage
        
        # Update inventory levels
        for item in data['items']:
            item_code = item['item_code']
            quantity = item['quantity']
            
            # Find and update inventory item
            for inv_item in inventory_items.values():
                if inv_item['item_code'] == item_code:
                    inv_item['current_stock'] -= quantity
                    inv_item['updated_at'] = datetime.now().isoformat()
                    break
        
        return jsonify({
            'success': True,
            'data': wastage,
            'message': 'Wastage recorded successfully'
        })
    except Exception as e:
        logger.error(f"Error recording wastage: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Production & Revenue Tracking Routes
@restaurant_inventory_bp.route('/production', methods=['GET'])
def get_production_records():
    """Get food production records with revenue analysis"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        filtered_records = list(production_records.values())
        
        if start_date:
            filtered_records = [r for r in filtered_records if r['date'] >= start_date]
        if end_date:
            filtered_records = [r for r in filtered_records if r['date'] <= end_date]
        if branch_id:
            filtered_records = [r for r in filtered_records if str(r.get('branch_id')) == branch_id]
        
        # Sort by date descending
        filtered_records.sort(key=lambda x: x['date'], reverse=True)
        
        return jsonify({
            'success': True,
            'data': filtered_records,
            'total': len(filtered_records)
        })
    except Exception as e:
        logger.error(f"Error fetching production records: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/production', methods=['POST'])
def record_production():
    """Record food production with revenue tracking"""
    try:
        data = request.get_json()
        
        production_id = str(uuid.uuid4())
        
        # Calculate cost of goods sold
        recipe_cost = calculate_recipe_cost(data['recipe_id'], data['servings_produced'])
        
        production = {
            'id': production_id,
            'date': data['date'],
            'meal_period': data['meal_period'],
            'recipe_id': data['recipe_id'],
            'recipe_name': recipes.get(data['recipe_id'], {}).get('name', 'Unknown Recipe'),
            'servings_produced': data['servings_produced'],
            'servings_sold': data.get('servings_sold', 0),
            'selling_price_per_serving': data.get('selling_price_per_serving', 0),
            'total_revenue': data.get('servings_sold', 0) * data.get('selling_price_per_serving', 0),
            'cost_of_goods': recipe_cost['total_cost'],
            'gross_profit': (data.get('servings_sold', 0) * data.get('selling_price_per_serving', 0)) - recipe_cost['total_cost'],
            'food_cost_percentage': (recipe_cost['total_cost'] / (data.get('servings_sold', 0) * data.get('selling_price_per_serving', 0)) * 100) if data.get('servings_sold', 0) > 0 else 0,
            'branch_id': data.get('branch_id'),
            'prepared_by': data.get('prepared_by', 'System'),
            'notes': data.get('notes', ''),
            'created_at': datetime.now().isoformat()
        }
        
        production_records[production_id] = production
        
        return jsonify({
            'success': True,
            'data': production,
            'message': 'Production recorded successfully'
        })
    except Exception as e:
        logger.error(f"Error recording production: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Recipe Management Routes
@restaurant_inventory_bp.route('/recipes', methods=['GET'])
def get_recipes():
    """Get all recipes with cost analysis"""
    try:
        recipes_with_cost = []
        
        for recipe_id, recipe in recipes.items():
            cost_analysis = calculate_recipe_cost(recipe_id, 1)
            recipe_with_cost = {
                **recipe,
                'cost_analysis': cost_analysis
            }
            recipes_with_cost.append(recipe_with_cost)
        
        return jsonify({
            'success': True,
            'data': recipes_with_cost
        })
    except Exception as e:
        logger.error(f"Error fetching recipes: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/recipes', methods=['POST'])
def create_recipe():
    """Create a new recipe with ingredient list"""
    try:
        data = request.get_json()
        
        recipe_id = str(uuid.uuid4())
        recipe = {
            'id': recipe_id,
            'name': data['name'],
            'category': data.get('category', 'main_course'),
            'description': data.get('description', ''),
            'servings': data.get('servings', 1),
            'ingredients': data['ingredients'],  # List of {item_code, quantity, unit}
            'instructions': data.get('instructions', []),
            'selling_price_per_serving': data.get('selling_price_per_serving', 0),
            'branch_id': data.get('branch_id'),
            'created_by': data.get('created_by', 'System'),
            'created_at': datetime.now().isoformat(),
            'updated_at': datetime.now().isoformat()
        }
        
        recipes[recipe_id] = recipe
        
        return jsonify({
            'success': True,
            'data': recipe,
            'message': 'Recipe created successfully'
        })
    except Exception as e:
        logger.error(f"Error creating recipe: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

# Cost Analysis & Reporting Routes
@restaurant_inventory_bp.route('/analysis/cost-to-revenue', methods=['GET'])
def get_cost_to_revenue_analysis():
    """Get comprehensive cost-to-revenue analysis"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        # Filter production records
        filtered_production = list(production_records.values())
        
        if start_date:
            filtered_production = [p for p in filtered_production if p['date'] >= start_date]
        if end_date:
            filtered_production = [p for p in filtered_production if p['date'] <= end_date]
        if branch_id:
            filtered_production = [p for p in filtered_production if str(p.get('branch_id')) == branch_id]
        
        # Calculate totals
        total_revenue = sum(p['total_revenue'] for p in filtered_production)
        total_cogs = sum(p['cost_of_goods'] for p in filtered_production)
        total_wastage_cost = sum(w['total_cost'] for w in wastage_records.values())
        total_consumption_cost = sum(c['total_cost'] for c in consumption_records.values())
        
        # Calculate averages
        avg_food_cost_percentage = (total_cogs / total_revenue * 100) if total_revenue > 0 else 0
        wastage_percentage = (total_wastage_cost / total_cogs * 100) if total_cogs > 0 else 0
        
        # Category analysis
        category_analysis = {}
        for production in filtered_production:
            category = production.get('recipe_category', 'uncategorized')
            if category not in category_analysis:
                category_analysis[category] = {
                    'revenue': 0,
                    'cost': 0,
                    'items': 0
                }
            category_analysis[category]['revenue'] += production['total_revenue']
            category_analysis[category]['cost'] += production['cost_of_goods']
            category_analysis[category]['items'] += 1
        
        # Calculate category percentages
        for cat_data in category_analysis.values():
            cat_data['food_cost_percentage'] = (cat_data['cost'] / cat_data['revenue'] * 100) if cat_data['revenue'] > 0 else 0
        
        analysis = {
            'summary': {
                'total_revenue': total_revenue,
                'total_cost_of_goods': total_cogs,
                'gross_profit': total_revenue - total_cogs,
                'avg_food_cost_percentage': avg_food_cost_percentage,
                'total_wastage_cost': total_wastage_cost,
                'wastage_percentage': wastage_percentage,
                'total_consumption_cost': total_consumption_cost
            },
            'category_breakdown': category_analysis,
            'period': f"{start_date} to {end_date}" if start_date and end_date else "All time"
        }
        
        return jsonify({
            'success': True,
            'data': analysis
        })
    except Exception as e:
        logger.error(f"Error generating cost analysis: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

@restaurant_inventory_bp.route('/reports/wastage-analysis', methods=['GET'])
def get_wastage_analysis_report():
    """Get detailed wastage analysis for auditors and managers"""
    try:
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        branch_id = request.args.get('branch_id')
        
        # Filter wastage records
        filtered_wastage = list(wastage_records.values())
        
        if start_date:
            filtered_wastage = [w for w in filtered_wastage if w['date'] >= start_date]
        if end_date:
            filtered_wastage = [w for w in filtered_wastage if w['date'] <= end_date]
        if branch_id:
            filtered_wastage = [w for w in filtered_wastage if str(w.get('branch_id')) == branch_id]
        
        # Analyze by reason
        reason_analysis = {}
        item_analysis = {}
        department_analysis = {}
        
        for wastage in filtered_wastage:
            # By reason
            reason = wastage['reason']
            if reason not in reason_analysis:
                reason_analysis[reason] = {'count': 0, 'cost': 0, 'items': []}
            reason_analysis[reason]['count'] += 1
            reason_analysis[reason]['cost'] += wastage['total_cost']
            
            # By item
            for item in wastage['items']:
                item_code = item['item_code']
                if item_code not in item_analysis:
                    item_analysis[item_code] = {'quantity': 0, 'cost': 0, 'name': ''}
                item_analysis[item_code]['quantity'] += item['quantity']
                item_analysis[item_code]['cost'] += calculate_item_cost(item_code, item['quantity'])
                item_analysis[item_code]['name'] = inventory_items.get(item_code, {}).get('name', 'Unknown')
            
            # By department
            dept = wastage.get('department', 'Kitchen')
            if dept not in department_analysis:
                department_analysis[dept] = {'count': 0, 'cost': 0}
            department_analysis[dept]['count'] += 1
            department_analysis[dept]['cost'] += wastage['total_cost']
        
        # Calculate totals
        total_wastage_cost = sum(w['total_cost'] for w in filtered_wastage)
        total_wastage_items = sum(len(w['items']) for w in filtered_wastage)
        
        report = {
            'summary': {
                'total_incidents': len(filtered_wastage),
                'total_items_wasted': total_wastage_items,
                'total_cost': total_wastage_cost,
                'average_cost_per_incident': total_wastage_cost / len(filtered_wastage) if filtered_wastage else 0
            },
            'by_reason': reason_analysis,
            'by_item': dict(sorted(item_analysis.items(), key=lambda x: x[1]['cost'], reverse=True)[:10]),  # Top 10 items
            'by_department': department_analysis,
            'trend_data': [
                {
                    'date': w['date'],
                    'cost': w['total_cost'],
                    'reason': w['reason']
                } for w in filtered_wastage
            ],
            'recommendations': generate_wastage_recommendations(reason_analysis)
        }
        
        return jsonify({
            'success': True,
            'data': report
        })
    except Exception as e:
        logger.error(f"Error generating wastage report: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500

def generate_wastage_recommendations(reason_analysis: Dict) -> List[str]:
    """Generate recommendations based on wastage analysis"""
    recommendations = []
    
    if 'spoilage' in reason_analysis and reason_analysis['spoilage']['count'] > 5:
        recommendations.append("Consider implementing better inventory rotation (FIFO) to reduce spoilage")
    
    if 'overproduction' in reason_analysis and reason_analysis['overproduction']['count'] > 3:
        recommendations.append("Review production forecasting and adjust batch sizes to match demand")
    
    if 'preparation_error' in reason_analysis and reason_analysis['preparation_error']['count'] > 2:
        recommendations.append("Provide additional training to kitchen staff on standard recipes and procedures")
    
    if 'expired' in reason_analysis and reason_analysis['expired']['count'] > 0:
        recommendations.append("Implement regular expiry date monitoring and establish first-expiry-first-out system")
    
    if not recommendations:
        recommendations.append("Wastage levels are within acceptable ranges. Continue current practices")
    
    return recommendations

# No sample data - data should come from database or be created via API
