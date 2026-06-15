"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Dialog from "@radix-ui/react-dialog";
import { Edit, Eye, Plus, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/loading";
import type { PaginatedResponse } from "@/lib/types";
import { compactObject, formatDate } from "@/lib/utils";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "password" | "textarea" | "select" | "checkbox" | "date" | "datetime-local";
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  editOptions?: Array<{ value: string; label: string }>;
  createOnly?: boolean;
};

export type ColumnConfig<T> = {
  header: string;
  value: (row: T) => React.ReactNode;
};

export type DetailConfig<T> = {
  label: string;
  value: (row: T) => React.ReactNode;
  wide?: boolean;
};

type ResourceListProps<T extends { id: string }> = {
  title: string;
  description: string;
  queryKey: string;
  list: (params: Record<string, unknown>) => Promise<PaginatedResponse<T>>;
  create?: (body: Record<string, unknown>) => Promise<unknown>;
  update?: (id: string, body: Record<string, unknown>) => Promise<unknown>;
  remove?: (id: string) => Promise<unknown>;
  columns: ColumnConfig<T>[];
  details?: DetailConfig<T>[];
  fields?: FieldConfig[];
  searchPlaceholder?: string;
  filters?: FieldConfig[];
  getInitialValues?: (row?: T) => Record<string, unknown>;
  getRowHref?: (row: T) => string;
  destructiveLabel?: string;
  actionLabel?: string;
};

