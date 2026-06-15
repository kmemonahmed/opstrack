# Maintolio User Manual

Version: Public v1

Maintolio is a multi-tenant service operations platform for managing clients, assets, work orders, technicians, service requests, notifications, and operational reports.

This manual explains how to use the v1 application from the perspective of company users, technicians, and client contacts.

## User Roles

Maintolio supports five user types:

| Role | Main purpose |
| --- | --- |
| OWNER | Full workspace control, team administration, operations, and reports |
| ADMIN | Administrative access to team, clients, assets, work orders, and reports |
| MANAGER | Day-to-day service operations, clients, assets, work orders, assignments, and reports |
| TECHNICIAN | Assigned work order execution through the technician portal |
| Client Contact | Client portal access for creating and tracking service requests |

Platform superusers are for Django administration only and are not allowed to use the Maintolio frontend portal.

## Signing In

1. Open the Maintolio frontend URL.
2. Enter your email and password.
3. Select **Open workspace**.
4. Maintolio redirects you to the correct area based on your role:
   - Company users go to the company dashboard.
   - Technicians go to assigned work orders.
   - Client contacts go to service requests.

Demo credentials after seeding demo data:

```text
owner@techcare.test / Test@12345
admin@techcare.test / Test@12345
manager@techcare.test / Test@12345
technician1@techcare.test / Test@12345
technician2@techcare.test / Test@12345
rahim@abchospital.test / Test@12345
```

## Navigation

The left navigation changes by role.

Company users can access:

- Dashboard
- Work Orders
- Clients
- Contacts
- Assets
- Team
- Profile

Technicians can access:

- Assigned Work
- Profile

Client contacts can access:

- Requests
- Profile

The notification bell is available globally in the top bar. It shows unread notification count and opens the notifications page for the current portal.

## Dashboard

The dashboard is available to company users.

It shows:

- Active client count
- Service asset count
- Work order count
- Team member count
- Daily service volume
- Work order health
- Performance reports

Dashboard data is scoped to the signed-in user's organization.

## Clients

Company users can manage client accounts from **Clients**.

Common actions:

1. Select **Add client**.
2. Enter client name and optional details such as email, phone, industry, address, and notes.
3. Save the client.
4. Use search, filters, and pagination to find records.
5. Use the action icons to view details, edit, or deactivate a client.

Deactivation keeps historical records intact while marking the client inactive.

## Client Contacts

Company users can manage client contacts from **Contacts**.

Contacts represent people at a client organization. A contact may optionally have portal login access.

Common fields:

- Client
- Full name
- Email
- Phone
- Position
- Primary contact
- Portal login
- Status

If **Portal login** is enabled and a password is provided during creation, the contact can sign in to the client portal.

## Assets

Company users can manage client-owned assets from **Assets**.

Common fields:

- Client
- Name
- Asset type
- Serial number
- Location
- Status
- Installed date
- Last service date

Assets can be linked to work orders so service history stays connected to equipment records.

## Team

OWNER and ADMIN users can manage team members from **Team**.

Supported team roles:

- ADMIN
- MANAGER
- TECHNICIAN

Team actions:

- Invite/create a team member
- Edit name, phone, role, and status
- Deactivate a team member
- View full team member details

Managers may have limited or read-only team access depending on backend permissions.

## Work Orders

Company users use **Work Orders** to create, assign, update, and track service work.

### Create a Work Order

1. Open **Work Orders**.
2. Select **Create work order**.
3. Choose a client.
4. Optionally choose an asset and requesting contact.
5. Enter title, description, priority, and optional due date.
6. Save the work order.

New work orders start as `OPEN`.

### Assign a Technician

1. Open a work order detail page.
2. In **Technician assignment**, choose a technician.
3. Select **Assign technician** or **Change technician**.

When a technician is assigned:

- The technician receives a notification.
- The linked client contact receives a client-facing notification if the request has one.
- The work order status becomes `ASSIGNED`.

