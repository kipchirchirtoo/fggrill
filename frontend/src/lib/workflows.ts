import {
  notifyLowStock,
  notifyPurchaseOrderApproval,
  notifyOrderReceived,
  notifyRequisitionApproval,
  notifyStockTransfer
} from './notifications';

import { apiClient } from './api/core';

// Automated workflow for purchase orders
export const handlePurchaseOrderWorkflow = async (orderId: string, action: 'create' | 'approve' | 'reject' | 'receive') => {
  try {
    const res = await apiClient.post<any>(`/purchase-orders/${orderId}/${action}`);
    const order = res.data;

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
    const res = await apiClient.post<any>(`/requisitions/${requisitionId}/${action}`);
    const requisition = res.data;

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
    const res = await apiClient.post<any>(`/transfers/${transferId}/${action}`);
    const transfer = res.data;

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
    const res = await apiClient.get<any[]>('/inventory/low-stock');
    const lowStockItems = res.data;

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
    await apiClient.post('/emails/purchase-order', order);
  } catch (error) {
    console.error('Error sending PO email:', error);
    throw error;
  }
};

const updateStockLevels = async (items: any[]) => {
  try {
    await apiClient.post('/inventory/update-stock', { items });
  } catch (error) {
    console.error('Error updating stock levels:', error);
    throw error;
  }
};

const checkAndCreatePurchaseOrders = async (requisition: any) => {
  try {
    const res = await apiClient.post<any>('/inventory/check-stock', requisition.items);
    const { itemsToOrder } = res.data;

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
    await apiClient.post('/purchase-orders/auto-generate', { items });
  } catch (error) {
    console.error('Error auto-generating POs:', error);
    throw error;
  }
};

const fulfillRequisition = async (requisition: any) => {
  try {
    await apiClient.post('/inventory/fulfill-requisition', requisition);
  } catch (error) {
    console.error('Error fulfilling requisition:', error);
    throw error;
  }
};

const updateSourceBranchStock = async (transfer: any) => {
  try {
    await apiClient.post('/inventory/update-source-stock', transfer);
  } catch (error) {
    console.error('Error updating source branch stock:', error);
    throw error;
  }
};

const updateDestinationBranchStock = async (transfer: any) => {
  try {
    await apiClient.post('/inventory/update-destination-stock', transfer);
  } catch (error) {
    console.error('Error updating destination branch stock:', error);
    throw error;
  }
};
