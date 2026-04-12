/**
 * WatermelonDB Schema for FamousGate Hotels Mobile App
 * Offline-first database schema for inventory, dispatch, delivery, and waste management
 */

import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    // Inventory Items
    tableSchema({
      name: 'inventory_items',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'unit', type: 'string' },
        { name: 'category', type: 'string', isIndexed: true },
        { name: 'reorder_level', type: 'number' },
        { name: 'current_stock', type: 'number' },
        { name: 'branch_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Dispatch Notes
    tableSchema({
      name: 'dispatch_notes',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'dispatch_number', type: 'string', isIndexed: true },
        { name: 'from_branch_id', type: 'string', isIndexed: true },
        { name: 'to_branch_id', type: 'string', isIndexed: true },
        { name: 'status', type: 'string', isIndexed: true }, // draft|dispatched|in_transit|delivered|discrepancy
        { name: 'otp_code', type: 'string', isOptional: true },
        { name: 'otp_expires_at', type: 'number', isOptional: true },
        { name: 'dispatched_at', type: 'number', isOptional: true },
        { name: 'delivered_at', type: 'number', isOptional: true },
        { name: 'driver_name', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_by', type: 'string', isIndexed: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Dispatch Items
    tableSchema({
      name: 'dispatch_items',
      columns: [
        { name: 'dispatch_note_id', type: 'string', isIndexed: true },
        { name: 'inventory_item_id', type: 'string', isIndexed: true },
        { name: 'qty_dispatched', type: 'number' },
        { name: 'qty_received', type: 'number', isOptional: true },
        { name: 'unit', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Delivery Codes (OTP)
    tableSchema({
      name: 'delivery_codes',
      columns: [
        { name: 'dispatch_note_id', type: 'string', isIndexed: true },
        { name: 'code', type: 'string', isIndexed: true },
        { name: 'expires_at', type: 'number' },
        { name: 'attempts', type: 'number' },
        { name: 'verified', type: 'boolean' },
        { name: 'verified_by', type: 'string', isOptional: true },
        { name: 'verified_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Branch Receipts
    tableSchema({
      name: 'branch_receipts',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'dispatch_note_id', type: 'string', isIndexed: true },
        { name: 'received_by', type: 'string', isIndexed: true },
        { name: 'branch_id', type: 'string', isIndexed: true },
        { name: 'photo_uri', type: 'string', isOptional: true },
        { name: 'photo_uploaded', type: 'boolean' },
        { name: 'has_discrepancy', type: 'boolean' },
        { name: 'discrepancy_note', type: 'string', isOptional: true },
        { name: 'confirmed_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Waste Logs
    tableSchema({
      name: 'waste_logs',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'inventory_item_id', type: 'string', isIndexed: true },
        { name: 'branch_id', type: 'string', isIndexed: true },
        { name: 'qty', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'reason', type: 'string', isIndexed: true }, // expired|damaged|spilled|theft_suspected|other
        { name: 'photo_uri', type: 'string', isOptional: true },
        { name: 'photo_uploaded', type: 'boolean' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'logged_by', type: 'string', isIndexed: true },
        { name: 'logged_at', type: 'number' },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Stock Take Sessions
    tableSchema({
      name: 'stock_take_sessions',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'branch_id', type: 'string', isIndexed: true },
        { name: 'category', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true }, // in_progress|submitted
        { name: 'started_by', type: 'string', isIndexed: true },
        { name: 'started_at', type: 'number' },
        { name: 'submitted_at', type: 'number', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Stock Take Entries
    tableSchema({
      name: 'stock_take_entries',
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'inventory_item_id', type: 'string', isIndexed: true },
        { name: 'system_qty', type: 'number' },
        { name: 'counted_qty', type: 'number' },
        { name: 'variance', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // GRN Records (Goods Received Notes)
    tableSchema({
      name: 'grn_records',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'grn_number', type: 'string', isIndexed: true },
        { name: 'supplier_id', type: 'string', isIndexed: true },
        { name: 'branch_id', type: 'string', isIndexed: true },
        { name: 'po_number', type: 'string', isOptional: true },
        { name: 'received_by', type: 'string', isIndexed: true },
        { name: 'received_at', type: 'number' },
        { name: 'status', type: 'string', isIndexed: true }, // draft|confirmed
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Cashier Transactions
    tableSchema({
      name: 'cashier_transactions',
      columns: [
        { name: 'server_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'transaction_number', type: 'string', isIndexed: true },
        { name: 'booking_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'amount', type: 'number' },
        { name: 'payment_method', type: 'string', isIndexed: true }, // cash|mpesa|card|split
        { name: 'status', type: 'string', isIndexed: true }, // pending|completed|failed
        { name: 'cashier_id', type: 'string', isIndexed: true },
        { name: 'shift_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'branch_id', type: 'string', isIndexed: true },
        { name: 'receipt_number', type: 'string', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),

    // Offline Queue
    tableSchema({
      name: 'offline_queue',
      columns: [
        { name: 'entity_type', type: 'string', isIndexed: true }, // dispatch|receipt|waste|stock_take|grn|cashier
        { name: 'entity_id', type: 'string', isIndexed: true },
        { name: 'operation', type: 'string' }, // create|update|delete
        { name: 'payload', type: 'string' }, // JSON stringified
        { name: 'attempts', type: 'number' },
        { name: 'last_error', type: 'string', isOptional: true },
        { name: 'status', type: 'string', isIndexed: true }, // pending|syncing|failed|synced
        { name: 'priority', type: 'number' }, // Higher number = higher priority
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
});
