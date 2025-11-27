const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// Item Management
export async function createItem(data: any) {
  const response = await fetch(`${API_URL}/api/inventory/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function getItems(branch: string) {
  const response = await fetch(`${API_URL}/api/inventory/items?branch=${branch}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}

// Stock Transfers
export async function createTransfer(data: any) {
  const response = await fetch(`${API_URL}/api/inventory/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function getTransfers(branch: string) {
  const response = await fetch(`${API_URL}/api/inventory/transfers?branch=${branch}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}

// Consumption Records
export async function recordConsumption(data: any) {
  const response = await fetch(`${API_URL}/api/inventory/consumption`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
}

export async function getConsumptionRecords(branch: string, department?: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams({
    branch,
    ...(department && { department }),
    ...(startDate && { startDate }),
    ...(endDate && { endDate })
  });
  
  const response = await fetch(`${API_URL}/api/inventory/consumption?${params}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}

// Stock Alerts
export async function getLowStockAlerts(branch: string) {
  const response = await fetch(`${API_URL}/api/inventory/alerts/low-stock?branch=${branch}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}

// Reports
export async function generateInventoryReport(branch: string, type: 'daily' | 'weekly' | 'monthly') {
  const response = await fetch(`${API_URL}/api/inventory/reports?branch=${branch}&type=${type}`, {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });
  return response.json();
}