export function ResourceList<T extends { id: string }>({
  title,
  description,
  queryKey,
  list,
  create,
  update,
  remove,
  columns,
  details = [],
  fields = [],
  searchPlaceholder = "Search",
  filters = [],
  getInitialValues,
  getRowHref,
  destructiveLabel = "Deactivate",
  actionLabel,
}: ResourceListProps<T>) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<T | null>(null);
  const [viewing, setViewing] = useState<T | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<T | null>(null);

  const params = useMemo(() => compactObject({ page, search, ...filterValues }), [page, search, filterValues]);
  const query = useQuery({ queryKey: [queryKey, params], queryFn: () => list(params) });
  const hasRowActions = Boolean(details.length || update || remove);
  const entityLabel = getEntityLabel(title, actionLabel);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => {
      if (editing && update) return update(editing.id, body);
      if (create) return create(body);
      return Promise.resolve();
    },
    onSuccess: () => {
      toast.success(editing ? "Changes saved" : "Record created");
      setFormOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: () => toast.error("We could not save those changes. Please review the details and try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: (row: T) => remove?.(row.id) ?? Promise.resolve(),
    onSuccess: () => {
      toast.success(`${destructiveLabel} complete`);
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: () => toast.error("We could not complete that action. Please try again."),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Workspace</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
        {create ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {actionLabel ?? `Add ${entityLabel}`}
          </Button>
        ) : null}
      </div>

      <Card className="premium-panel border-[#d7e3e7]">
        <CardHeader>
          <div className="grid gap-3 md:grid-cols-[1fr_repeat(3,minmax(150px,220px))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
              />
            </div>
            {filters.map((filter) => (
              <Select
                key={filter.name}
                value={filterValues[filter.name] ?? ""}
                onChange={(event) => {
                  setPage(1);
                  setFilterValues((current) => ({ ...current, [filter.name]: event.target.value }));
                }}
              >
                <option value="">{filter.label}</option>
                {filter.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading ? (
            <LoadingBlock />
          ) : !query.data?.results.length ? (
            <div className="p-5">
              <EmptyState title="No matching records" message="Adjust your search or filters to widen the view." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#f4f8f9] text-xs uppercase text-muted-foreground">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.header} className="px-4 py-3 font-semibold">
                        {column.header}
                      </th>
                    ))}
                    {hasRowActions ? <th className="w-32 px-4 py-3 text-right font-semibold">Actions</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {query.data.results.map((row) => (
                    <tr key={row.id} className="border-t border-border bg-white transition hover:bg-[#f8fbfc]">
                      {columns.map((column) => (
                        <td key={column.header} className="px-4 py-3 align-middle">
                          {getRowHref && column === columns[0] ? (
                            <a className="font-medium text-primary hover:underline" href={getRowHref(row)}>
                              {column.value(row)}
                            </a>
                          ) : (
                            column.value(row)
                          )}
                        </td>
                      ))}
                      {hasRowActions ? (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            {details.length ? (
                              <Button variant="ghost" size="icon" onClick={() => setViewing(row)} aria-label="View details">
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {update ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditing(row);
                                  setFormOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {remove ? (
                              <Button variant="ghost" size="icon" onClick={() => setPendingDelete(row)}>
                                <Trash2 className="h-4 w-4 text-danger" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-border bg-[#fbfcfd] px-5 py-3 text-sm text-muted-foreground">
            <span>{query.data ? `${query.data.count} total` : "Loading workspace data"}</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={!query.data?.next} onClick={() => setPage((value) => value + 1)}>
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {formOpen ? (
        <FormDialog
          key={editing?.id ?? "new"}
          open={formOpen}
          title={editing ? `Edit ${entityLabel}` : actionLabel ?? `Add ${entityLabel}`}
          fields={fields.filter((field) => !(editing && field.createOnly))}
          initialValues={getInitialValues?.(editing ?? undefined) ?? {}}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={(values) => saveMutation.mutate(values)}
          isSaving={saveMutation.isPending}
          mode={editing ? "edit" : "create"}
        />
      ) : null}

      {viewing ? (
        <DetailsDialog
          open={Boolean(viewing)}
          title={`${entityLabel.charAt(0).toUpperCase()}${entityLabel.slice(1)} details`}
          row={viewing}
          details={details}
          onClose={() => setViewing(null)}
        />
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`${destructiveLabel} entry`}
        description="This keeps historical activity intact while updating current availability."
        confirmLabel={destructiveLabel}
        onOpenChange={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
      />
    </div>
  );
}

function DetailsDialog<T>({
  open,
  title,
  row,
  details,
  onClose,
}: {
  open: boolean;
  title: string;
  row: T;
  details: DetailConfig<T>[];
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#d7e3e7] bg-surface shadow-2xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-4 border-b border-border bg-[#f8fbfc] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Record profile</p>
              <Dialog.Title className="mt-1 text-lg font-semibold tracking-tight">{title}</Dialog.Title>
              <Dialog.Description className="sr-only">View the complete record details.</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Close details">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
            {details.map((detail) => (
              <div
                key={detail.label}
                className={detail.wide ? "rounded-lg border border-border bg-[#fbfcfd] p-3 md:col-span-2" : "rounded-lg border border-border bg-[#fbfcfd] p-3"}
              >
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{detail.label}</p>
                <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{detail.value(row) || <span className="text-muted-foreground">Not provided</span>}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border bg-[#fbfcfd] px-5 py-4">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function FormDialog({
  open,
  title,
  fields,
  initialValues,
  onCancel,
  onSubmit,
  isSaving,
  mode,
}: {
  open: boolean;
  title: string;
  fields: FieldConfig[];
  initialValues: Record<string, unknown>;
  onCancel: () => void;
  onSubmit: (values: Record<string, unknown>) => void;
  isSaving: boolean;
  mode: "create" | "edit";
}) {
  const [values, setValues] = useState<Record<string, unknown>>(initialValues);

  function setValue(name: string, value: unknown) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSaving) onCancel();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[94vw] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-[#d7e3e7] bg-surface shadow-2xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-4 border-b border-border bg-[#f8fbfc] px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Details</p>
              <Dialog.Title className="mt-1 text-lg font-semibold tracking-tight">{title}</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                Review the record details before saving changes.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button type="button" variant="ghost" size="icon" disabled={isSaving} aria-label="Close form">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(buildFormPayload(fields, values, initialValues, mode));
          }}
        >
          <div className="grid min-h-0 gap-4 overflow-y-auto px-5 py-5 md:grid-cols-2">
            {fields.map((field) => {
              const options = mode === "edit" && field.editOptions ? field.editOptions : field.options;

              const checkboxGroupLabel = field.type === "checkbox" ? getCheckboxGroupLabel(field) : null;

              return (
              <div
                key={field.name}
                className={
                  field.type === "textarea"
                    ? "space-y-1.5 md:col-span-2"
                    : "space-y-1.5"
                }
              >
                {field.type !== "checkbox" ? <Label>{field.label}</Label> : checkboxGroupLabel ? <Label>{checkboxGroupLabel}</Label> : <div className="hidden h-5 md:block" />}
                {field.type === "textarea" ? (
                  <Textarea value={String(values[field.name] ?? "")} required={field.required} onChange={(event) => setValue(field.name, event.target.value)} />
                ) : field.type === "select" ? (
                  <Select value={String(values[field.name] ?? "")} required={field.required} onChange={(event) => setValue(field.name, event.target.value)}>
                    <option value="">Choose {field.label.toLowerCase()}</option>
                    {options?.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                ) : field.type === "checkbox" ? (
                  <label className="flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      onChange={(event) => setValue(field.name, event.target.checked)}
                    />
                    {field.label}
                  </label>
                ) : (
                  <Input
                    type={field.type ?? "text"}
                    value={String(values[field.name] ?? "")}
                    required={field.required}
                    onChange={(event) => setValue(field.name, event.target.value)}
                  />
                )}
              </div>
            );
            })}
          </div>
          <div className="flex justify-end gap-2 border-t border-border bg-[#fbfcfd] px-5 py-4">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button disabled={isSaving}>{isSaving ? "Saving" : "Save changes"}</Button>
          </div>
        </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function buildFormPayload(
  fields: FieldConfig[],
  values: Record<string, unknown>,
  initialValues: Record<string, unknown>,
  mode: "create" | "edit",
) {
  const payload = Object.fromEntries(
    fields.map((field) => {
      const value = values[field.name];

      if ((field.type === "date" || field.type === "datetime-local") && value === "") {
        return [field.name, mode === "edit" ? null : undefined];
      }

      if (field.type === "checkbox") {
        return [field.name, Boolean(value)];
      }

      return [field.name, value];
    }),
  );

  if (mode === "create") return compactObject(payload);

  return Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => formValueChanged(value, initialValues[key])),
  );
}

function formValueChanged(value: unknown, initialValue: unknown) {
  const normalize = (item: unknown) => {
    if (item === undefined || item === null) return "";
    if (typeof item === "boolean") return item;
    return String(item);
  };

  return normalize(value) !== normalize(initialValue);
}

function getEntityLabel(title: string, actionLabel?: string) {
  if (actionLabel) {
    const normalized = actionLabel.replace(/^(Add|Create|Invite)\s+/i, "");
    if (normalized !== actionLabel) return normalized;
  }

  if (title === "Client Contacts") return "contact";
  return title.replace(/s$/, "").toLowerCase();
}

function getCheckboxGroupLabel(field: FieldConfig) {
  if (field.name === "is_active") return "Status";
  if (field.name === "is_primary") return "Primary contact";
  if (field.name === "can_login") return "Portal access";
  return null;
}

export function dateColumn(value?: string | null) {
  return <span className="text-muted-foreground">{formatDate(value)}</span>;
}
