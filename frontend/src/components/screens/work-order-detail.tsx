"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Edit, Paperclip, Send, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/loading";
import { formatDate, titleCase } from "@/lib/utils";

const statusTransitions: Record<string, string[]> = {
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "ON_HOLD", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  OVERDUE: ["IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function WorkOrderDetailScreen({ id, portal = "company" }: { id: string; portal?: "company" | "technician" | "client" }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [reopenCause, setReopenCause] = useState("");
  const [editingDetails, setEditingDetails] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);

  const baseBack = portal === "client" ? "/client/requests" : portal === "technician" ? "/tech/work-orders" : "/app/work-orders";
  const detailQuery = useQuery({
    queryKey: [portal, "work-order", id],
    queryFn: () => (portal === "client" ? api.getClientRequest(id) : portal === "technician" ? api.getTechnicianWorkOrder(id) : api.getWorkOrder(id)),
  });
  const updatesQuery = useQuery({
    queryKey: [portal, "updates", id],
    queryFn: () => (portal === "client" ? api.listClientRequestUpdates(id) : api.listWorkOrderUpdates(id)),
  });
  const attachmentsQuery = useQuery({
    queryKey: [portal, "attachments", id],
    queryFn: () => (portal === "client" ? api.listClientRequestAttachments(id) : api.listWorkOrderAttachments(id)),
  });
  const teamQuery = useQuery({
    queryKey: ["technician-options"],
    queryFn: () => api.listTeam({ role: "TECHNICIAN", is_active: true }),
    enabled: portal === "company",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [portal, "work-order", id] });
    queryClient.invalidateQueries({ queryKey: [portal, "updates", id] });
    queryClient.invalidateQueries({ queryKey: [portal, "attachments", id] });
    queryClient.invalidateQueries({ queryKey: [`${portal}-work-orders`] });
  };

  const addUpdate = useMutation({
    mutationFn: () =>
      portal === "client"
        ? api.addClientComment(id, { message })
        : api.addWorkOrderUpdate(id, { message, is_internal: isInternal }),
    onSuccess: () => {
      setMessage("");
      setIsInternal(false);
      invalidate();
      toast.success(portal === "client" ? "Comment added" : "Update added");
    },
  });

  const changeStatus = useMutation({
    mutationFn: (nextStatus: string) => api.changeWorkOrderStatus(id, { status: nextStatus, message: message || undefined, is_internal: isInternal }),
    onSuccess: () => {
      setMessage("");
      setStatus("");
      invalidate();
      toast.success("Status updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not change status"),
  });

  const assign = useMutation({
    mutationFn: () => api.assignWorkOrder(id, { assigned_to: assignee, message: message || undefined }),
    onSuccess: () => {
      setAssignee("");
      setMessage("");
      invalidate();
      toast.success("Technician assigned");
    },
  });

  const reopen = useMutation({
    mutationFn: () => api.changeWorkOrderStatus(id, { status: "OPEN", message: reopenCause, is_internal: false }),
    onSuccess: () => {
      setReopenCause("");
      setStatus("");
      invalidate();
      toast.success("Work order reopened");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reopen work order"),
  });

  const updateDetails = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.updateWorkOrder(id, body),
    onSuccess: () => {
      setEditingDetails(false);
      invalidate();
      toast.success("Work order details updated");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update work order details"),
  });

  const upload = useMutation({
    mutationFn: () => {
      if (!files.length) throw new Error("Choose at least one file first.");
      const formData = new FormData();
      files.forEach((selectedFile) => formData.append("files", selectedFile));
      formData.append("file_type", fileTypeFor(files));
      return portal === "client" ? api.uploadClientRequestAttachment(id, formData) : api.uploadWorkOrderAttachment(id, formData);
    },
    onSuccess: () => {
      setFiles([]);
      setFileInputKey((value) => value + 1);
      invalidate();
      toast.success(files.length > 1 ? "Attachments uploaded" : "Attachment uploaded");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Upload failed"),
  });

  if (detailQuery.isLoading) return <LoadingBlock label="Loading work order" />;
  const workOrder = detailQuery.data;
  if (!workOrder) return null;
  const currentAssigneeId = workOrder.assigned_to?.id ?? "";
  const selectedAssignee = assignee || currentAssigneeId;
  const currentAssigneeName = workOrder.assigned_to?.user.full_name ?? "Unassigned";
  const availableStatuses = (statusTransitions[workOrder.status] ?? []).filter(
    (nextStatus) => !(nextStatus === "ASSIGNED" && !currentAssigneeId),
  );
  const selectedStatus = availableStatuses.includes(status) ? status : "";
  const isCancelled = workOrder.status === "CANCELLED";
  const isClosed = isCancelled || workOrder.status === "COMPLETED";
  const canEditDetails = portal === "company" && !isClosed;
  const detailsPatch = buildDetailsPatch(workOrder.description, workOrder.due_date, descriptionDraft, dueDateDraft);
  const hasDetailsChanges = Object.keys(detailsPatch).length > 0;

  function startDetailsEdit() {
    if (!workOrder) return;

    setDescriptionDraft(workOrder.description);
    setDueDateDraft(datetimeLocalValue(workOrder.due_date));
    setEditingDetails(true);
  }

  return (
    <div className="space-y-5">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href={baseBack}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="premium-panel border-[#d7e3e7]">
            <CardHeader>
              <div className="flex flex-col justify-between gap-3 md:flex-row">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{workOrder.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{workOrder.client?.name ?? "Client request"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canEditDetails && !editingDetails ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-md border border-border bg-white text-muted-foreground shadow-none hover:border-[#b8c8ce] hover:bg-[#f7fafb] hover:text-foreground"
                      onClick={startDetailsEdit}
                      aria-label="Edit work order details"
                      title="Edit details"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Badge value={workOrder.priority} />
                  <Badge value={workOrder.status} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {editingDetails ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Due date</Label>
                    <Input type="datetime-local" value={dueDateDraft} onChange={(event) => setDueDateDraft(event.target.value)} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setEditingDetails(false);
                        setDescriptionDraft("");
                        setDueDateDraft("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button disabled={!descriptionDraft.trim() || !hasDetailsChanges || updateDetails.isPending} onClick={() => updateDetails.mutate(detailsPatch)}>
                      Save details
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-sm leading-6">{workOrder.description}</p>
              )}
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <Info label="Asset" value={workOrder.asset?.name ?? "No asset linked"} />
                <Info label="Assigned to" value={workOrder.assigned_to?.user.full_name ?? "Unassigned"} />
                <Info label="Due" value={formatDate(workOrder.due_date)} />
                <Info label="Created" value={formatDate(workOrder.created_at)} />
                <Info label="Completed" value={formatDate(workOrder.completed_at)} />
                <Info label="Updated" value={formatDate(workOrder.updated_at)} />
              </div>
            </CardContent>
          </Card>

          <Card className="premium-panel border-[#d7e3e7]">
            <CardHeader>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Activity</p>
                <h3 className="mt-1 font-semibold">{portal === "client" ? "Service conversation" : "Work order updates"}</h3>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  addUpdate.mutate();
                }}
              >
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={portal === "client" ? "Share a clear note for the service team" : "Add a concise update for the team"}
                  required
                />
                {portal !== "client" ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
                    Keep this update internal
                  </label>
                ) : null}
                <Button disabled={addUpdate.isPending || !message.trim()}>
                  <Send className="h-4 w-4" />
                  {portal === "client" ? "Send comment" : "Post update"}
                </Button>
              </form>

              <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-2">
                {(updatesQuery.data ?? []).map((update) => (
                  <div key={update.id} className="rounded-md border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span>{update.user?.full_name ?? "System"}</span>
                      <span>{formatDate(update.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{update.message || "Status update"}</p>
                    <div className="mt-2 flex gap-2">
                      {update.is_internal ? <Badge value="Internal" /> : null}
                      {update.old_status !== update.new_status ? <Badge value={`${update.old_status} to ${update.new_status}`} /> : null}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          {portal !== "client" && !isCancelled ? (
            <Card className="premium-panel border-[#d7e3e7]">
              <CardHeader>
                <h3 className="font-semibold">Progress control</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-[#fbfcfd] p-3">
                  <p className="text-xs uppercase text-muted-foreground">Current status</p>
                  <div className="mt-2">
                    <Badge value={workOrder.status} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={selectedStatus} disabled={!availableStatuses.length} onChange={(event) => setStatus(event.target.value)}>
                    <option value="">{availableStatuses.length ? "Choose next status" : "No status changes available"}</option>
                    {availableStatuses.map((value) => (
                      <option key={value} value={value}>
                        {titleCase(value)}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button className="w-full" onClick={() => changeStatus.mutate(selectedStatus)} disabled={!selectedStatus || changeStatus.isPending}>
                  Update status
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {portal === "company" && isCancelled ? (
            <Card className="premium-panel border-[#d7e3e7]">
              <CardHeader>
                <h3 className="font-semibold">Reopen work order</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-[#fbfcfd] p-3">
                  <p className="text-xs uppercase text-muted-foreground">Current status</p>
                  <div className="mt-2">
                    <Badge value={workOrder.status} />
                  </div>
                </div>
                <Textarea
                  value={reopenCause}
                  onChange={(event) => setReopenCause(event.target.value)}
                  placeholder="Enter the reason for reopening this work order"
                />
                <Button className="w-full" disabled={!reopenCause.trim() || reopen.isPending} onClick={() => reopen.mutate()}>
                  Reopen work order
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {portal === "company" && !isClosed ? (
            <Card className="premium-panel border-[#d7e3e7]">
              <CardHeader>
                <h3 className="font-semibold">Technician assignment</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md border border-border bg-[#fbfcfd] p-3">
                  <p className="text-xs uppercase text-muted-foreground">Current technician</p>
                  <p className="mt-1 font-medium">{currentAssigneeName}</p>
                </div>
                <Select value={selectedAssignee} onChange={(event) => setAssignee(event.target.value)}>
                  <option value="">Choose technician</option>
                  {(teamQuery.data?.results ?? []).map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.user.full_name}
                    </option>
                  ))}
                </Select>
                <Button className="w-full" disabled={!assignee || assignee === currentAssigneeId || assign.isPending} onClick={() => assign.mutate()}>
                  {currentAssigneeId ? "Change technician" : "Assign technician"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="premium-panel border-[#d7e3e7]">
            <CardHeader>
              <h3 className="font-semibold">Attachments</h3>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isClosed ? (
                <>
                  <Label>Upload file</Label>
                  <Input key={fileInputKey} type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                  {files.length ? <p className="text-xs text-muted-foreground">{files.length} selected</p> : null}
                  <Button className="w-full" variant="secondary" onClick={() => upload.mutate()} disabled={!files.length || upload.isPending}>
                    <Upload className="h-4 w-4" />
                    {files.length > 1 ? "Upload attachments" : "Upload attachment"}
                  </Button>
                </>
              ) : null}
              <div className="space-y-2">
                {(attachmentsQuery.data ?? []).map((attachment) => (
                  <a
                    key={attachment.id}
                    className="flex items-center gap-2 rounded-md border border-border p-2 text-sm hover:bg-muted"
                    href={attachment.file}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Paperclip className="h-4 w-4 text-primary" />
                    {attachment.description || attachment.file.split("/").pop()}
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[#fbfcfd] p-3">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function fileTypeFor(files: File[]) {
  if (files.every((file) => file.type.startsWith("image/"))) return "IMAGE";
  if (files.every((file) => !file.type.startsWith("image/"))) return "DOCUMENT";
  return "OTHER";
}

function datetimeLocalValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildDetailsPatch(currentDescription: string, currentDueDate: string | null, descriptionDraft: string, dueDateDraft: string) {
  const patch: Record<string, unknown> = {};
  const normalizedDescription = descriptionDraft.trim();

  if (normalizedDescription !== currentDescription) {
    patch.description = normalizedDescription;
  }

  if (dueDateDraft !== datetimeLocalValue(currentDueDate)) {
    patch.due_date = dueDateDraft ? new Date(dueDateDraft).toISOString() : null;
  }

  return patch;
}
