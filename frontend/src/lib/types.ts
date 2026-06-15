export type Role = "OWNER" | "ADMIN" | "MANAGER" | "TECHNICIAN";
export type WorkOrderStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED"
  | "OVERDUE";
export type WorkOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

export type OrganizationMini = {
  id: string;
  name: string;
  slug: string;
};

export type Membership = {
  id: string;
  organization: OrganizationMini;
  role: Role;
  is_active: boolean;
};

export type ClientContactProfile = {
  id: string;
  client_id: string;
  client_name: string;
  organization_id: string;
  organization_name: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
  can_login: boolean;
};

export type Me = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  avatar: string | null;
  date_joined: string;
  created_at: string;
  updated_at: string;
  is_platform_admin: boolean;
  organization_memberships: Membership[];
  client_contact_profile: ClientContactProfile | null;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  industry: string;
  notes: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientContact = {
  id: string;
  client: Pick<Client, "id" | "name" | "email" | "phone" | "industry">;
  user: { id: string; email: string; full_name: string; phone: string; is_active: boolean } | null;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  is_primary: boolean;
  can_login: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Asset = {
  id: string;
  client: Pick<Client, "id" | "name" | "email" | "phone" | "industry">;
  name: string;
  asset_type: string;
  serial_number: string;
  location: string;
  status: "ACTIVE" | "INACTIVE" | "UNDER_MAINTENANCE" | "RETIRED";
  installed_at: string | null;
  last_service_date: string | null;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  user: { id: string; email: string; full_name: string; phone: string; is_active: boolean };
  role: Role;
  is_active: boolean;
  joined_at: string;
  created_at: string;
  updated_at: string;
};

export type WorkOrderListItem = {
  id: string;
  title: string;
  client?: Pick<Client, "id" | "name"> | null;
  asset?: Pick<Asset, "id" | "name"> | null;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  assigned_to?: { id: string; user: { full_name: string } } | null;
  due_date: string | null;
  is_overdue: boolean;
  created_at: string;
  completed_at: string | null;
};

export type WorkOrder = WorkOrderListItem & {
  description: string;
  created_by?: { id: string; email: string; full_name: string; phone: string } | null;
  requested_by_contact?: Pick<ClientContact, "id" | "full_name" | "email" | "phone" | "position"> | null;
  cancelled_at: string | null;
  updated_at: string;
};

export type WorkOrderUpdate = {
  id: string;
  user: { id: string; email: string; full_name: string; phone: string } | null;
  message: string;
  old_status: WorkOrderStatus;
  new_status: WorkOrderStatus;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  uploaded_by: { id: string; email: string; full_name: string; phone: string } | null;
  file: string;
  file_type: "IMAGE" | "DOCUMENT" | "OTHER";
  description: string;
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: string;
  organization: string;
  work_order: { id: string; title: string; status: WorkOrderStatus; priority: WorkOrderPriority } | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
};

export type DashboardSummary = {
  total_clients: number;
  total_assets: number;
  total_team_members: number;
  total_work_orders: number;
  open_work_orders: number;
  assigned_work_orders: number;
  in_progress_work_orders: number;
  on_hold_work_orders: number;
  completed_work_orders: number;
  cancelled_work_orders: number;
  overdue_work_orders: number;
  low_priority_work_orders: number;
  medium_priority_work_orders: number;
  high_priority_work_orders: number;
  urgent_priority_work_orders: number;
  unread_notifications: number;
};

export type WorkOrderSummary = {
  date_from: string | null;
  date_to: string | null;
  total_work_orders: number;
  assigned_work_orders: number;
  unassigned_work_orders: number;
  overdue_work_orders: number;
  due_today_work_orders: number;
  status_breakdown: Record<WorkOrderStatus, number>;
  priority_breakdown: Record<WorkOrderPriority, number>;
};

export type DailyWorkOrderSummary = {
  date_from: string | null;
  date_to: string | null;
  results: Array<{ date: string; total_work_orders: number; completed_work_orders: number; urgent_priority_work_orders: number }>;
};
