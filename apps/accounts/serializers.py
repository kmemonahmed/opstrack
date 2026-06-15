from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from drf_spectacular.utils import extend_schema_field
from rest_framework.exceptions import AuthenticationFailed
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from apps.accounts.models import User
from apps.organizations.models import Organization, OrganizationMembership
from apps.clients.models import ClientContact


class MaintolioTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)

        if self.user.is_staff or self.user.is_superuser:
            raise AuthenticationFailed(
                "You are not authorized to access this portal."
            )

        return data



# Serializer for ogranization registration
class OrganizationRegisterSerializer(serializers.Serializer):
    organization_name = serializers.CharField(max_length=150)
    organization_email = serializers.EmailField(required=False, allow_blank=True)
    organization_phone = serializers.CharField(required=False, allow_blank=True)
    organization_website = serializers.URLField(required=False, allow_blank=True)
    organization_address = serializers.CharField(required=False, allow_blank=True)

    full_name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, value):
        value = value.lower().strip()

        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")

        return value

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({
                "password_confirm": "Passwords do not match."
            })

        validate_password(attrs["password"])

        return attrs

    @transaction.atomic
    def create(self, validated_data):
        password = validated_data.pop("password")
        validated_data.pop("password_confirm")

        organization = Organization.objects.create(
            name=validated_data["organization_name"],
            email=validated_data.get("organization_email", ""),
            phone=validated_data.get("organization_phone", ""),
            website=validated_data.get("organization_website", ""),
            address=validated_data.get("organization_address", ""),
        )

        user = User.objects.create_user(
            email=validated_data["email"],
            password=password,
            full_name=validated_data["full_name"],
            phone=validated_data.get("phone", ""),
        )

        membership = OrganizationMembership.objects.create(
            organization=organization,
            user=user,
            role=OrganizationMembership.Role.OWNER,
            is_active=True,
        )

        return {
            "user": user,
            "organization": organization,
            "membership": membership,
        }



# Serializer for organization data only
class OrganizationMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    slug = serializers.CharField()


class MembershipMeSerializer(serializers.ModelSerializer):
    organization = OrganizationMiniSerializer()

    class Meta:
        model = OrganizationMembership
        fields = (
            "id",
            "organization",
            "role",
            "is_active",
        )


# Serializer for client contact
class ClientContactMeSerializer(serializers.ModelSerializer):
    client_id = serializers.UUIDField(source="client.id")
    client_name = serializers.CharField(source="client.name")
    organization_id = serializers.UUIDField(source="client.organization.id")
    organization_name = serializers.CharField(source="client.organization.name")

    class Meta:
        model = ClientContact
        fields = (
            "id",
            "client_id",
            "client_name",
            "organization_id",
            "organization_name",
            "full_name",
            "email",
            "phone",
            "position",
            "is_primary",
            "can_login",
        )


# Profile serializer
class MeSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    phone = serializers.CharField()
    avatar = serializers.ImageField(allow_null=True)
    date_joined = serializers.DateTimeField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    is_platform_admin = serializers.SerializerMethodField()
    organization_memberships = serializers.SerializerMethodField()
    client_contact_profile = serializers.SerializerMethodField()

    @extend_schema_field(serializers.BooleanField())
    def get_is_platform_admin(self, obj) -> bool:
        return obj.is_staff or obj.is_superuser

    @extend_schema_field(MembershipMeSerializer(many=True))
    def get_organization_memberships(self, obj) -> list:
        memberships = (
            obj.organization_memberships
            .filter(is_active=True)
            .select_related("organization")
        )
        return MembershipMeSerializer(memberships, many=True).data

    @extend_schema_field(ClientContactMeSerializer(allow_null=True))
    def get_client_contact_profile(self, obj) -> dict | None:
        try:
            profile = obj.client_contact_profile
        except ClientContact.DoesNotExist:
            return None

        return ClientContactMeSerializer(profile).data


# Password for password change
class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True)
    new_password_confirm = serializers.CharField(write_only=True)

    def validate_old_password(self, value):
        user = self.context["request"].user

        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")

        return value

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({
                "new_password_confirm": "Passwords do not match."
            })

        return attrs

    def save(self):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save(update_fields=["password"])
        return user


# serlizer for logout
class LogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    remove_avatar = serializers.BooleanField(required=False, write_only=True)

    class Meta:
        model = User
        fields = (
            "full_name",
            "avatar",
            "remove_avatar",
        )
        extra_kwargs = {
            "full_name": {"required": False},
            "avatar": {"required": False, "allow_null": True},
        }

    def validate_full_name(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Enter your name before saving.")

        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        remove_avatar = validated_data.pop("remove_avatar", False)
        avatar = validated_data.pop("avatar", None)
        updated_fields = []

        if "full_name" in validated_data:
            instance.full_name = validated_data["full_name"]
            updated_fields.append("full_name")

        if remove_avatar:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = ""
            updated_fields.append("avatar")
        elif avatar:
            if instance.avatar:
                instance.avatar.delete(save=False)
            instance.avatar = avatar
            updated_fields.append("avatar")

        if updated_fields:
            instance.save(update_fields=updated_fields + ["updated_at"])

        try:
            contact_profile = instance.client_contact_profile
        except ClientContact.DoesNotExist:
            contact_profile = None

        if contact_profile and "full_name" in validated_data:
            contact_profile.full_name = instance.full_name
            contact_profile.save(update_fields=["full_name", "updated_at"])

        return instance