### Change Status

Use **Progress control** on the work order detail page.

Supported status flow:

```text
OPEN -> ASSIGNED -> IN_PROGRESS -> ON_HOLD -> IN_PROGRESS -> COMPLETED
```

Work orders may also become:

- `CANCELLED`
- `OVERDUE`

Maintolio prevents moving an open work order to `ASSIGNED` unless a technician is actually assigned.

### Cancel or Reopen

Cancelled work orders hide actions that no longer make sense, such as technician assignment and attachment upload.

Company users can reopen a cancelled work order by entering a reason. The reason is saved to the activity history.

### Edit Details

Authorized company users can update:

- Description
- Due date

Maintolio records readable audit activity showing what changed from the old value to the new value.

### Add Updates

Company users and technicians can add updates to a work order.

Updates can be:

- Public: visible to relevant users and client contacts.
- Internal: visible only to company-side users and technicians.

Internal updates do not notify or appear to client contacts.

### Attachments

Authorized users can upload one or more attachments from the work order detail page.

Attachments are listed on the same detail page and can be opened from the attachment list.

## Technician Portal

Technicians use **Assigned Work**.

Technicians can:

- View only work orders assigned to them.
- Open assigned work order details.
- Change allowed statuses.
- Add updates.
- Upload/list attachments when the work order is not closed.

Technicians cannot browse all company work orders.

## Client Portal

Client contacts use **Requests**.

Client contacts can:

- Create service requests.
- View their own client's requests.
- Open request details.
- Add public comments.
- Upload/list attachments.
- View public activity updates.

Client contacts cannot see:

- Internal updates.
- Other clients' requests.
- Company team management, reports, or internal work order controls.

## Notifications

Notifications appear in the global bell icon and notifications page.

Unread count refreshes automatically every 30 seconds.

Opening a notification from the notifications page marks it as read.

Typical notification events:

- Technician assigned to a work order
- Work order status updated
- New client service request
- New client comment
- New public work order update
- Work order overdue

Notification titles are audience-specific where needed. For example, a technician assignment appears to technicians as **New work order assigned**, while the client contact sees **New technician assigned**.

## Reports

Company users can view report data from the dashboard.

Reports include:

- Work order totals
- Assignment counts
- Due today count
- Status breakdown
- Priority breakdown
- Daily work order summary

Reports are scoped to the current organization.

## Profile

All users can open **Profile**.

Profile actions:

- View name, email, role, organization/client, date joined, and last updated date.
- Edit profile name.
- Upload or remove profile image.
- Change password from the password modal.

## Search, Filters, and Pagination

Main list pages support:

- Search
- Filters
- Pagination

The v1 default page size is 10 records per page.

Use **Previous** and **Next** controls at the bottom of list tables.

## Recommended Demo Flow

For a complete demo:

1. Sign in as owner.
2. Review dashboard.
3. Create or inspect clients, contacts, and assets.
4. Create a work order.
5. Assign a technician.
6. Sign out and sign in as the technician.
7. Open assigned work and add an update.
8. Sign out and sign in as the client contact.
9. Review request updates and add a client comment.
10. Sign back in as manager or owner and review notifications/activity.

## Troubleshooting

### I cannot sign in

Confirm the email and password are correct. If using demo data, run the seed command again in the backend environment.

### I see fewer menu items than another user

Menus are role-aware. Technicians and client contacts intentionally see fewer options than company managers, admins, or owners.

### I cannot edit or delete something

Your role may not have permission, or the record may be closed/cancelled.

### I cannot see another organization's data

That is expected. Maintolio enforces tenant isolation between organizations.

### A client cannot see an update

The update may be internal. Internal updates are intentionally hidden from the client portal.

### Notification count does not update instantly

The notification badge refreshes every 30 seconds. Opening the notifications page or marking notifications read/unread also refreshes the count.
