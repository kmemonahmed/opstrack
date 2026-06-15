from apps.notifications.models import Notification
from apps.organizations.models import OrganizationMembership


LEADERSHIP_ROLES = [
    OrganizationMembership.Role.OWNER,
    OrganizationMembership.Role.ADMIN,
    OrganizationMembership.Role.MANAGER,
]


def create_notification(user, title, message, organization=None, work_order=None):
    """Create one notification for a user."""
    return Notification.objects.create(
        user=user,
        title=title,
        message=message,
        organization=organization,
        work_order=work_order,
    )


def _add_recipient(recipients_by_id, user, actor=None):
    if not user or not user.is_active:
        return

    if actor and actor.id == user.id:
        return

    recipients_by_id[user.id] = user


def _add_assigned_technician(recipients_by_id, work_order, actor=None):
    if work_order.assigned_to_id and work_order.assigned_to.user_id:
        _add_recipient(recipients_by_id, work_order.assigned_to.user, actor=actor)


def _add_organization_leaders(recipients_by_id, organization, actor=None):
    leadership_memberships = OrganizationMembership.objects.filter(
        organization=organization,
        is_active=True,
        user__is_active=True,
        role__in=LEADERSHIP_ROLES,
    ).select_related("user")

    for membership in leadership_memberships:
        _add_recipient(recipients_by_id, membership.user, actor=actor)


def _add_requesting_client_contact(recipients_by_id, work_order, actor=None):
    contact = work_order.requested_by_contact

    if contact and contact.user_id:
        _add_recipient(recipients_by_id, contact.user, actor=actor)


def _bulk_notify(recipients, title, message, organization=None, work_order=None):
    notifications = [
        Notification(
            user=user,
            title=title,
            message=message,
            organization=organization,
            work_order=work_order,
        )
        for user in recipients
    ]

    if notifications:
        Notification.objects.bulk_create(notifications)

    return len(notifications)


def notify_work_order_assigned(work_order, actor=None):
    """Notify the assigned technician and requesting client contact."""
    technician_recipients_by_id = {}
    client_recipients_by_id = {}
    _add_assigned_technician(technician_recipients_by_id, work_order, actor=actor)
    _add_requesting_client_contact(client_recipients_by_id, work_order, actor=actor)

    created_count = _bulk_notify(
        technician_recipients_by_id.values(),
        "New work order assigned",
        f'Work order "{work_order.title}" has been assigned to you.',
        organization=work_order.organization,
        work_order=work_order,
    )

    created_count += _bulk_notify(
        client_recipients_by_id.values(),
        "New technician assigned",
        f'A technician has been assigned to your service request "{work_order.title}".',
        organization=work_order.organization,
        work_order=work_order,
    )

    return created_count


def notify_work_order_status_changed(
    work_order,
    old_status,
    new_status,
    actor=None,
    is_internal=False,
):
    """Notify stakeholders when a work order status changes."""
    if old_status == new_status:
        return 0

    recipients_by_id = {}
    _add_assigned_technician(recipients_by_id, work_order, actor=actor)
    _add_organization_leaders(recipients_by_id, work_order.organization, actor=actor)

    if not is_internal:
        _add_requesting_client_contact(recipients_by_id, work_order, actor=actor)

    status_label = work_order.get_status_display()
    title = "Work order status updated"
    message = f'Work order "{work_order.title}" status changed to {status_label}.'

    return _bulk_notify(
        recipients_by_id.values(),
        title,
        message,
        organization=work_order.organization,
        work_order=work_order,
    )


def notify_client_request_created(work_order, actor=None):
    """Notify organization leaders about a new client service request."""
    recipients_by_id = {}
    _add_organization_leaders(recipients_by_id, work_order.organization, actor=actor)

    title = "New client service request"
    message = (
        f'{work_order.client.name} created service request "{work_order.title}".'
    )

    return _bulk_notify(
        recipients_by_id.values(),
        title,
        message,
        organization=work_order.organization,
        work_order=work_order,
    )


def notify_client_comment_added(work_order, actor=None):
    """Notify internal stakeholders when a client adds a public comment."""
    recipients_by_id = {}
    _add_organization_leaders(recipients_by_id, work_order.organization, actor=actor)
    _add_assigned_technician(recipients_by_id, work_order, actor=actor)

    title = "New client comment"
    message = f'New client comment added to work order "{work_order.title}".'

    return _bulk_notify(
        recipients_by_id.values(),
        title,
        message,
        organization=work_order.organization,
        work_order=work_order,
    )


def notify_public_work_order_update_added(work_order, actor=None, is_internal=False):
    """Notify stakeholders about a company-side work order update."""
    recipients_by_id = {}
    _add_organization_leaders(recipients_by_id, work_order.organization, actor=actor)
    _add_assigned_technician(recipients_by_id, work_order, actor=actor)

    if not is_internal:
        _add_requesting_client_contact(recipients_by_id, work_order, actor=actor)

    title = "New work order update"
    message = f'New update added to work order "{work_order.title}".'

    return _bulk_notify(
        recipients_by_id.values(),
        title,
        message,
        organization=work_order.organization,
        work_order=work_order,
    )


def notify_work_order_overdue(work_order):
    """Notify the assigned technician and active organization leaders."""
    recipients_by_id = {}
    _add_assigned_technician(recipients_by_id, work_order)
    _add_organization_leaders(recipients_by_id, work_order.organization)

    title = "Work order overdue"
    message = f'Work order "{work_order.title}" is now overdue.'

    return _bulk_notify(
        recipients_by_id.values(),
        title,
        message,
        organization=work_order.organization,
        work_order=work_order,
    )
