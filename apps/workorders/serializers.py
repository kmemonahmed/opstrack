from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.assets.models import Asset
from apps.clients.models import Client, ClientContact
from apps.notifications.services import (
    notify_client_comment_added,
    notify_client_request_created,
    notify_public_work_order_update_added,
    notify_work_order_assigned,
    notify_work_order_status_changed,
)
from apps.workorders.models import Attachment, WorkOrder, WorkOrderUpdate
from apps.organizations.models import OrganizationMembership


User = get_user_model()


class WorkOrderUserMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "full_name",
            "phone",
        )


class WorkOrderClientMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = (
            "id",
            "name",
            "email",
            "phone",
            "industry",
        )


class WorkOrderAssetMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = (
            "id",
            "name",
            "asset_type",
            "serial_number",
            "location",
            "status",
        )


class WorkOrderClientContactMiniSerializer(serializers.ModelSerializer):
    class Meta:
        model = ClientContact
        fields = (
            "id",
            "full_name",
            "email",
            "phone",
            "position",
        )


class AssignedTechnicianMiniSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    role = serializers.CharField()
    user = WorkOrderUserMiniSerializer()


class WorkOrderListAssetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Asset
        fields = (
            "id",
            "name",
        )
class WorkOrderListClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = (
            "id",
            "name",
        )



class WorkOrderListUserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = (
            "id",
            "full_name",
        )


class WorkOrderListAssignedSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user = WorkOrderListUserSerializer()


class WorkOrderListSerializer(serializers.ModelSerializer):
    asset = WorkOrderListAssetSerializer(read_only=True)
    assigned_to = WorkOrderListAssignedSerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    client = WorkOrderListClientSerializer(read_only=True)


    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "title",
            "client",
            "asset",
            "priority",
            "status",
            "assigned_to",
            "due_date",
            "is_overdue",
            "created_at",
            "completed_at",
        )


class WorkOrderSerializer(serializers.ModelSerializer):
    organization = serializers.StringRelatedField(read_only=True)
    client = WorkOrderClientMiniSerializer(read_only=True)
    asset = WorkOrderAssetMiniSerializer(read_only=True)
    created_by = WorkOrderUserMiniSerializer(read_only=True)
    requested_by_contact = WorkOrderClientContactMiniSerializer(read_only=True)
    assigned_to = AssignedTechnicianMiniSerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "organization",
            "client",
            "asset",
            "title",
            "description",
            "priority",
            "status",
            "created_by",
            "requested_by_contact",
            "assigned_to",
            "due_date",
            "completed_at",
            "cancelled_at",
            "is_overdue",
            "created_at",
            "updated_at",
        )


class ClientPortalWorkOrderRetrieveSerializer(serializers.ModelSerializer):
    asset = WorkOrderAssetMiniSerializer(read_only=True)
    created_by = WorkOrderUserMiniSerializer(read_only=True)
    requested_by_contact = WorkOrderClientContactMiniSerializer(read_only=True)
    assigned_to = AssignedTechnicianMiniSerializer(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "asset",
            "title",
            "description",
            "priority",
            "status",
            "created_by",
            "requested_by_contact",
            "assigned_to",
            "due_date",
            "completed_at",
            "cancelled_at",
            "is_overdue",
            "created_at",
            "updated_at",
        )


