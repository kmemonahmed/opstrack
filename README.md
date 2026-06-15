# Maintolio

Maintolio is a multi-tenant B2B SaaS platform for service providers to manage clients, assets, work orders, technicians, service requests, notifications, and reports.

The backend is built with Django REST Framework and is designed around organization-level tenant isolation, role-based access control, technician workflows, client service requests, background jobs, and API-first integrations.

## Key Features

- Multi-tenant organization system
- Role-based access control
- Client and asset management
- Work order lifecycle management
- Technician portal APIs
- Client portal APIs
- Notifications API
- Reports and dashboard summaries
- Celery background tasks
- Dockerized local setup
- Swagger/OpenAPI API docs
- Role-aware Next.js frontend demo app

## Tech Stack

Backend:

- Python
- Django
- Django REST Framework
- PostgreSQL
- Redis
- RabbitMQ
- Celery
- Celery Beat
- SimpleJWT
- drf-spectacular
- Docker

Frontend:

- Next.js
- React
- TypeScript
- Tailwind CSS
- TanStack Query
- React Hook Form
- Zod
- Recharts

## Architecture Overview

Maintolio is organized into modular Django apps:

- `accounts`: custom user model, JWT auth, organization registration, profile, password, and logout APIs.
- `organizations`: organizations, memberships, tenant context, and team member management.
- `clients`: client businesses and client contacts, including client portal login contacts.
- `assets`: client-owned equipment and asset records.
- `workorders`: work order lifecycle, assignments, status changes, comments/updates, attachments, technician portal, and client portal request flows.
- `notifications`: in-app database notifications for users.
- `reports`: dashboard summaries, work order summaries, daily reports, and scheduled reporting tasks.

Tenant isolation is enforced through organization memberships and scoped querysets. Company users work inside an organization, while client contacts access only their own client's service requests.

## Roles

- `OWNER`: full organization control, team management, reports, and operational access.
- `ADMIN`: administrative access to team, clients, assets, work orders, and reports.
- `MANAGER`: operational access for clients, assets, work orders, assignments, and reports.
- `TECHNICIAN`: assigned work order access through technician workflows.
- `Client Contact`: client portal access for creating and tracking service requests.

## Main API Groups

- `/api/auth/`
- `/api/organizations/`
- `/api/team-members/`
- `/api/clients/`
- `/api/client-contacts/`
- `/api/assets/`
- `/api/work-orders/`
- `/api/technician/`
- `/api/client-portal/`
- `/api/notifications/`
- `/api/reports/`
- `/api/docs/`

## Local Setup With Docker

Create a local `.env` from the example:

```bash
cp .env.example .env
```

Start the stack:

```bash
docker compose up --build
```

In a second terminal, run migrations:

```bash
docker compose exec web python manage.py migrate
```

Seed demo data:

```bash
docker compose exec web python manage.py seed_demo_data
```

Create a superuser if needed:

```bash
docker compose exec web python manage.py createsuperuser
```

The API will be available at:

```text
http://127.0.0.1:8000/
```

## Running Tests

```bash
docker compose exec web python manage.py test
```

Or with the Makefile:

```bash
make test
```

## Celery Services

The Docker setup includes:

- `rabbitmq`: message broker for Celery.
- `redis`: Celery result backend and Django cache backend.
- `celery_worker`: executes background tasks.
- `celery_beat`: schedules periodic tasks with `django-celery-beat`.

Current background workflows include overdue work order processing and daily work order summary generation.

## Demo Credentials

After running `seed_demo_data`, these local demo-only accounts are available:

```text
owner@techcare.test / Test@12345
admin@techcare.test / Test@12345
manager@techcare.test / Test@12345
technician1@techcare.test / Test@12345
technician2@techcare.test / Test@12345
rahim@abchospital.test / Test@12345
```

## Environment Variables

Use `.env.example` as the template for local development. Do not commit real secrets.

Important values include:

- `SECRET_KEY`
- `DEBUG`
- `ALLOWED_HOSTS`
- `DB_ENGINE`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_HOST`
- `DB_PORT`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `REDIS_CACHE_URL`

## API Documentation

Swagger UI is available at:

```text
http://127.0.0.1:8000/api/docs/
```

The raw OpenAPI schema is available at:

```text
http://127.0.0.1:8000/api/schema/
```

## User Manual

The public v1 user manual is available at:

```text
docs/USER_MANUAL.md
```

## Project Status

Backend v1 is complete and a role-aware frontend demo app is available in `frontend/`.

## Roadmap

- Email notifications
- S3 file storage
- Production deployment on AWS
- Advanced analytics

## Frontend

A Next.js frontend lives in `frontend/`. It includes company, technician, and client portal routes in one role-aware app.

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

Open `http://127.0.0.1:3000` while the Django API is running on `http://127.0.0.1:8000`. The frontend proxies `/api/*` and `/media/*` to the backend during local development.

Useful frontend commands:

```bash
cd frontend
npm run lint
npm run build
npm run test
npm run e2e
```

Before sharing a demo link, test the main flows at desktop and mobile widths:

- Owner/admin/manager login and dashboard
- Technician assigned work order view
- Client contact request flow
- Work order assignment, status changes, updates, and attachments
- Notifications list, unread count, and mark-read navigation
