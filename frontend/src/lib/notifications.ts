import { toast } from 'sonner';
import { UserRole } from './auth-context';

// Role hierarchy - higher number = higher access level
export const ROLE_HIERARCHY: Record<string, number> = {
  [UserRole.SUPER_ADMIN]: 100,
  [UserRole.GENERAL_MANAGER]: 90,
  [UserRole.BRANCH_MANAGER]: 80,
  [UserRole.AUDITOR]: 70,
  [UserRole.ACCOUNTANT]: 60,
  [UserRole.CENTRAL_STOREKEEPER]: 55,
  [UserRole.BRANCH_STOREKEEPER]: 50,
  [UserRole.HOUSEKEEPING_SUPERVISOR]: 45,
  [UserRole.RECEPTIONIST]: 40,
  [UserRole.HOUSEKEEPING]: 30,
  [UserRole.RESTAURANT]: 30,
  [UserRole.BARTENDER]: 30,
  [UserRole.MAINTENANCE]: 20,
  [UserRole.EMPLOYEE]: 10,
  [UserRole.GUEST]: 0,
};

// Notification visibility levels
export type NotificationLevel = 'all' | 'staff' | 'supervisors' | 'managers' | 'admin';

export const LEVEL_MIN_ROLE: Record<NotificationLevel, number> = {
  all: 0,           // Everyone can see
  staff: 20,        // All staff
  supervisors: 50,  // Storekeeper and above
  managers: 70,     // Manager and above
  admin: 90,        // Admin and Super Admin only
};

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
  visibility?: NotificationLevel;       // Who can see this notification
  targetRoles?: string[];               // Specific roles that can see this
  targetDepartments?: string[];         // Specific departments
  targetBranchId?: string;              // Specific branch only
  createdByRole?: string;               // Role of creator
}

export interface NotificationSubscriber {
  id: string;
  userId: string;
  department: string;
  role: string;
  notificationTypes: string[];
}

import { apiClient } from './api/core';

export async function sendNotification(notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) {
  try {
    const res = await apiClient.post<any>('/notifications', notification);
    return res.data;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
}

export async function getNotifications(userId: string) {
  try {
    const res = await apiClient.get<any>(`/notifications/user/${userId}`);
    return res.data;
  } catch (error) {
    console.error('Error fetching notifications:', error);
    throw error;
  }
}

// Check if a user can view a notification based on role hierarchy
export function canViewNotification(
  notification: Notification,
  userRole: string,
  userDepartment?: string,
  userBranchId?: string
): boolean {
  const userLevel = ROLE_HIERARCHY[userRole] || 0;

  // Check visibility level
  if (notification.visibility) {
    const requiredLevel = LEVEL_MIN_ROLE[notification.visibility];
    if (userLevel < requiredLevel) return false;
  }

  // Check specific target roles
  if (notification.targetRoles && notification.targetRoles.length > 0) {
    if (!notification.targetRoles.includes(userRole)) return false;
  }

  // Check specific departments
  if (notification.targetDepartments && notification.targetDepartments.length > 0) {
    if (!userDepartment || !notification.targetDepartments.includes(userDepartment)) return false;
  }

  // Check branch restriction
  if (notification.targetBranchId) {
    if (userBranchId !== notification.targetBranchId) {
      // Super admin and general manager can see all branches
      if (userLevel < ROLE_HIERARCHY[UserRole.GENERAL_MANAGER]) return false;
    }
  }

  return true;
}

// Filter notifications for a specific user
export function filterNotificationsForUser(
  notifications: Notification[],
  userRole: string,
  userDepartment?: string,
  userBranchId?: string
): Notification[] {
  return notifications.filter(n =>
    canViewNotification(n, userRole, userDepartment, userBranchId)
  );
}

// Get role display name
export function getRoleDisplayName(role: string): string {
  const names: Record<string, string> = {
    [UserRole.SUPER_ADMIN]: 'Super Admin',
    [UserRole.GENERAL_MANAGER]: 'General Manager',
    [UserRole.BRANCH_MANAGER]: 'Branch Manager',
    [UserRole.AUDITOR]: 'Auditor',
    [UserRole.ACCOUNTANT]: 'Accountant',
    [UserRole.CENTRAL_STOREKEEPER]: 'Central Storekeeper',
    [UserRole.BRANCH_STOREKEEPER]: 'Branch Storekeeper',
    [UserRole.HOUSEKEEPING_SUPERVISOR]: 'Housekeeping Supervisor',
    [UserRole.RECEPTIONIST]: 'Receptionist',
    [UserRole.HOUSEKEEPING]: 'Housekeeping',
    [UserRole.RESTAURANT]: 'Restaurant Staff',
    [UserRole.BARTENDER]: 'Bartender',
    [UserRole.MAINTENANCE]: 'Maintenance',
    [UserRole.EMPLOYEE]: 'Employee',
    [UserRole.GUEST]: 'Guest',
  };
  return names[role] || role;
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    const res = await apiClient.patch<any>(`/notifications/${notificationId}/read`);
    return res.data;
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