class WorkOrderCreateUpdateSerializer(serializers.ModelSerializer):
    client = serializers.PrimaryKeyRelatedField(
        queryset=Client.objects.none()
    )
    asset = serializers.PrimaryKeyRelatedField(
        queryset=Asset.objects.none(),
        required=False,
        allow_null=True,
    )
    requested_by_contact = serializers.PrimaryKeyRelatedField(
        queryset=ClientContact.objects.none(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = WorkOrder
        fields = (
            "client",
            "asset",
            "requested_by_contact",
            "title",
            "description",
            "priority",
            "due_date",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        current_membership = self.context.get("current_membership")

        if current_membership:
            organization = current_membership.organization

            self.fields["client"].queryset = Client.objects.filter(
                organization=organization,
                is_active=True,
            )

            self.fields["asset"].queryset = Asset.objects.filter(
                client__organization=organization,
            ).exclude(
                status=Asset.Status.RETIRED,
            )

            self.fields["requested_by_contact"].queryset = ClientContact.objects.filter(
                client__organization=organization,
                is_active=True,
            )
        else:
            self.fields["client"].queryset = Client.objects.none()
            self.fields["asset"].queryset = Asset.objects.none()
            self.fields["requested_by_contact"].queryset = ClientContact.objects.none()

    def validate(self, attrs):
        current_membership = self.context.get("current_membership")

        client = attrs.get("client") or getattr(self.instance, "client", None)

        if "asset" in attrs:
            asset = attrs.get("asset")
        else:
            asset = getattr(self.instance, "asset", None)

        if "requested_by_contact" in attrs:
            requested_by_contact = attrs.get("requested_by_contact")
        else:
            requested_by_contact = getattr(self.instance, "requested_by_contact", None)

        if current_membership and client:
            if client.organization_id != current_membership.organization_id:
                raise serializers.ValidationError(
                    {"client": "Selected client does not belong to your organization."}
                )

        if asset and client:
            if asset.client_id != client.id:
                raise serializers.ValidationError(
                    {"asset": "Selected asset does not belong to the selected client."}
                )

        if requested_by_contact and client:
            if requested_by_contact.client_id != client.id:
                raise serializers.ValidationError(
                    {
                        "requested_by_contact": "Selected contact does not belong to the selected client."
                    }
                )

        return attrs


class WorkOrderAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(
        queryset=OrganizationMembership.objects.none()
    )
    message = serializers.CharField(required=False, allow_blank=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        current_membership = self.context.get("current_membership")

        if current_membership:
            self.fields["assigned_to"].queryset = OrganizationMembership.objects.filter(
                organization=current_membership.organization,
                role=OrganizationMembership.Role.TECHNICIAN,
                is_active=True,
            ).select_related("user", "organization")
        else:
            self.fields["assigned_to"].queryset = OrganizationMembership.objects.none()

    def validate(self, attrs):
        work_order = self.instance
        assigned_to = attrs["assigned_to"]

        if work_order.status in [
            WorkOrder.Status.COMPLETED,
            WorkOrder.Status.CANCELLED,
        ]:
            raise serializers.ValidationError(
                "Completed or cancelled work orders cannot be assigned."
            )

        if assigned_to.organization_id != work_order.organization_id:
            raise serializers.ValidationError(
                {"assigned_to": "Technician must belong to the same organization."}
            )

        if assigned_to.role != OrganizationMembership.Role.TECHNICIAN:
            raise serializers.ValidationError(
                {"assigned_to": "Work order can only be assigned to a technician."}
            )

        if not assigned_to.is_active:
            raise serializers.ValidationError(
                {"assigned_to": "Cannot assign work order to an inactive technician."}
            )

        return attrs

    def update(self, instance, validated_data):
        assigned_to = validated_data["assigned_to"]
        message = validated_data.get("message", "")

        old_status = instance.status

        instance.assigned_to = assigned_to
        instance.status = WorkOrder.Status.ASSIGNED
        instance.save(update_fields=["assigned_to", "status", "updated_at"])

        WorkOrderUpdate.objects.create(
            work_order=instance,
            user=self.context["request"].user,
            message=message or f"Assigned to {assigned_to.user.full_name}.",
            old_status=old_status,
            new_status=instance.status,
            is_internal=True,
        )

        notify_work_order_assigned(
            instance,
            actor=self.context["request"].user,
        )

        return instance


class WorkOrderChangeStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=WorkOrder.Status.choices)
    message = serializers.CharField(required=False, allow_blank=True)
    is_internal = serializers.BooleanField(default=False)

    ALLOWED_TRANSITIONS = {
        WorkOrder.Status.OPEN: [
            WorkOrder.Status.ASSIGNED,
            WorkOrder.Status.CANCELLED,
        ],
        WorkOrder.Status.ASSIGNED: [
            WorkOrder.Status.IN_PROGRESS,
            WorkOrder.Status.ON_HOLD,
            WorkOrder.Status.CANCELLED,
        ],
        WorkOrder.Status.IN_PROGRESS: [
            WorkOrder.Status.ON_HOLD,
            WorkOrder.Status.COMPLETED,
            WorkOrder.Status.CANCELLED,
        ],
        WorkOrder.Status.ON_HOLD: [
            WorkOrder.Status.IN_PROGRESS,
            WorkOrder.Status.CANCELLED,
        ],
        WorkOrder.Status.OVERDUE: [
            WorkOrder.Status.IN_PROGRESS,
            WorkOrder.Status.ON_HOLD,
            WorkOrder.Status.COMPLETED,
            WorkOrder.Status.CANCELLED,
        ],
        WorkOrder.Status.COMPLETED: [],
        WorkOrder.Status.CANCELLED: [
            WorkOrder.Status.OPEN,
        ],
    }

    def validate_status(self, value):
        work_order = self.instance
        current_status = work_order.status

        if value == current_status:
            raise serializers.ValidationError(
                "New status cannot be the same as the current status."
            )

        allowed_statuses = self.ALLOWED_TRANSITIONS.get(current_status, [])

        if value not in allowed_statuses:
            raise serializers.ValidationError(
                f"Cannot change status from {current_status} to {value}."
            )

        return value

    def validate(self, attrs):
        old_status = self.instance.status
        new_status = attrs["status"]
        message = attrs.get("message", "").strip()

        if old_status == WorkOrder.Status.CANCELLED and new_status == WorkOrder.Status.OPEN:
            if not message:
                raise serializers.ValidationError(
                    {"message": "Enter a reason before reopening this work order."}
                )

        if old_status == WorkOrder.Status.OPEN and new_status == WorkOrder.Status.ASSIGNED:
            if not self.instance.assigned_to_id:
                raise serializers.ValidationError(
                    {"status": "Assign a technician before marking this work order as assigned."}
                )

        return attrs

    def update(self, instance, validated_data):
        old_status = instance.status
        new_status = validated_data["status"]
        message = validated_data.get("message", "")
        is_internal = validated_data.get("is_internal", False)

        instance.status = new_status
        update_fields = [
            "status",
            "completed_at",
            "cancelled_at",
            "updated_at",
        ]

        if old_status == WorkOrder.Status.CANCELLED and new_status == WorkOrder.Status.OPEN:
            instance.assigned_to = None
            update_fields.append("assigned_to")

        instance.save(update_fields=update_fields)

        WorkOrderUpdate.objects.create(
            work_order=instance,
            user=self.context["request"].user,
            message=message or f"Status changed from {old_status} to {new_status}.",
            old_status=old_status,
            new_status=new_status,
            is_internal=is_internal,
        )

        notify_work_order_status_changed(
            instance,
            old_status,
            new_status,
            actor=self.context["request"].user,
            is_internal=is_internal,
        )

        return instance

class WorkOrderUpdateSerializer(serializers.ModelSerializer):
    user = WorkOrderUserMiniSerializer(read_only=True)

    class Meta:
        model = WorkOrderUpdate
        fields = (
            "id",
            "user",
            "message",
            "old_status",
            "new_status",
            "is_internal",
            "created_at",
            "updated_at",
        )


class WorkOrderAddUpdateSerializer(serializers.Serializer):
    message = serializers.CharField()
    is_internal = serializers.BooleanField(default=False)

    def validate_message(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Message cannot be empty.")

        return value

    def create(self, validated_data):
        work_order = self.context["work_order"]
        request = self.context["request"]

        update = WorkOrderUpdate.objects.create(
            work_order=work_order,
            user=request.user,
            message=validated_data["message"],
            old_status=work_order.status,
            new_status=work_order.status,
            is_internal=validated_data.get("is_internal", False),
        )

        notify_public_work_order_update_added(
            work_order,
            actor=request.user,
            is_internal=update.is_internal,
        )

        return update

class AttachmentSerializer(serializers.ModelSerializer):
    uploaded_by = WorkOrderUserMiniSerializer(read_only=True)

    class Meta:
        model = Attachment
        fields = (
            "id",
            "uploaded_by",
            "file",
            "file_type",
            "description",
            "created_at",
            "updated_at",
        )


class WorkOrderAttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )
    file_type = serializers.ChoiceField(
        choices=Attachment.FileType.choices,
        default=Attachment.FileType.OTHER,
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )

    def validate(self, attrs):
        request = self.context["request"]
        files = request.FILES.getlist("files") or request.FILES.getlist("file")

        if not files and attrs.get("file"):
            files = [attrs["file"]]

        if not files:
            raise serializers.ValidationError(
                {"files": "Select at least one attachment."}
            )

        attrs["files"] = files

        return attrs

    def create(self, validated_data):
        work_order = self.context["work_order"]
        request = self.context["request"]
        file_type = validated_data.get("file_type", Attachment.FileType.OTHER)
        description = validated_data.get("description", "")

        return [
            Attachment.objects.create(
                work_order=work_order,
                uploaded_by=request.user,
                file=file,
                file_type=file_type,
                description=description,
            )
            for file in validated_data["files"]
        ]


class ClientPortalWorkOrderCreateSerializer(serializers.ModelSerializer):
    asset = serializers.PrimaryKeyRelatedField(
        queryset=Asset.objects.none(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = WorkOrder
        fields = (
            "asset",
            "title",
            "description",
            "priority",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        client_contact = self.context.get("client_contact")

        if client_contact:
            self.fields["asset"].queryset = Asset.objects.filter(
                client=client_contact.client,
            ).exclude(
                status=Asset.Status.RETIRED,
            )
        else:
            self.fields["asset"].queryset = Asset.objects.none()

    def validate(self, attrs):
        client_contact = self.context.get("client_contact")
        asset = attrs.get("asset")

        if asset and client_contact:
            if asset.client_id != client_contact.client_id:
                raise serializers.ValidationError(
                    {"asset": "Selected asset does not belong to your client profile."}
                )

        return attrs

    def create(self, validated_data):
        request = self.context["request"]

        work_order = WorkOrder.objects.create(**validated_data)

        notify_client_request_created(
            work_order,
            actor=request.user,
        )

        return work_order


class ClientPortalAddCommentSerializer(serializers.Serializer):
    message = serializers.CharField()

    def validate_message(self, value):
        value = value.strip()

        if not value:
            raise serializers.ValidationError("Message cannot be empty.")

        return value

    def create(self, validated_data):
        work_order = self.context["work_order"]
        request = self.context["request"]

        update = WorkOrderUpdate.objects.create(
            work_order=work_order,
            user=request.user,
            message=validated_data["message"],
            old_status=work_order.status,
            new_status=work_order.status,
            is_internal=False,
        )

        notify_client_comment_added(
            work_order,
            actor=request.user,
        )

        return update


class ClientPortalAttachmentUploadSerializer(serializers.Serializer):
    file = serializers.FileField(required=False)
    files = serializers.ListField(
        child=serializers.FileField(),
        required=False,
        write_only=True,
    )
    file_type = serializers.ChoiceField(
        choices=Attachment.FileType.choices,
        default=Attachment.FileType.OTHER,
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=255,
    )

    def validate(self, attrs):
        request = self.context["request"]
        files = request.FILES.getlist("files") or request.FILES.getlist("file")

        if not files and attrs.get("file"):
            files = [attrs["file"]]

        if not files:
            raise serializers.ValidationError(
                {"files": "Select at least one attachment."}
            )

        attrs["files"] = files

        return attrs

    def create(self, validated_data):
        work_order = self.context["work_order"]
        request = self.context["request"]
        file_type = validated_data.get("file_type", Attachment.FileType.OTHER)
        description = validated_data.get("description", "")

        return [
            Attachment.objects.create(
                work_order=work_order,
                uploaded_by=request.user,
                file=file,
                file_type=file_type,
                description=description,
            )
            for file in validated_data["files"]
        ]
