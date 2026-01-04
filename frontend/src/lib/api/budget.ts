// Budget API services
import { fetchWithBranchContext } from '../branch-api';
import { PYTHON_API_URL } from '../config';

export interface Budget {
  id: string;
  name: string;
  category: string;
  period: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  percentage_used: number;
  start_date: string;
  end_date: string;
  fiscal_year: string;
  fiscal_month?: string;
  status: string;
  budget_status: string;
  branch_id: string;
  branch_name?: string;
  department_id?: string;
  department_name?: string;
  created_at: string;
  description?: string;
}

// API Response interfaces
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
}

export interface BudgetSummary {
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  usage_percentage: number;
  category_breakdown: {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
  }[];
  budgets: Budget[];
}

export interface BudgetVariance {
  summary: {
    total_allocated: number;
    total_spent: number;
    total_variance: number;
    average_variance_percentage: number;
  };
  category_variance: {
    category: string;
    allocated: number;
    spent: number;
    variance: number;
    variance_percentage: number;
    variance_category: string;
  }[];
  variance_items: {
    name: string;
    category: string;
    allocated: number;
    spent: number;
    variance: number;
    variance_percentage: number;
    variance_category: string;
  }[];
  plot?: string;
}

export interface BudgetPerformance {
  overall: {
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: string;
  };
  categories: {
    category: string;
    allocated: number;
    spent: number;
    remaining: number;
    percentage: number;
    status: string;
  }[];
  monthly: {
    month: string;
    allocated: number;
    spent: number;
    percentage: number;
  }[];
  fiscal_year?: string;
}

export interface BudgetForecast {
  category: string;
  forecast_generated_at: string;
  forecasts: {
    method: string;
    periods: number;
    forecast: {
      period: string;
      amount: number;
      lower_bound: number;
      upper_bound: number;
    }[];
  };
  plots?: {
    time_series?: string;
  };
}

export interface BudgetRecommendations {
  recommendations: {
    category: string;
    current_allocated: number;
    current_spent: number;
    current_remaining: number;
    usage_percentage: number;
    recommendation_type: string;
    recommended_adjustment: number;
    rationale: string;
    priority: string;
  }[];
  summary: {
    total_current_allocated: number;
    total_recommended_adjustments: number;
    high_priority_count: number;
    generated_at: string;
  };
}

export interface BudgetExpense {
  id: string;
  reference: string;
  description: string;
  amount: number;
  category: string;
  payment_method: string;
  date: string;
  status: string;
  created_by: string;
  approved_by?: string;
  receipt_url?: string;
}

export interface BudgetDetail {
  budget: Budget;
  expenses: BudgetExpense[];
  adjustments: {
    id: string;
    previous_amount: number;
    new_amount: number;
    adjustment_amount: number;
    reason: string;
    adjusted_by: string;
    approved_by?: string;
    created_at: string;
    users: {
      name: string;
    };
  }[];
}

// API functions
export const budgetAPI = {
  // Backend API calls
  getBudgets: (params?: {
    category?: string;
    period?: string;
    status?: string;
    fiscal_year?: string;
  }, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (params?.category) queryParams.append('category', params.category);
    if (params?.period) queryParams.append('period', params.period);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.fiscal_year) queryParams.append('fiscal_year', params.fiscal_year);

    return fetchWithBranchContext<Budget[]>(
      `/api/branch-operations/finances/budgets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      {},
      branchId
    );
  },

  getBudgetById: (id: string, branchId?: number) => {
    return fetchWithBranchContext<BudgetDetail>(
      `/api/branch-operations/finances/budgets/${id}`,
      {},
      branchId
    );
  },

  createBudget: (data: any, branchId?: number) => {
    return fetchWithBranchContext<Budget>(
      `/api/branch-operations/finances/budgets`,
      {
        method: 'POST',
        body: JSON.stringify(data)
      },
      branchId
    );
  },

  updateBudget: (id: string, data: any, branchId?: number) => {
    return fetchWithBranchContext<Budget>(
      `/api/branch-operations/finances/budgets/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data)
      },
      branchId
    );
  },

  deleteBudget: (id: string, branchId?: number) => {
    return fetchWithBranchContext(
      `/api/branch-operations/finances/budgets/${id}`,
      {
        method: 'DELETE'
      },
      branchId
    );
  },

  linkExpenseToBudget: (budgetId: string, expenseId: string, amount: number, branchId?: number) => {
    return fetchWithBranchContext(
      `/api/branch-operations/finances/budgets/${budgetId}/expenses`,
      {
        method: 'POST',
        body: JSON.stringify({ expense_id: expenseId, amount })
      },
      branchId
    );
  },

  getBudgetSummary: (fiscalYear?: string, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (fiscalYear) queryParams.append('fiscal_year', fiscalYear);

    return fetchWithBranchContext<BudgetSummary>(
      `/api/branch-operations/finances/budget-summary${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      {},
      branchId
    );
  },

  getBudgetAnalysis: (params?: {
    period?: string;
    fiscal_year?: string;
    fiscal_month?: string;
  }, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (params?.period) queryParams.append('period', params.period);
    if (params?.fiscal_year) queryParams.append('fiscal_year', params.fiscal_year);
    if (params?.fiscal_month) queryParams.append('fiscal_month', params.fiscal_month);

    return fetchWithBranchContext<Budget[]>(
      `/api/branch-operations/finances/budget-analysis${queryParams.toString() ? `?${queryParams.toString()}` : ''}`,
      {},
      branchId
    );
  },

  // Python microservice calls
  getBudgetPerformance: (fiscalYear?: string, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (fiscalYear) queryParams.append('fiscal_year', fiscalYear);
    if (branchId) queryParams.append('branch_id', branchId.toString());

    return fetch(`${PYTHON_API_URL}/api/budget/performance?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json());
  },

  getBudgetForecast: (params?: {
    category?: string;
    periods?: number;
  }, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (branchId) queryParams.append('branch_id', branchId.toString());
    if (params?.category) queryParams.append('category', params.category);
    if (params?.periods) queryParams.append('periods', params.periods.toString());

    return fetch(`${PYTHON_API_URL}/api/budget/forecast?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json());
  },

  getBudgetVariance: (fiscalYear?: string, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (fiscalYear) queryParams.append('fiscal_year', fiscalYear);
    if (branchId) queryParams.append('branch_id', branchId.toString());

    return fetch(`${PYTHON_API_URL}/api/budget/variance?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json());
  },

  getBudgetRecommendations: (fiscalYear?: string, branchId?: number) => {
    const queryParams = new URLSearchParams();

    if (fiscalYear) queryParams.append('fiscal_year', fiscalYear);
    if (branchId) queryParams.append('branch_id', branchId.toString());

    return fetch(`${PYTHON_API_URL}/api/budget/recommendations?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    }).then(response => response.json());
  }
};
