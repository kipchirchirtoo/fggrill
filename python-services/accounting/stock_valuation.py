"""
Stock Valuation Service
Handles FIFO and Weighted Average cost calculations for stock operations.
"""

from decimal import Decimal
from typing import List, Dict, Tuple, Optional
from datetime import date
import logging

logger = logging.getLogger(__name__)

class StockValuationService:
    def __init__(self, supabase_client):
        self.supabase = supabase_client
    
    def calculate_fifo_cost(self, branch_id: int, item_id: str, quantity: Decimal, as_of_date: date) -> Tuple[Decimal, List[Dict]]:
        """
        Calculate cost using First-In-First-Out (FIFO) method.
        Returns total cost and a list of layers used.
        """
        if not self.supabase:
            logger.error("Supabase client not initialized")
            return Decimal('0'), []

        try:
            # Get all purchase layers for this item in this branch up to as_of_date
            # ordered by date (oldest first)
            res = self.supabase.table('stock_valuation_layers')\
                .select('*')\
                .eq('branch_id', branch_id)\
                .eq('item_id', item_id)\
                .lte('transaction_date', as_of_date)\
                .gt('remaining_quantity', 0)\
                .order('transaction_date', desc=False)\
                .execute()
            
            if not res.data:
                logger.warning(f"No stock layers found for item {item_id} in branch {branch_id}")
                return Decimal('0'), []

            total_cost = Decimal('0')
            remaining_qty_to_value = Decimal(str(quantity))
            used_layers = []
            
            for layer in res.data:
                if remaining_qty_to_value <= 0:
                    break
                
                available_qty = Decimal(str(layer['remaining_quantity']))
                qty_to_use = min(remaining_qty_to_value, available_qty)
                
                layer_unit_cost = Decimal(str(layer['unit_cost']))
                layer_cost = qty_to_use * layer_unit_cost
                total_cost += layer_cost
                
                used_layers.append({
                    'layer_id': layer['id'],
                    'quantity_used': float(qty_to_use),
                    'unit_cost': float(layer_unit_cost),
                    'total_cost': float(layer_cost),
                    'reference': layer.get('reference_id')
                })
                
                remaining_qty_to_value -= qty_to_use
            
            if remaining_qty_to_value > 0:
                logger.warning(f"Insufficient stock layers for item {item_id}. Missing {remaining_qty_to_value} units.")
                # We still return what we could value, but maybe we should flag this
            
            return total_cost, used_layers

        except Exception as e:
            logger.error(f"Error calculating FIFO cost: {e}")
            return Decimal('0'), []

    def calculate_weighted_average_cost(self, branch_id: int, item_id: str, as_of_date: date) -> Decimal:
        """
        Calculate Weighted Average Cost for an item in a branch.
        """
        if not self.supabase:
            return Decimal('0')

        try:
            res = self.supabase.table('stock_valuation_layers')\
                .select('remaining_quantity, unit_cost')\
                .eq('branch_id', branch_id)\
                .eq('item_id', item_id)\
                .lte('transaction_date', as_of_date)\
                .gt('remaining_quantity', 0)\
                .execute()
            
            if not res.data:
                return Decimal('0')

            total_value = Decimal('0')
            total_quantity = Decimal('0')
            
            for layer in res.data:
                qty = Decimal(str(layer['remaining_quantity']))
                cost = Decimal(str(layer['unit_cost']))
                total_value += qty * cost
                total_quantity += qty
            
            if total_quantity == 0:
                return Decimal('0')
            
            return total_value / total_quantity

        except Exception as e:
            logger.error(f"Error calculating weighted average cost: {e}")
            return Decimal('0')

    def record_stock_layer(self, branch_id: int, item_id: str, transaction_type: str, 
                        quantity: Decimal, unit_cost: Decimal, transaction_date: date,
                        reference_id: Optional[str] = None, reference_type: Optional[str] = None):
        """
        Records a new stock layer (e.g. from a purchase or adjustment).
        """
        if not self.supabase:
            return None

        try:
            data = {
                'branch_id': branch_id,
                'item_id': item_id,
                'transaction_type': transaction_type,
                'quantity': float(quantity),
                'unit_cost': float(unit_cost),
                'remaining_quantity': float(quantity),
                'transaction_date': transaction_date.isoformat(),
                'reference_id': reference_id,
                'reference_type': reference_type
            }
            
            res = self.supabase.table('stock_valuation_layers').insert(data).execute()
            return res.data[0] if res.data else None
            
        except Exception as e:
            logger.error(f"Error recording stock layer: {e}")
            return None

    def consume_stock_layers(self, branch_id: int, item_id: str, quantity: Decimal, as_of_date: date) -> List[Dict]:
        """
        Consumes stock layers for a sale or transfer out (FIFO).
        Updates remaining_quantity in the layers table.
        """
        if not self.supabase:
            return []

        try:
            # Re-use FIFO logic to find layers
            total_cost, used_layers = self.calculate_fifo_cost(branch_id, item_id, quantity, as_of_date)
            
            for used in used_layers:
                # Update each layer individually (ideally in a transaction or batch)
                self.supabase.rpc('decrease_stock_layer_quantity', {
                    'p_layer_id': used['layer_id'],
                    'p_decrease_by': used['quantity_used']
                }).execute()
                
            return used_layers
            
        except Exception as e:
            logger.error(f"Error consuming stock layers: {e}")
            return []
