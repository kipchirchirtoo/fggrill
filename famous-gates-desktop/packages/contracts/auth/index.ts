// ── Auth / Session Contracts ──────────────────────────────────────────────────

export interface SessionContract {
  user_id: string;
  email: string;
  role: string;
  branch_id?: string;
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface RolePermissions {
  role: string;
  allowed_routes: string[];
  can_export: boolean;
  can_manage_users: boolean;
  can_view_financials: boolean;
}
