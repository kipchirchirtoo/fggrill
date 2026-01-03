import {
  notifyLowStock,
  notifyPurchaseOrderApproval,
  notifyOrderReceived,
  notifyRequisitionApproval,
  notifyStockTransfer
} from './notifications';

import { API_URL } from './config';

// Automated workflow for purchase orders
export const handlePurchaseOrderWorkflow = async (orderId: string, action: 'create' | 'approve' | 'reject' | 'receive') => {
  try {
    const response = await fetch(`${API_URL}/api/purchase-orders/${orderId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error(`Failed to ${action} purchase order`);

    const order = await response.json();

    switch (action) {
      case 'create':
        await notifyPurchaseOrderApproval(orderId, order.supplier.name);
        break;
      case 'approve':
        // Send PO to supplier via email
        await sendPurchaseOrderEmail(order);
        break;
      case 'receive':
        await notifyOrderReceived(orderId, order.supplier.name);
        // Automatically update stock levels
        await updateStockLevels(order.items);
        break;
    }

    return order;
  } catch (error) {
    console.error(`Error in purchase order workflow (${action}):`, error);
    throw error;
  }
};

// Automated workflow for requisitions
export const handleRequisitionWorkflow = async (requisitionId: string, action: 'create' | 'approve' | 'reject' | 'fulfill') => {
  try {
    const response = await fetch(`${API_URL}/api/requisitions/${requisitionId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error(`Failed to ${action} requisition`);

    const requisition = await response.json();

    switch (action) {
      case 'create':
        await notifyRequisitionApproval(requisitionId, requisition.department);
        break;
      case 'approve':
        // Check if items need to be ordered
        await checkAndCreatePurchaseOrders(requisition);
        break;
      case 'fulfill':
        // Update stock levels and notify department
        await fulfillRequisition(requisition);
        break;
    }

    return requisition;
  } catch (error) {
    console.error(`Error in requisition workflow (${action}):`, error);
    throw error;
  }
};

// Automated workflow for stock transfers
export const handleStockTransferWorkflow = async (transferId: string, action: 'create' | 'approve' | 'receive') => {
  try {
    const response = await fetch(`${API_URL}/api/transfers/${transferId}/${action}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error(`Failed to ${action} transfer`);

    const transfer = await response.json();

    switch (action) {
      case 'create':
        await notifyStockTransfer(transferId, transfer.fromBranch, transfer.toBranch);
        break;
      case 'approve':
        // Update stock levels at source branch
        await updateSourceBranchStock(transfer);
        break;
      case 'receive':
        // Update stock levels at destination branch
        await updateDestinationBranchStock(transfer);
        break;
    }

    return transfer;
  } catch (error) {
    console.error(`Error in stock transfer workflow (${action}):`, error);
    throw error;
  }
};

// Automated stock monitoring
export const monitorStockLevels = async () => {
  try {
    const response = await fetch(`${API_URL}/api/inventory/low-stock`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to check stock levels');

    const lowStockItems = await response.json();

    if (lowStockItems.length > 0) {
      await notifyLowStock(lowStockItems);
      await autoGeneratePurchaseOrders(lowStockItems);
    }

    return lowStockItems;
  } catch (error) {
    console.error('Error monitoring stock levels:', error);
    throw error;
  }
};

// Helper functions
const sendPurchaseOrderEmail = async (order: any) => {
  try {
    await fetch(`${API_URL}/api/emails/purchase-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(order)
    });
  } catch (error) {
    console.error('Error sending PO email:', error);
    throw error;
  }
};

const updateStockLevels = async (items: any[]) => {
  try {
    await fetch(`${API_URL}/api/inventory/update-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ items })
    });
  } catch (error) {
    console.error('Error updating stock levels:', error);
    throw error;
  }
};

const checkAndCreatePurchaseOrders = async (requisition: any) => {
  try {
    const response = await fetch(`${API_URL}/api/inventory/check-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(requisition.items)
    });

    if (!response.ok) throw new Error('Failed to check stock availability');

    const { itemsToOrder } = await response.json();

    if (itemsToOrder.length > 0) {
      await autoGeneratePurchaseOrders(itemsToOrder);
    }
  } catch (error) {
    console.error('Error checking and creating POs:', error);
    throw error;
  }
};

const autoGeneratePurchaseOrders = async (items: any[]) => {
  try {
    await fetch(`${API_URL}/api/purchase-orders/auto-generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ items })
    });
  } catch (error) {
    console.error('Error auto-generating POs:', error);
    throw error;
  }
};

const fulfillRequisition = async (requisition: any) => {
  try {
    await fetch(`${API_URL}/api/inventory/fulfill-requisition`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(requisition)
    });
  } catch (error) {
    console.error('Error fulfilling requisition:', error);
    throw error;
  }
};

const updateSourceBranchStock = async (transfer: any) => {
  try {
    await fetch(`${API_URL}/api/inventory/update-source-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(transfer)
    });
  } catch (error) {
    console.error('Error updating source branch stock:', error);
    throw error;
  }
};

const updateDestinationBranchStock = async (transfer: any) => {
  try {
    await fetch(`${API_URL}/api/inventory/update-destination-stock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(transfer)
    });
  } catch (error) {
    console.error('Error updating destination branch stock:', error);
    throw error;
  }
};
