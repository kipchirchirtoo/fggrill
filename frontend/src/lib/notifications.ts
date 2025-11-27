import { toast } from 'sonner';

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  department?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface NotificationSubscriber {
  id: string;
  userId: string;
  department: string;
  role: string;
  notificationTypes: string[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export async function sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  try {
    const response = await fetch(`${API_URL}/api/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(notification)
    });

    if (!response.ok) throw new Error('Failed to send notification');

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function getNotifications(userId: string) {
  try {
    const response = await fetch(`${API_URL}/api/notifications/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to fetch notifications');

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    if (!response.ok) throw new Error('Failed to mark notification as read');

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

// Workflow notifications
export const notifyLowStock = async (items: any[]) => {
  const notification = {
    type: 'warning' as const,
    title: 'Low Stock Alert',
    message: `${items.length} items are running low on stock. Action required.`,
    department: 'Store Keeping',
    priority: 'high' as const,
    actionUrl: '/dashboard/storekeeping/inventory'
  };

  await sendNotification(notification);
  toast.warning(notification.message, {
    action: {
      label: 'View Items',
      onClick: () => window.location.href = notification.actionUrl
    }
  });
};

export const notifyPurchaseOrderApproval = async (orderId: string, supplierName: string) => {
  const notification = {
    type: 'info' as const,
    title: 'Purchase Order Approval Required',
    message: `New purchase order for ${supplierName} requires approval.`,
    department: 'Store Keeping',
    priority: 'medium' as const,
    actionUrl: `/dashboard/storekeeping/purchase-orders/${orderId}`
  };

  await sendNotification(notification);
  toast.info(notification.message, {
    action: {
      label: 'Review Order',
      onClick: () => window.location.href = notification.actionUrl
    }
  });
};

export const notifyOrderReceived = async (orderId: string, supplierName: string) => {
  const notification = {
    type: 'success' as const,
    title: 'Order Received',
    message: `Order from ${supplierName} has been received and requires verification.`,
    department: 'Store Keeping',
    priority: 'high' as const,
    actionUrl: `/dashboard/storekeeping/receiving/${orderId}`
  };

  await sendNotification(notification);
  toast.success(notification.message, {
    action: {
      label: 'Verify Order',
      onClick: () => window.location.href = notification.actionUrl
    }
  });
};

export const notifyRequisitionApproval = async (requisitionId: string, department: string) => {
  const notification = {
    type: 'info' as const,
    title: 'Requisition Approval Required',
    message: `New requisition from ${department} requires approval.`,
    department: 'Store Keeping',
    priority: 'medium' as const,
    actionUrl: `/dashboard/storekeeping/requisitions/${requisitionId}`
  };

  await sendNotification(notification);
  toast.info(notification.message, {
    action: {
      label: 'Review Requisition',
      onClick: () => window.location.href = notification.actionUrl
    }
  });
};

export const notifyStockTransfer = async (transferId: string, fromBranch: string, toBranch: string) => {
  const notification = {
    type: 'info' as const,
    title: 'Stock Transfer Initiated',
    message: `New stock transfer from ${fromBranch} to ${toBranch} requires processing.`,
    department: 'Store Keeping',
    priority: 'medium' as const,
    actionUrl: `/dashboard/storekeeping/transfers/${transferId}`
  };

  await sendNotification(notification);
  toast.info(notification.message, {
    action: {
      label: 'Process Transfer',
      onClick: () => window.location.href = notification.actionUrl
    }
  });
};
