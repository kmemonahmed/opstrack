"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, BriefcaseBusiness, ClipboardList, ShieldCheck, Users, Wrench } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import type { Asset, Client, ClientContact, TeamMember, WorkOrderListItem, WorkOrderSummary } from "@/lib/types";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingBlock } from "@/components/ui/loading";
import { ResourceList, dateColumn, type FieldConfig } from "@/components/screens/resource-list";
import { formatDate, titleCase } from "@/lib/utils";

const activeOptions = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const statusOptions = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "OVERDUE"].map((value) => ({
  value,
  label: titleCase(value),
}));

const technicianStatusOptions = ["ASSIGNED", "IN_PROGRESS", "ON_HOLD", "OVERDUE", "COMPLETED"].map((value) => ({
  value,
  label: titleCase(value),
}));

const priorityOptions = ["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => ({ value, label: titleCase(value) }));

export function DashboardPage() {
  const auth = useAuth();
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: api.dashboardSummary });
  const daily = useQuery({ queryKey: ["daily-summary"], queryFn: () => api.dailyWorkOrderSummary({}) });
  const workOrderSummary = useQuery({ queryKey: ["work-order-summary"], queryFn: () => api.workOrderSummary({}) });

  if (summary.isLoading) return <LoadingBlock label="Loading dashboard" />;

  const roleView =
    auth.role === "OWNER"
      ? {
          label: "Owner command center",
          title: "Business-wide service performance",
          copy: "Track client coverage, team capacity, workload health, and operational risk across the active workspace.",
        }
      : auth.role === "ADMIN"
        ? {
            label: "Admin command center",
            title: "Workspace operations and controls",
            copy: "Monitor service activity, team access, client records, and reporting signals from one controlled workspace.",
          }
        : {
            label: "Manager command center",
            title: "Daily service operations",
            copy: "Follow open work, technician assignments, overdue risk, and client-facing workflow updates in real time.",
          };

  const cards = [
    { label: "Active clients", value: summary.data?.total_clients ?? 0, icon: Users, hint: "accounts under management" },
    { label: "Service assets", value: summary.data?.total_assets ?? 0, icon: Wrench, hint: "tracked equipment records" },
    { label: "Work orders", value: summary.data?.total_work_orders ?? 0, icon: ClipboardList, hint: "lifecycle items created" },
    { label: "Team members", value: summary.data?.total_team_members ?? 0, icon: BriefcaseBusiness, hint: "active workspace users" },
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-xl border border-[#d7e3e7] bg-[#102027] text-white shadow-xl shadow-slate-950/10">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9bcbd4]">{roleView.label}</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight">{roleView.title}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#d7eef2]">
              {roleView.copy}
            </p>
          </div>
          <div className="grid min-w-64 gap-3">
            <div className="rounded-lg border border-white/10 bg-white/8 p-4">
              <div className="flex items-center gap-2 text-[#9bcbd4]">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.14em]">Tenant protected</span>
              </div>
              <p className="mt-2 text-sm text-[#d7eef2]">Organization data stays scoped to the active workspace.</p>
            </div>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label} className="premium-panel border-[#d7e3e7]">
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight">{card.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{card.hint}</p>
                </div>
                <div className="rounded-lg bg-[#e4f3f5] p-3 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Card className="premium-panel border-[#d7e3e7]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">Daily service volume</h3>
            </div>
          </CardHeader>
          <CardContent className="min-h-80 min-w-0">
            <ResponsiveContainer width="100%" height={320} minWidth={0}>
              <BarChart data={(daily.data?.results ?? []).slice(0, 14).reverse()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Bar dataKey="total_work_orders" fill="#126e82" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="premium-panel border-[#d7e3e7]">
          <CardHeader>
            <h3 className="font-semibold">Work order health</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              ["Open", summary.data?.open_work_orders ?? 0],
              ["Assigned", summary.data?.assigned_work_orders ?? 0],
              ["In progress", summary.data?.in_progress_work_orders ?? 0],
              ["Overdue", summary.data?.overdue_work_orders ?? 0],
              ["Unread notifications", summary.data?.unread_notifications ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between rounded-md border border-border bg-[#fbfcfd] p-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <DashboardReports summary={workOrderSummary.data} isLoading={workOrderSummary.isLoading} />
    </div>
  );
}

export function ClientsPage() {
  return (
    <ResourceList<Client>
      title="Clients"
      description="Keep customer accounts organized with clear ownership, contact details, and active service history."
      actionLabel="Add client"
      queryKey="clients"
      list={api.listClients}
      create={api.createClient}
      update={api.updateClient}
      remove={api.deleteClient}
      searchPlaceholder="Search name, email, phone, industry"
      filters={[{ name: "is_active", label: "Status", options: activeOptions }]}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "email", label: "Email", type: "email" },
        { name: "phone", label: "Phone" },
        { name: "industry", label: "Industry" },
        { name: "address", label: "Address", type: "textarea" },
        { name: "notes", label: "Notes", type: "textarea" },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      getInitialValues={(row) => ({ is_active: true, ...row })}
      columns={[
        { header: "Name", value: (row) => row.name },
        { header: "Industry", value: (row) => row.industry || <span className="text-muted-foreground">Not provided</span> },
        { header: "Email", value: (row) => row.email || <span className="text-muted-foreground">Not provided</span> },
        { header: "Status", value: (row) => <Badge value={row.is_active} /> },
        { header: "Created", value: (row) => dateColumn(row.created_at) },
      ]}
      details={[
        { label: "Client name", value: (row) => row.name },
        { label: "Status", value: (row) => <Badge value={row.is_active} /> },
        { label: "Industry", value: (row) => row.industry },
        { label: "Email", value: (row) => row.email },
        { label: "Phone", value: (row) => row.phone },
        { label: "Created", value: (row) => formatDate(row.created_at) },
        { label: "Address", value: (row) => row.address, wide: true },
        { label: "Notes", value: (row) => row.notes, wide: true },
        { label: "Last updated", value: (row) => formatDate(row.updated_at) },
      ]}
    />
  );
}

export function ContactsPage() {
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.listClients({ page: 1 }) });
  const clientOptions = (clients.data?.results ?? []).map((client) => ({ value: client.id, label: client.name }));

  return (
    <ResourceList<ClientContact>
      title="Client Contacts"
      description="Control who can request service, receive updates, and access the client portal."
      actionLabel="Add contact"
      queryKey="contacts"
      list={api.listContacts}
      create={api.createContact}
      update={api.updateContact}
      remove={api.deleteContact}
      searchPlaceholder="Search contact, email, phone, client"
      filters={[
        { name: "client", label: "Client", options: clientOptions },
        { name: "is_active", label: "Status", options: activeOptions },
        { name: "can_login", label: "Portal", options: activeOptions },
      ]}
      fields={[
        { name: "client", label: "Client", type: "select", options: clientOptions, required: true, createOnly: true },
        { name: "full_name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true },
        { name: "phone", label: "Phone" },
        { name: "position", label: "Position" },
        { name: "is_primary", label: "Primary", type: "checkbox" },
        { name: "can_login", label: "Portal login", type: "checkbox" },
        { name: "password", label: "Password", type: "password", createOnly: true },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      getInitialValues={(row) => ({
        is_active: true,
        can_login: false,
        is_primary: false,
        ...row,
        client: row?.client.id,
      })}
      columns={[
        { header: "Name", value: (row) => row.full_name },
        { header: "Client", value: (row) => row.client.name },
        { header: "Email", value: (row) => row.email },
        { header: "Portal", value: (row) => <Badge value={row.can_login ? "Enabled" : "Disabled"} /> },
        { header: "Status", value: (row) => <Badge value={row.is_active} /> },
      ]}
      details={[
        { label: "Contact name", value: (row) => row.full_name },
        { label: "Client", value: (row) => row.client.name },
        { label: "Position", value: (row) => row.position },
        { label: "Email", value: (row) => row.email },
        { label: "Phone", value: (row) => row.phone },
        { label: "Primary contact", value: (row) => <Badge value={row.is_primary ? "Yes" : "No"} /> },
        { label: "Portal access", value: (row) => <Badge value={row.can_login ? "Enabled" : "Disabled"} /> },
        { label: "Status", value: (row) => <Badge value={row.is_active} /> },
        { label: "Linked user", value: (row) => row.user?.email },
        { label: "Created", value: (row) => formatDate(row.created_at) },
        { label: "Last updated", value: (row) => formatDate(row.updated_at) },
      ]}
    />
  );
}

export function AssetsPage() {
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.listClients({ page: 1 }) });
  const clientOptions = (clients.data?.results ?? []).map((client) => ({ value: client.id, label: client.name }));

  return (
    <ResourceList<Asset>
      title="Assets"
      description="Maintain a service-ready asset register with serial numbers, locations, and lifecycle status."
      actionLabel="Add asset"
      queryKey="assets"
      list={api.listAssets}
      create={api.createAsset}
      update={api.updateAsset}
      remove={api.deleteAsset}
      searchPlaceholder="Search name, serial, type, location"
      filters={[
        { name: "client", label: "Client", options: clientOptions },
        {
          name: "status",
          label: "Status",
          options: ["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "RETIRED"].map((value) => ({ value, label: titleCase(value) })),
        },
      ]}
      fields={[
        { name: "client", label: "Client", type: "select", options: clientOptions, required: true },
        { name: "name", label: "Name", required: true },
        { name: "asset_type", label: "Asset type", required: true },
        { name: "serial_number", label: "Serial number", required: true },
        { name: "location", label: "Location" },
        {
          name: "status",
          label: "Status",
          type: "select",
          options: ["ACTIVE", "INACTIVE", "UNDER_MAINTENANCE", "RETIRED"].map((value) => ({ value, label: titleCase(value) })),
        },
        { name: "installed_at", label: "Installed at", type: "date" },
        { name: "last_service_date", label: "Last service date", type: "date" },
      ]}
      getInitialValues={(row) => ({ status: "ACTIVE", ...row, client: row?.client.id })}
      columns={[
        { header: "Name", value: (row) => row.name },
        { header: "Client", value: (row) => row.client.name },
        { header: "Serial", value: (row) => row.serial_number },
        { header: "Type", value: (row) => row.asset_type },
        { header: "Status", value: (row) => <Badge value={row.status} /> },
      ]}
      details={[
        { label: "Asset name", value: (row) => row.name },
        { label: "Client", value: (row) => row.client.name },
        { label: "Asset type", value: (row) => row.asset_type },
        { label: "Serial number", value: (row) => row.serial_number },
        { label: "Status", value: (row) => <Badge value={row.status} /> },
        { label: "Location", value: (row) => row.location },
        { label: "Installed", value: (row) => formatDate(row.installed_at) },
        { label: "Last service", value: (row) => formatDate(row.last_service_date) },
        { label: "Created", value: (row) => formatDate(row.created_at) },
        { label: "Last updated", value: (row) => formatDate(row.updated_at) },
      ]}
      destructiveLabel="Retire"
    />
  );
}

export function TeamPage() {
  const { canAdministerWorkspace } = useAuth();

  return (
    <ResourceList<TeamMember>
      title="Team"
      description="Assign the right level of access for managers, administrators, and technicians."
      actionLabel="Invite team member"
      queryKey="team"
      list={api.listTeam}
      create={canAdministerWorkspace ? api.createTeamMember : undefined}
      update={canAdministerWorkspace ? api.updateTeamMember : undefined}
      remove={canAdministerWorkspace ? api.deleteTeamMember : undefined}
      searchPlaceholder="Search name, email, phone"
      filters={[{ name: "role", label: "Role", options: ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"].map((value) => ({ value, label: titleCase(value) })) }]}
      fields={[
        { name: "full_name", label: "Full name", required: true },
        { name: "email", label: "Email", type: "email", required: true, createOnly: true },
        { name: "phone", label: "Phone" },
        {
          name: "role",
          label: "Role",
          type: "select",
          required: true,
          options: ["ADMIN", "MANAGER", "TECHNICIAN"].map((value) => ({ value, label: titleCase(value) })),
          editOptions: ["OWNER", "ADMIN", "MANAGER", "TECHNICIAN"].map((value) => ({ value, label: titleCase(value) })),
        },
        { name: "password", label: "Password", type: "password", createOnly: true },
        { name: "is_active", label: "Active", type: "checkbox" },
      ]}
      getInitialValues={(row) => ({
        is_active: true,
        role: "TECHNICIAN",
        full_name: row?.user.full_name,
        phone: row?.user.phone,
        ...row,
      })}
      columns={[
        { header: "Name", value: (row) => row.user.full_name },
        { header: "Email", value: (row) => row.user.email },
        { header: "Role", value: (row) => <Badge value={row.role} /> },
        { header: "Status", value: (row) => <Badge value={row.is_active} /> },
        { header: "Joined", value: (row) => dateColumn(row.joined_at) },
      ]}
      details={[
        { label: "Team member", value: (row) => row.user.full_name },
        { label: "Email", value: (row) => row.user.email },
        { label: "Phone", value: (row) => row.user.phone },
        { label: "Role", value: (row) => <Badge value={row.role} /> },
        { label: "Membership status", value: (row) => <Badge value={row.is_active} /> },
        { label: "User account", value: (row) => <Badge value={row.user.is_active ? "Active" : "Inactive"} /> },
        { label: "Joined", value: (row) => formatDate(row.joined_at) },
        { label: "Created", value: (row) => formatDate(row.created_at) },
        { label: "Last updated", value: (row) => formatDate(row.updated_at) },
      ]}
      destructiveLabel="Deactivate"
    />
  );
}

export function WorkOrdersPage({ portal = "company" }: { portal?: "company" | "technician" | "client" }) {
  const clients = useQuery({ queryKey: ["client-options"], queryFn: () => api.listClients({ page: 1 }), enabled: portal === "company" });
  const assets = useQuery({ queryKey: ["asset-options"], queryFn: () => api.listAssets({ page: 1 }), enabled: portal !== "technician" });
  const contacts = useQuery({ queryKey: ["contact-options"], queryFn: () => api.listContacts({ page: 1 }), enabled: portal === "company" });
  const clientOptions = (clients.data?.results ?? []).map((client) => ({ value: client.id, label: client.name }));
  const assetOptions = (assets.data?.results ?? []).map((asset) => ({ value: asset.id, label: `${asset.name} (${asset.serial_number})` }));
  const contactOptions = (contacts.data?.results ?? []).map((contact) => ({ value: contact.id, label: contact.full_name }));

  const list = portal === "technician" ? api.listTechnicianWorkOrders : portal === "client" ? api.listClientRequests : api.listWorkOrders;
  const create = portal === "client" ? api.createClientRequest : portal === "company" ? api.createWorkOrder : undefined;
  const hrefBase = portal === "technician" ? "/tech/work-orders" : portal === "client" ? "/client/requests" : "/app/work-orders";
  const filters =
    portal === "technician"
      ? [
          { name: "status", label: "Work state", options: technicianStatusOptions },
          { name: "priority", label: "Priority", options: priorityOptions },
        ]
      : [
          { name: "status", label: "Status", options: statusOptions },
          { name: "priority", label: "Priority", options: priorityOptions },
        ];
  const columns = [
    { header: "Title", value: (row: WorkOrderListItem) => row.title },
    { header: "Client", value: (row: WorkOrderListItem) => row.client?.name ?? "Client portal" },
    { header: "Asset", value: (row: WorkOrderListItem) => row.asset?.name ?? <span className="text-muted-foreground">No asset linked</span> },
    ...(portal === "company"
      ? [{ header: "Assigned to", value: (row: WorkOrderListItem) => row.assigned_to?.user.full_name ?? "Unassigned" }]
      : []),
    { header: "Priority", value: (row: WorkOrderListItem) => <Badge value={row.priority} /> },
    { header: "Status", value: (row: WorkOrderListItem) => <Badge value={row.status} /> },
    {
      header: "Due",
      value: (row: WorkOrderListItem) => (row.due_date ? formatDate(row.due_date) : "Not set"),
    },
  ];

  const fields: FieldConfig[] =
    portal === "client"
      ? [
          { name: "asset", label: "Asset", type: "select", options: assetOptions },
          { name: "title", label: "Title", required: true },
          { name: "description", label: "Description", type: "textarea", required: true },
          { name: "priority", label: "Priority", type: "select", options: priorityOptions },
        ]
      : [
          { name: "client", label: "Client", type: "select", options: clientOptions, required: true },
          { name: "asset", label: "Asset", type: "select", options: assetOptions },
          { name: "requested_by_contact", label: "Requested by", type: "select", options: contactOptions },
          { name: "title", label: "Title", required: true },
          { name: "description", label: "Description", type: "textarea", required: true },
          { name: "priority", label: "Priority", type: "select", options: priorityOptions },
          { name: "due_date", label: "Due date", type: "datetime-local" },
        ];

  return (
    <ResourceList<WorkOrderListItem>
      title={portal === "client" ? "Service Requests" : portal === "technician" ? "Assigned Work Orders" : "Work Orders"}
      description={
        portal === "client"
          ? "Submit requests, follow progress, and keep every service conversation in one place."
          : portal === "technician"
            ? "Active assigned work is prioritized by urgency, due date, and field progress."
            : "Plan, assign, update, and close service work with full client and asset context."
      }
      actionLabel={portal === "client" ? "Create request" : "Create work order"}
      queryKey={`${portal}-work-orders`}
      list={list}
      create={create}
      searchPlaceholder="Search title, description, client, asset"
      filters={filters}
      fields={fields}
      getInitialValues={() => ({ priority: "MEDIUM" })}
      getRowHref={(row) => `${hrefBase}/${row.id}`}
      columns={columns}
    />
  );
}

export function ReportsPage() {
  const summary = useQuery({ queryKey: ["work-order-summary"], queryFn: () => api.workOrderSummary({}) });
  if (summary.isLoading) return <LoadingBlock label="Loading reports" />;

  return <DashboardReports summary={summary.data} isLoading={summary.isLoading} standalone />;
}

function DashboardReports({
  summary,
  isLoading,
  standalone = false,
}: {
  summary?: WorkOrderSummary;
  isLoading: boolean;
  standalone?: boolean;
}) {
  if (isLoading) {
    return (
      <Card className="premium-panel border-[#d7e3e7]">
        <CardContent className="p-5">
          <LoadingBlock label="Loading report data" />
        </CardContent>
      </Card>
    );
  }

  const statusData = Object.entries(summary?.status_breakdown ?? {}).map(([name, value]) => ({ name: titleCase(name), value }));
  const priorityData = Object.entries(summary?.priority_breakdown ?? {}).map(([name, value]) => ({ name: titleCase(name), value }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className={standalone ? "text-2xl font-semibold tracking-tight" : "text-xl font-semibold tracking-tight"}>
          {standalone ? "Reports" : "Performance reports"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Work order counts by status, priority, assignment, and due date.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {[
          ["Total", summary?.total_work_orders],
          ["Assigned", summary?.assigned_work_orders],
          ["Unassigned", summary?.unassigned_work_orders],
          ["Due today", summary?.due_today_work_orders],
        ].map(([label, value]) => (
          <Card key={label} className="premium-panel border-[#d7e3e7]">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ReportChart title="Status breakdown" data={statusData} />
        <ReportChart title="Priority breakdown" data={priorityData} />
      </div>
    </div>
  );
}

function ReportChart({ title, data }: { title: string; data: Array<{ name: string; value: number }> }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{title}</h3>
        </div>
      </CardHeader>
      <CardContent className="min-h-80 min-w-0">
        <ResponsiveContainer width="100%" height={320} minWidth={0}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip />
            <Bar dataKey="value" fill="#126e82" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
