"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Edit, KeyRound, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { Me } from "@/lib/types";
import { formatDate, mediaUrl } from "@/lib/utils";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Enter your name before saving."),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Enter your current password."),
    new_password: z.string().min(8, "Choose a stronger password with at least 8 characters."),
    new_password_confirm: z.string().min(8, "Confirm the new password before saving."),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    path: ["new_password_confirm"],
    message: "The confirmation does not match the new password.",
  });

export function ProfilePage() {
  const auth = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const avatar = mediaUrl(auth.user?.avatar);
  const initials = getInitials(auth.user?.full_name || auth.user?.email);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Account profile</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Profile</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage your workspace identity and account access.</p>
      </div>

      <Card className="premium-panel overflow-hidden border-[#d7e3e7]">
        <div className="border-b border-border bg-[#f8fbfc] p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c7d8de] bg-[#e4f3f5] text-xl font-semibold text-primary">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0">
                <h3 className="truncate text-xl font-semibold tracking-tight">{auth.user?.full_name || "Profile"}</h3>
                <p className="mt-1 truncate text-sm text-muted-foreground">{auth.user?.email}</p>
                <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{auth.role || "User"} access</p>
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(true)} aria-label="Edit profile">
              <Edit className="h-4 w-4" />
              Edit profile
            </Button>
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Name" value={auth.user?.full_name || "Not set"} />
            <Info label="Email" value={auth.user?.email || "Not set"} />
            <Info label="Role" value={auth.role || "User"} />
            <Info
              label="Organization"
              value={auth.selectedMembership?.organization.name ?? auth.user?.client_contact_profile?.client_name ?? "Not assigned"}
            />
            <Info label="Date joined" value={formatDate(auth.user?.date_joined)} />
            <Info label="Last updated" value={formatDate(auth.user?.updated_at)} />
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-border bg-[#fbfcfd] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e4f3f5] text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Password</p>
                <p className="mt-1 text-sm text-muted-foreground">Keep account access current and secure.</p>
              </div>
            </div>
            <Button type="button" variant="secondary" onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      {auth.user ? <EditProfileDialog open={editOpen} onOpenChange={setEditOpen} user={auth.user} /> : null}
      <PasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </div>
  );
}

export function SettingsPage() {
  return <ProfilePage />;
}

function EditProfileDialog({ open, onOpenChange, user }: { open: boolean; onOpenChange: (value: boolean) => void; user: Me }) {
  const queryClient = useQueryClient();
  const [selectedAvatar, setSelectedAvatar] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const currentAvatar = mediaUrl(user.avatar);
  const visibleAvatar = removeAvatar ? null : previewUrl ?? currentAvatar;
  const initials = getInitials(user.full_name || user.email);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: { full_name: user.full_name ?? "" },
  });

  const watchedName = useWatch({ control: form.control, name: "full_name" }) ?? "";
  const hasAvatarChange = Boolean(selectedAvatar || removeAvatar);
  const hasNameChange = watchedName.trim() !== user.full_name;
  const canSave = hasNameChange || hasAvatarChange;

  function resetAvatarDraft() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedAvatar(null);
    setRemoveAvatar(false);
  }

  function closeDialog() {
    form.reset({ full_name: user.full_name ?? "" });
    resetAvatarDraft();
    onOpenChange(false);
  }

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof profileSchema>) => {
      const body = new FormData();
      body.append("full_name", values.full_name.trim());
      if (selectedAvatar) body.append("avatar", selectedAvatar);
      if (removeAvatar) body.append("remove_avatar", "true");
      return api.updateProfile(body);
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["me"], updatedUser);
      resetAvatarDraft();
      toast.success("Profile updated");
      onOpenChange(false);
    },
    onError: () => toast.error("We could not update your profile. Please review the details and try again."),
  });

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleAvatarChange(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose a valid image file.");
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedAvatar(file);
    setRemoveAvatar(false);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function clearAvatarSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setSelectedAvatar(null);
    setRemoveAvatar(Boolean(currentAvatar));
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (mutation.isPending) return;
        if (value) onOpenChange(true);
        else closeDialog();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#d7e3e7] bg-surface shadow-2xl shadow-slate-950/20">
          <DialogHeader eyebrow="Profile" title="Edit profile" disabled={mutation.isPending} />
          <form className="space-y-5 px-5 py-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#c7d8de] bg-[#e4f3f5] text-xl font-semibold text-primary">
                {visibleAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visibleAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-semibold shadow-sm transition hover:bg-muted">
                  <Camera className="h-4 w-4" />
                  Choose image
                  <input type="file" accept="image/*" className="sr-only" onChange={(event) => handleAvatarChange(event.target.files?.[0])} />
                </label>
                {visibleAvatar ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearAvatarSelection}>
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <Field label="Name" error={form.formState.errors.full_name?.message}>
              <Input {...form.register("full_name")} />
            </Field>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={closeDialog} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button disabled={mutation.isPending || !canSave}>{mutation.isPending ? "Saving" : "Save changes"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: "", new_password: "", new_password_confirm: "" },
  });

  const mutation = useMutation({
    mutationFn: api.changePassword,
    onSuccess: () => {
      toast.success("Password updated");
      form.reset();
      onOpenChange(false);
    },
    onError: () => toast.error("We could not update the password. Please check the current password and try again."),
  });

  useEffect(() => {
    if (!open) form.reset();
  }, [form, open]);

  return (
    <Dialog.Root open={open} onOpenChange={(value) => !mutation.isPending && onOpenChange(value)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[94vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-[#d7e3e7] bg-surface shadow-2xl shadow-slate-950/20">
          <DialogHeader eyebrow="Security" title="Change password" disabled={mutation.isPending} />
          <form className="space-y-4 px-5 py-5" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
            <Field label="Current password" error={form.formState.errors.old_password?.message}>
              <Input type="password" autoComplete="current-password" {...form.register("old_password")} />
            </Field>
            <Field label="New password" error={form.formState.errors.new_password?.message}>
              <Input type="password" autoComplete="new-password" {...form.register("new_password")} />
            </Field>
            <Field label="Confirm new password" error={form.formState.errors.new_password_confirm?.message}>
              <Input type="password" autoComplete="new-password" {...form.register("new_password_confirm")} />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button disabled={mutation.isPending}>{mutation.isPending ? "Updating" : "Update password"}</Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DialogHeader({ eyebrow, title, disabled }: { eyebrow: string; title: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border bg-[#f8fbfc] px-5 py-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        <Dialog.Title className="mt-1 text-lg font-semibold tracking-tight">{title}</Dialog.Title>
        <Dialog.Description className="sr-only">{title}</Dialog.Description>
      </div>
      <Dialog.Close asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`Close ${title.toLowerCase()}`}>
          <X className="h-4 w-4" />
        </Button>
      </Dialog.Close>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-[#fbfcfd] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}

function getInitials(value?: string | null) {
  if (!value) return "U";
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return `${first}${second}`.toUpperCase();
}
