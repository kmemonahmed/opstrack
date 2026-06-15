# Maintolio Frontend

Unified role-aware frontend for the Maintolio DRF backend.

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form + Zod
- Recharts
- Sonner
- lucide-react

## Setup

From the repository root, start the backend first:

```bash
docker compose up --build
docker compose exec web python manage.py migrate
docker compose exec web python manage.py seed_demo_data
```

Then start the frontend:

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

The frontend expects the backend at:

```text
MAINTOLIO_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=
```

Local browser requests use the Next.js `/api/*` rewrite proxy by default, so the Django backend does not need CORS enabled for local development.

Open:

```text
http://127.0.0.1:3000
```

## Environment

Local development normally uses the Next.js rewrite proxy:

```env
MAINTOLIO_BACKEND_URL=http://127.0.0.1:8000
NEXT_PUBLIC_API_BASE_URL=
```

For a hosted frontend that calls a hosted API directly, set:

```env
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.example
```

## Demo Login

```text
owner@techcare.test / Test@12345
admin@techcare.test / Test@12345
manager@techcare.test / Test@12345
technician1@techcare.test / Test@12345
rahim@abchospital.test / Test@12345
```

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run test
npm run e2e
```

Modern frontend packages currently warn when Node is below `20.19.0`. Use Node `20.19+`, `22.13+`, or a current LTS if you want a warning-free install.

## Demo QA Checklist

- Login redirects correctly for owner/admin/manager, technician, and client contact.
- Owner/admin users can manage clients, contacts, assets, work orders, and team records.
- Manager users see only the actions allowed by backend permissions.
- Technician users see assigned work only.
- Client contacts see only their own service requests.
- Notification badge count updates and opening a notification marks it as read.
- Work order detail actions work on mobile: update, status change, assignment, attachments, and activity scroll.
- Tables, filters, dialogs, and profile menu remain usable at `390px`, `768px`, and desktop widths.
