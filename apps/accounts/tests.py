from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_helpers import TEST_PASSWORD, create_member_user, create_organization
from apps.organizations.models import Organization, OrganizationMembership


class AuthAPITests(APITestCase):
    def test_organization_registration_creates_owner_workspace_and_tokens(self):
        response = self.client.post(
            reverse("register"),
            {
                "organization_name": "Acme Maintenance",
                "organization_email": "ops@acme.test",
                "full_name": "Owner User",
                "email": "owner@acme.test",
                "password": TEST_PASSWORD,
                "password_confirm": TEST_PASSWORD,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

        user = get_user_model().objects.get(email="owner@acme.test")
        organization = Organization.objects.get(name="Acme Maintenance")
        membership = OrganizationMembership.objects.get(user=user, organization=organization)

        self.assertEqual(membership.role, OrganizationMembership.Role.OWNER)

    def test_login_returns_tokens(self):
        create_member_user(
            email="login@example.com",
            organization=create_organization("Login Org"),
            full_name="Login User",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "login@example.com", "password": TEST_PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_platform_admin_cannot_login_to_workspace(self):
        get_user_model().objects.create_superuser(
            email="platform-admin@example.com",
            password=TEST_PASSWORD,
            full_name="Platform Admin",
        )

        response = self.client.post(
            reverse("login"),
            {"email": "platform-admin@example.com", "password": TEST_PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn("access", response.data)
        self.assertEqual(str(response.data["detail"]), "You are not authorized to access this portal.")

    def test_me_endpoint_returns_user_profile(self):
        user, _ = create_member_user(
            email="me@example.com",
            organization=create_organization("Me Org"),
            full_name="Profile User",
        )
        self.client.force_authenticate(user=user)

        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], user.email)
        self.assertIn("avatar", response.data)
        self.assertIn("date_joined", response.data)
        self.assertIn("updated_at", response.data)
        self.assertEqual(len(response.data["organization_memberships"]), 1)

    def test_profile_update_changes_current_user_name(self):
        user, _ = create_member_user(
            email="profile-update@example.com",
            organization=create_organization("Profile Update Org"),
            full_name="Old Name",
        )
        self.client.force_authenticate(user=user)

        response = self.client.patch(
            reverse("profile"),
            {"full_name": "New Name"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.full_name, "New Name")
        self.assertEqual(response.data["full_name"], "New Name")

    def test_change_password_works(self):
        user, _ = create_member_user(
            email="password@example.com",
            organization=create_organization("Password Org"),
        )
        self.client.force_authenticate(user=user)

        response = self.client.post(
            reverse("change_password"),
            {
                "old_password": TEST_PASSWORD,
                "new_password": "An0therPass!456",
                "new_password_confirm": "An0therPass!456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.check_password("An0therPass!456"))

    def test_logout_blacklists_refresh_token(self):
        create_member_user(
            email="logout@example.com",
            organization=create_organization("Logout Org"),
        )
        login_response = self.client.post(
            reverse("login"),
            {"email": "logout@example.com", "password": TEST_PASSWORD},
            format="json",
        )
        access = login_response.data["access"]
        refresh = login_response.data["refresh"]

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        response = self.client.post(reverse("logout"), {"refresh": refresh}, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        refresh_response = self.client.post(
            reverse("token_refresh"),
            {"refresh": refresh},
            format="json",
        )
        self.assertEqual(refresh_response.status_code, status.HTTP_401_UNAUTHORIZED)
