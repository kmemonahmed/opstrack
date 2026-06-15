import environ
import os
from celery.schedules import crontab
from pathlib import Path
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False)
)

environ.Env.read_env(os.path.join(BASE_DIR, '.env'))


SECRET_KEY = env('SECRET_KEY')

DEBUG = env('DEBUG')

ALLOWED_HOSTS = env('ALLOWED_HOSTS').split(',')


# Application definition
INSTALLED_APPS = [
    # Django apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    "rest_framework_simplejwt",
    'drf_spectacular',
    "django_filters",
    "rest_framework_simplejwt.token_blacklist",
    "django_celery_beat",

    # Local apps
    'apps.accounts',
    'apps.assets',
    'apps.clients',
    'apps.core',
    'apps.organizations',
    'apps.notifications',
    'apps.reports',
    'apps.workorders'
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'


# Database
DATABASES = {
    'default': {
        'ENGINE': env('DB_ENGINE'),
        'NAME': env('DB_NAME'),
        'USER': env('DB_USER'),
        'PASSWORD': env('DB_PASSWORD'),
        'HOST': env('DB_HOST'),
        'PORT': env('DB_PORT'),
    }
}


# Internationalization
LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Celery
CELERY_BROKER_URL = env(
    "CELERY_BROKER_URL",
    default="amqp://guest:guest@rabbitmq:5672//",
)
CELERY_RESULT_BACKEND = env(
    "CELERY_RESULT_BACKEND",
    default="redis://redis:6379/0",
)
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BEAT_SCHEDULE = {
    "mark-overdue-work-orders-every-15-minutes": {
        "task": "apps.workorders.tasks.mark_overdue_work_orders",
        "schedule": crontab(minute="*/15"),
    },
    "generate-daily-work-order-summaries": {
        "task": "apps.reports.tasks.generate_daily_work_order_summaries",
        "schedule": crontab(minute=10, hour=0),
    },
}


# Cache
REDIS_CACHE_URL = env("REDIS_CACHE_URL", default="redis://redis:6379/1")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
    }
}


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Custom User Model
AUTH_USER_MODEL = "accounts.User"

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
}

# Spectacular
SPECTACULAR_SETTINGS = {
    "TITLE": "Maintolio API",
    "DESCRIPTION": "Multi-tenant work order and asset management SaaS API.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,

    "COMPONENT_SPLIT_REQUEST": True,

    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": False,
    },

    "ENUM_NAME_OVERRIDES": {
        "AssetStatusEnum": [
            ("ACTIVE", "Active"),
            ("INACTIVE", "Inactive"),
            ("UNDER_MAINTENANCE", "Under Maintenance"),
            ("RETIRED", "Retired"),
        ],
        "AttachmentFileTypeEnum": [
            ("IMAGE", "Image"),
            ("DOCUMENT", "Document"),
            ("OTHER", "Other"),
        ],
        "OrganizationMembershipRoleEnum": [
            ("OWNER", "Owner"),
            ("ADMIN", "Admin"),
            ("MANAGER", "Manager"),
            ("TECHNICIAN", "Technician"),
        ],
        "TeamMemberAssignableRoleEnum": [
            ("ADMIN", "Admin"),
            ("MANAGER", "Manager"),
            ("TECHNICIAN", "Technician"),
        ],
        "WorkOrderPriorityEnum": [
            ("LOW", "Low"),
            ("MEDIUM", "Medium"),
            ("HIGH", "High"),
            ("URGENT", "Urgent"),
        ],
        "WorkOrderStatusEnum": [
            ("OPEN", "Open"),
            ("ASSIGNED", "Assigned"),
            ("IN_PROGRESS", "In Progress"),
            ("ON_HOLD", "On Hold"),
            ("COMPLETED", "Completed"),
            ("CANCELLED", "Cancelled"),
            ("OVERDUE", "Overdue"),
        ],
    },

    "TAGS": [
        {"name": "Auth", "description": "Registration, login, current user, and password APIs"},
        {"name": "Organizations", "description": "Organization profile and tenant context"},
        {"name": "Team Members", "description": "Organization memberships and roles"},
        {"name": "Clients", "description": "Client businesses"},
        {"name": "Client Contacts", "description": "Client-side contacts and portal users"},
        {"name": "Assets", "description": "Client-owned assets and equipment"},
        {"name": "Work Orders", "description": "Service request and technician workflow"},
        {"name": "Technician Portal", "description": "Technician-specific assigned work order APIs"},
        {"name": "Client Portal", "description": "Client contact service request APIs"},
        {"name": "Notifications", "description": "User notification APIs"},
        {"name": "Reports", "description": "Dashboard and reporting endpoints"},
    ],
}


SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=120),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),

    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "CHECK_REVOKE_TOKEN": True,

    "AUTH_HEADER_TYPES": ("Bearer",),
}
