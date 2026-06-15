from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_helpers import (
    TEST_PASSWORD,
    create_asset,
    create_client,
    create_client_contact,
    create_member_user,
    create_organization,
    create_work_order,
    paginated_results,
)
from apps.notifications.models import Notification
from apps.organizations.models import OrganizationMembership
from apps.workorders.models import Attachment, WorkOrder, WorkOrderUpdate


class WorkOrderWorkflowTests(APITestCase):
    def setUp(self):
        self.org_a = create_organization("Work Orders Org A")
        self.org_b = create_organization("Work Orders Org B")
        self.manager, self.manager_membership = create_member_user(
            "wo-manager@example.com",
            self.org_a,
            OrganizationMembership.Role.MANAGER,
            "WO Manager",
        )
        self.tech, self.tech_membership = create_member_user(
            "wo-tech@example.com",
            self.org_a,
            OrganizationMembership.Role.TECHNICIAN,
            "WO Tech",
        )
        self.other_tech, self.other_tech_membership = create_member_user(
            "wo-other-tech@example.com",
            self.org_a,
            OrganizationMembership.Role.TECHNICIAN,
            "Other Tech",
        )
        self.user_b, _ = create_member_user(
            "wo-b@example.com",
            self.org_b,
            OrganizationMembership.Role.OWNER,
            "Other Owner",
        )
        self.client_a = create_client(self.org_a, "WO Client A")
        self.client_b = create_client(self.org_b, "WO Client B")
        self.asset_a = create_asset(self.client_a, "WO Pump", "WO-A-SN")
        self.asset_b = create_asset(self.client_b, "WO Other Pump", "WO-B-SN")
        self.work_order_a = create_work_order(
            self.org_a,
            self.client_a,
            title="Repair pump",
            asset=self.asset_a,
            created_by=self.manager,
        )
        self.work_order_b = create_work_order(
            self.org_b,
            self.client_b,
            title="Other org work",
            asset=self.asset_b,
            created_by=self.user_b,
        )

    def test_manager_can_create_work_order(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            "/api/work-orders/",
            {
                "client": str(self.client_a.id),
                "asset": str(self.asset_a.id),
                "title": "New repair",
                "description": "Fix the line.",
                "priority": WorkOrder.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WorkOrder.objects.filter(
                organization=self.org_a,
                title="New repair",
            ).exists()
        )

    def test_technician_cannot_create_company_side_work_order(self):
        self.client.force_authenticate(user=self.tech)

        response = self.client.post(
            "/api/work-orders/",
            {
                "client": str(self.client_a.id),
                "title": "Blocked repair",
                "description": "Should not be created.",
                "priority": WorkOrder.Priority.LOW,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_work_order_tenant_isolation_for_list_retrieve_update_delete(self):
        self.client.force_authenticate(user=self.manager)

        list_response = self.client.get("/api/work-orders/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in paginated_results(list_response)}
        self.assertIn(str(self.work_order_a.id), ids)
        self.assertNotIn(str(self.work_order_b.id), ids)

        retrieve_response = self.client.get(f"/api/work-orders/{self.work_order_b.id}/")
        self.assertEqual(retrieve_response.status_code, status.HTTP_404_NOT_FOUND)

        update_response = self.client.patch(
            f"/api/work-orders/{self.work_order_b.id}/",
            {"title": "Should Not Update"},
            format="json",
        )
        self.assertEqual(update_response.status_code, status.HTTP_404_NOT_FOUND)

        delete_response = self.client.delete(f"/api/work-orders/{self.work_order_b.id}/")
        self.assertEqual(delete_response.status_code, status.HTTP_404_NOT_FOUND)
        self.work_order_b.refresh_from_db()
        self.assertNotEqual(self.work_order_b.status, WorkOrder.Status.CANCELLED)

    def test_work_order_create_rejects_other_tenant_client(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            "/api/work-orders/",
            {
                "client": str(self.client_b.id),
                "title": "Wrong tenant work",
                "description": "Nope.",
                "priority": WorkOrder.Priority.MEDIUM,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_work_order_detail_update_creates_audit_record(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.patch(
            f"/api/work-orders/{self.work_order_a.id}/",
            {
                "description": "Updated technician instructions.",
                "due_date": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                message__contains='Work order description updated from "Investigate and repair." to "Updated technician instructions."',
                is_internal=True,
            ).exists()
        )

    def test_cancel_work_order_creates_status_notifications(self):
        admin, _ = create_member_user(
            "wo-admin@example.com",
            self.org_a,
            OrganizationMembership.Role.ADMIN,
            "WO Admin",
        )
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.status = WorkOrder.Status.ASSIGNED
        self.work_order_a.save(update_fields=["assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.delete(f"/api/work-orders/{self.work_order_a.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.work_order_a.refresh_from_db()
        self.assertEqual(self.work_order_a.status, WorkOrder.Status.CANCELLED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tech,
                work_order=self.work_order_a,
                title="Work order status updated",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=admin,
                work_order=self.work_order_a,
                title="Work order status updated",
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                user=self.manager,
                work_order=self.work_order_a,
                title="Work order status updated",
            ).exists()
        )
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                old_status=WorkOrder.Status.ASSIGNED,
                new_status=WorkOrder.Status.CANCELLED,
                message="Work order cancelled.",
            ).exists()
        )

    def test_manager_can_assign_technician(self):
        contact = create_client_contact(
            self.client_a,
            email="assignment-contact@example.com",
            full_name="Assignment Contact",
            can_login=True,
        )
        self.work_order_a.requested_by_contact = contact
        self.work_order_a.save(update_fields=["requested_by_contact", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/assign/",
            {"assigned_to": str(self.tech_membership.id)},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order_a.refresh_from_db()
        self.assertEqual(self.work_order_a.assigned_to_id, self.tech_membership.id)
        self.assertEqual(self.work_order_a.status, WorkOrder.Status.ASSIGNED)
        self.assertTrue(
            Notification.objects.filter(
                user=self.tech,
                work_order=self.work_order_a,
                title="New work order assigned",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=contact.user,
                work_order=self.work_order_a,
                title="New technician assigned",
            ).exists()
        )

    def test_cannot_mark_open_work_order_assigned_without_technician(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {"status": WorkOrder.Status.ASSIGNED},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.work_order_a.refresh_from_db()
        self.assertEqual(self.work_order_a.status, WorkOrder.Status.OPEN)
        self.assertIsNone(self.work_order_a.assigned_to)

    def test_assigned_technician_can_change_status(self):
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.status = WorkOrder.Status.ASSIGNED
        self.work_order_a.save(update_fields=["assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.tech)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {"status": WorkOrder.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order_a.refresh_from_db()
        self.assertEqual(self.work_order_a.status, WorkOrder.Status.IN_PROGRESS)

    def test_unassigned_technician_cannot_change_status(self):
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.status = WorkOrder.Status.ASSIGNED
        self.work_order_a.save(update_fields=["assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.other_tech)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {"status": WorkOrder.Status.IN_PROGRESS},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_reopen_cancelled_work_order_with_cause(self):
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.status = WorkOrder.Status.CANCELLED
        self.work_order_a.save(update_fields=["assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {
                "status": WorkOrder.Status.OPEN,
                "message": "Client confirmed the cancellation was accidental.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.work_order_a.refresh_from_db()
        self.assertEqual(self.work_order_a.status, WorkOrder.Status.OPEN)
        self.assertIsNone(self.work_order_a.assigned_to)
        self.assertIsNone(self.work_order_a.cancelled_at)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                old_status=WorkOrder.Status.CANCELLED,
                new_status=WorkOrder.Status.OPEN,
                message="Client confirmed the cancellation was accidental.",
            ).exists()
        )

    def test_reopen_cancelled_work_order_requires_cause(self):
        self.work_order_a.status = WorkOrder.Status.CANCELLED
        self.work_order_a.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {"status": WorkOrder.Status.OPEN, "message": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_technician_cannot_reopen_cancelled_work_order(self):
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.status = WorkOrder.Status.CANCELLED
        self.work_order_a.save(update_fields=["assigned_to", "status", "updated_at"])
        self.client.force_authenticate(user=self.tech)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/change-status/",
            {"status": WorkOrder.Status.OPEN, "message": "Need to reopen."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_add_update_creates_work_order_update(self):
        owner, _ = create_member_user(
            "wo-owner@example.com",
            self.org_a,
            OrganizationMembership.Role.OWNER,
            "WO Owner",
        )
        contact = create_client_contact(
            self.client_a,
            email="wo-contact@example.com",
            full_name="WO Contact",
            can_login=True,
        )
        self.work_order_a.assigned_to = self.tech_membership
        self.work_order_a.requested_by_contact = contact
        self.work_order_a.save(update_fields=["assigned_to", "requested_by_contact", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/add-update/",
            {"message": "Parts ordered.", "is_internal": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                message="Parts ordered.",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=owner,
                work_order=self.work_order_a,
                title="New work order update",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=self.tech,
                work_order=self.work_order_a,
                title="New work order update",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                user=contact.user,
                work_order=self.work_order_a,
                title="New work order update",
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                user=owner,
                work_order=self.work_order_a,
                title="New client comment",
            ).exists()
        )

    def test_internal_update_does_not_notify_client_contact(self):
        owner, _ = create_member_user(
            "wo-internal-owner@example.com",
            self.org_a,
            OrganizationMembership.Role.OWNER,
            "Internal Owner",
        )
        contact = create_client_contact(
            self.client_a,
            email="wo-internal-contact@example.com",
            full_name="Internal Contact",
            can_login=True,
        )
        self.work_order_a.requested_by_contact = contact
        self.work_order_a.save(update_fields=["requested_by_contact", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/add-update/",
            {"message": "Private dispatch note.", "is_internal": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            Notification.objects.filter(
                user=owner,
                work_order=self.work_order_a,
                title="New work order update",
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                user=contact.user,
                work_order=self.work_order_a,
                title="New work order update",
            ).exists()
        )

    def test_upload_attachment_and_list_updates_attachments(self):
        self.client.force_authenticate(user=self.manager)

        upload_response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/upload-attachment/",
            {
                "file": SimpleUploadedFile(
                    "note.txt",
                    b"attachment body",
                    content_type="text/plain",
                ),
                "file_type": Attachment.FileType.DOCUMENT,
                "description": "Work note",
            },
            format="multipart",
        )
        self.assertEqual(upload_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(upload_response.data), 1)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                message="Uploaded 1 attachment.",
                is_internal=True,
            ).exists()
        )

        self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/add-update/",
            {"message": "Visible update."},
            format="json",
        )

        updates_response = self.client.get(f"/api/work-orders/{self.work_order_a.id}/updates/")
        attachments_response = self.client.get(
            f"/api/work-orders/{self.work_order_a.id}/attachments/"
        )

        self.assertEqual(updates_response.status_code, status.HTTP_200_OK)
        self.assertEqual(attachments_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(updates_response.data), 1)
        self.assertEqual(len(attachments_response.data), 1)

    def test_upload_multiple_attachments_in_one_request(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/upload-attachment/",
            {
                "files": [
                    SimpleUploadedFile(
                        "photo-1.txt",
                        b"first attachment",
                        content_type="text/plain",
                    ),
                    SimpleUploadedFile(
                        "photo-2.txt",
                        b"second attachment",
                        content_type="text/plain",
                    ),
                ],
                "file_type": Attachment.FileType.DOCUMENT,
                "description": "Batch upload",
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), 2)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                message="Uploaded 2 attachments.",
                is_internal=True,
            ).exists()
        )
        self.assertEqual(
            Attachment.objects.filter(
                work_order=self.work_order_a,
                description="Batch upload",
            ).count(),
            2,
        )

    def test_cannot_upload_attachment_to_cancelled_work_order(self):
        self.work_order_a.status = WorkOrder.Status.CANCELLED
        self.work_order_a.save(update_fields=["status", "updated_at"])
        self.client.force_authenticate(user=self.manager)

        response = self.client.post(
            f"/api/work-orders/{self.work_order_a.id}/upload-attachment/",
            {
                "file": SimpleUploadedFile(
                    "cancelled-note.txt",
                    b"attachment body",
                    content_type="text/plain",
                ),
                "file_type": Attachment.FileType.DOCUMENT,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_work_order_filter_by_status_and_pagination_shape(self):
        create_work_order(
            self.org_a,
            self.client_a,
            title="Completed job",
            status=WorkOrder.Status.COMPLETED,
        )
        self.client.force_authenticate(user=self.manager)

        response = self.client.get(f"/api/work-orders/?status={WorkOrder.Status.OPEN}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("count", response.data)
        self.assertTrue(
            all(item["status"] == WorkOrder.Status.OPEN for item in response.data["results"])
        )


class TechnicianPortalTests(APITestCase):
    def setUp(self):
        self.organization = create_organization("Technician Portal Org")
        self.manager, _ = create_member_user(
            "tp-manager@example.com",
            self.organization,
            OrganizationMembership.Role.MANAGER,
        )
        self.tech, self.tech_membership = create_member_user(
            "tp-tech@example.com",
            self.organization,
            OrganizationMembership.Role.TECHNICIAN,
        )
        self.other_tech, self.other_tech_membership = create_member_user(
            "tp-other-tech@example.com",
            self.organization,
            OrganizationMembership.Role.TECHNICIAN,
        )
        self.client_record = create_client(self.organization, "Technician Client")
        self.assigned_work_order = create_work_order(
            self.organization,
            self.client_record,
            title="Assigned to current tech",
            assigned_to=self.tech_membership,
            status=WorkOrder.Status.ASSIGNED,
        )
        self.other_work_order = create_work_order(
            self.organization,
            self.client_record,
            title="Assigned to other tech",
            assigned_to=self.other_tech_membership,
            status=WorkOrder.Status.ASSIGNED,
        )

    def test_technician_sees_only_assigned_work_orders(self):
        self.client.force_authenticate(user=self.tech)

        response = self.client.get("/api/technician/work-orders/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in paginated_results(response)}
        self.assertIn(str(self.assigned_work_order.id), ids)
        self.assertNotIn(str(self.other_work_order.id), ids)

    def test_technician_default_list_prioritizes_active_overdue_work(self):
        overdue_work_order = create_work_order(
            self.organization,
            self.client_record,
            title="Overdue assigned work",
            assigned_to=self.tech_membership,
            status=WorkOrder.Status.OVERDUE,
            due_date=timezone.now() - timezone.timedelta(days=1),
        )
        completed_work_order = create_work_order(
            self.organization,
            self.client_record,
            title="Completed assigned work",
            assigned_to=self.tech_membership,
            status=WorkOrder.Status.COMPLETED,
        )
        self.client.force_authenticate(user=self.tech)

        response = self.client.get("/api/technician/work-orders/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = paginated_results(response)
        ids = [item["id"] for item in results]
        self.assertEqual(ids[0], str(overdue_work_order.id))
        self.assertIn(str(self.assigned_work_order.id), ids)
        self.assertNotIn(str(completed_work_order.id), ids)

    def test_technician_can_filter_completed_history(self):
        completed_work_order = create_work_order(
            self.organization,
            self.client_record,
            title="Completed assigned work",
            assigned_to=self.tech_membership,
            status=WorkOrder.Status.COMPLETED,
        )
        self.client.force_authenticate(user=self.tech)

        response = self.client.get(
            f"/api/technician/work-orders/?status={WorkOrder.Status.COMPLETED}"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in paginated_results(response)}
        self.assertIn(str(completed_work_order.id), ids)

    def test_technician_cannot_retrieve_another_technicians_work_order(self):
        self.client.force_authenticate(user=self.tech)

        response = self.client.get(f"/api/technician/work-orders/{self.other_work_order.id}/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_manager_cannot_access_technician_portal(self):
        self.client.force_authenticate(user=self.manager)

        response = self.client.get("/api/technician/work-orders/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class ClientPortalTests(APITestCase):
    def setUp(self):
        self.organization = create_organization("Client Portal Org")
        self.manager, _ = create_member_user(
            "cp-manager@example.com",
            self.organization,
            OrganizationMembership.Role.MANAGER,
        )
        self.tech, _ = create_member_user(
            "cp-tech@example.com",
            self.organization,
            OrganizationMembership.Role.TECHNICIAN,
        )
        self.client_a = create_client(self.organization, "Portal Client A")
        self.client_b = create_client(self.organization, "Portal Client B")
        self.contact_a = create_client_contact(
            self.client_a,
            email="portal-a@example.com",
            full_name="Portal Contact A",
            can_login=True,
            password=TEST_PASSWORD,
        )
        self.contact_b = create_client_contact(
            self.client_b,
            email="portal-b@example.com",
            full_name="Portal Contact B",
            can_login=True,
            password=TEST_PASSWORD,
        )
        self.asset_a = create_asset(self.client_a, "Portal Asset A", "CP-A-SN")
        self.asset_b = create_asset(self.client_b, "Portal Asset B", "CP-B-SN")
        self.work_order_a = create_work_order(
            self.organization,
            self.client_a,
            title="Client A request",
            asset=self.asset_a,
            requested_by_contact=self.contact_a,
            created_by=self.contact_a.user,
        )
        self.work_order_b = create_work_order(
            self.organization,
            self.client_b,
            title="Client B request",
            asset=self.asset_b,
            requested_by_contact=self.contact_b,
            created_by=self.contact_b.user,
        )

    def test_client_contact_can_create_request_for_own_client(self):
        self.client.force_authenticate(user=self.contact_a.user)

        response = self.client.post(
            "/api/client-portal/requests/",
            {
                "asset": str(self.asset_a.id),
                "title": "New portal request",
                "description": "Please fix this.",
                "priority": WorkOrder.Priority.HIGH,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WorkOrder.objects.filter(
                client=self.client_a,
                requested_by_contact=self.contact_a,
                title="New portal request",
            ).exists()
        )

    def test_client_contact_cannot_choose_another_clients_asset(self):
        self.client.force_authenticate(user=self.contact_a.user)

        response = self.client.post(
            "/api/client-portal/requests/",
            {
                "asset": str(self.asset_b.id),
                "title": "Wrong asset request",
                "description": "Should fail.",
                "priority": WorkOrder.Priority.MEDIUM,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_client_contact_sees_only_own_clients_requests(self):
        self.client.force_authenticate(user=self.contact_a.user)

        response = self.client.get("/api/client-portal/requests/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in paginated_results(response)}
        self.assertIn(str(self.work_order_a.id), ids)
        self.assertNotIn(str(self.work_order_b.id), ids)

    def test_client_contact_can_add_public_comment(self):
        self.client.force_authenticate(user=self.contact_a.user)

        response = self.client.post(
            f"/api/client-portal/requests/{self.work_order_a.id}/add-comment/",
            {"message": "Any update?"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(
            WorkOrderUpdate.objects.filter(
                work_order=self.work_order_a,
                message="Any update?",
                is_internal=False,
            ).exists()
        )

    def test_client_contact_cannot_see_internal_updates(self):
        WorkOrderUpdate.objects.create(
            work_order=self.work_order_a,
            user=self.manager,
            message="Internal note",
            old_status=self.work_order_a.status,
            new_status=self.work_order_a.status,
            is_internal=True,
        )
        WorkOrderUpdate.objects.create(
            work_order=self.work_order_a,
            user=self.manager,
            message="Public note",
            old_status=self.work_order_a.status,
            new_status=self.work_order_a.status,
            is_internal=False,
        )
        self.client.force_authenticate(user=self.contact_a.user)

        response = self.client.get(f"/api/client-portal/requests/{self.work_order_a.id}/updates/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        messages = {item["message"] for item in response.data}
        self.assertIn("Public note", messages)
        self.assertNotIn("Internal note", messages)

    def test_company_users_cannot_access_client_portal(self):
        self.client.force_authenticate(user=self.manager)
        manager_response = self.client.get("/api/client-portal/requests/")

        self.client.force_authenticate(user=self.tech)
        tech_response = self.client.get("/api/client-portal/requests/")

        self.assertEqual(manager_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(tech_response.status_code, status.HTTP_403_FORBIDDEN)
