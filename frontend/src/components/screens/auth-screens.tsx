"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import { LoadingBlock } from "@/components/ui/loading";

const loginSchema = z.object({
  email: z.email("Enter a valid work email address."),
  password: z.string().min(1, "Enter your password to continue."),
});

const registerSchema = z
  .object({
    organization_name: z.string().min(2, "Enter your company or service organization name."),
    organization_email: z.email("Enter a valid business email.").optional().or(z.literal("")),
    organization_phone: z.string().optional(),
    organization_website: z.url("Enter a complete website URL, including https://.").optional().or(z.literal("")),
    organization_address: z.string().optional(),
    full_name: z.string().min(2, "Enter the owner's full name."),
    email: z.email("Enter a valid owner email address."),
    phone: z.string().optional(),
    password: z.string().min(8, "Use at least 8 characters for account security."),
    password_confirm: z.string().min(8, "Confirm the password before creating the workspace."),
  })
  .refine((data) => data.password === data.password_confirm, {
    path: ["password_confirm"],
    message: "The confirmation does not match the password.",
  });

export function LoginScreen() {
  const auth = useAuth();
  const isCheckingSession = useAuthenticatedRedirect();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "owner@techcare.test", password: "Test@12345" },
  });

  if (isCheckingSession) return <AuthLoading />;

  return (
    <AuthFrame title="Welcome back" subtitle="Access your operations workspace and keep service work moving.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => auth.login(values))}>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input autoComplete="email" {...form.register("email")} />
        </Field>
        <Field label="Password" error={form.formState.errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...form.register("password")} />
        </Field>
        <Button className="mt-2 w-full" disabled={form.formState.isSubmitting}>
          Open workspace
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Setting up Maintolio for your team?{" "}
        <Link className="font-medium text-primary" href="/register">
          Create a workspace
        </Link>
      </p>
    </AuthFrame>
  );
}

export function RegisterScreen() {
  const auth = useAuth();
  const isCheckingSession = useAuthenticatedRedirect();
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      organization_name: "",
      organization_email: "",
      organization_phone: "",
      organization_website: "",
      organization_address: "",
      full_name: "",
      email: "",
      phone: "",
      password: "",
      password_confirm: "",
    },
  });

  if (isCheckingSession) return <AuthLoading />;

  return (
    <AuthFrame title="Create your workspace" subtitle="Start with the company account and the first owner profile.">
      <form className="space-y-4" onSubmit={form.handleSubmit((values) => auth.register(values))}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Organization name" error={form.formState.errors.organization_name?.message}>
            <Input {...form.register("organization_name")} />
          </Field>
          <Field label="Organization email" error={form.formState.errors.organization_email?.message}>
            <Input {...form.register("organization_email")} />
          </Field>
          <Field label="Organization phone">
            <Input {...form.register("organization_phone")} />
          </Field>
          <Field label="Website" error={form.formState.errors.organization_website?.message}>
            <Input {...form.register("organization_website")} />
          </Field>
        </div>
        <Field label="Address">
          <Textarea {...form.register("organization_address")} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Owner name" error={form.formState.errors.full_name?.message}>
            <Input {...form.register("full_name")} />
          </Field>
          <Field label="Owner email" error={form.formState.errors.email?.message}>
            <Input {...form.register("email")} />
          </Field>
          <Field label="Phone">
            <Input {...form.register("phone")} />
          </Field>
          <Field label="Password" error={form.formState.errors.password?.message}>
            <Input type="password" {...form.register("password")} />
          </Field>
          <Field label="Confirm password" error={form.formState.errors.password_confirm?.message}>
            <Input type="password" {...form.register("password_confirm")} />
          </Field>
        </div>
        <Button className="mt-2 w-full" disabled={form.formState.isSubmitting}>
          Create secure workspace
        </Button>
      </form>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already managing service work in Maintolio?{" "}
        <Link className="font-medium text-primary" href="/login">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}

function useAuthenticatedRedirect() {
  const auth = useAuth();
  const router = useRouter();
  const mounted = useClientMounted();
  const redirectPath = auth.user
    ? auth.isClientContact
      ? "/client/requests"
      : auth.isTechnician
        ? "/tech/work-orders"
        : "/app/dashboard"
    : null;

  useEffect(() => {
    if (mounted && !auth.isLoading && redirectPath) router.replace(redirectPath);
  }, [auth.isLoading, mounted, redirectPath, router]);

  return !mounted || auth.isLoading || Boolean(redirectPath);
}

function useClientMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

function AuthLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f2f6f7] p-4">
      <LoadingBlock label="Opening Maintolio" />
    </main>
  );
}

function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen bg-[#f2f6f7] lg:grid-cols-[0.95fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-[#102027] px-10 py-8 text-white lg:flex lg:flex-col lg:gap-6 xl:py-12 xl:gap-12 2xl:gap-16">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(72,190,205,0.28),transparent_28%),radial-gradient(circle_at_80%_10%,rgba(247,181,87,0.18),transparent_24%)]" />
        <div className="relative flex">
          <div className="flex h-28 w-[34rem] max-w-full items-center overflow-hidden rounded-xl bg-white shadow-xl shadow-cyan-950/20 ring-1 ring-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/maintolio-logo.svg" alt="Maintolio" className="h-full w-full scale-[1.28] object-contain object-center" />
          </div>
        </div>
        <div className="relative flex-1">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9bcbd4]">Built for field service teams</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold leading-[1.05] xl:mt-6 xl:text-5xl">
            A calmer way to run client service operations.
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-6 text-[#d7eef2] xl:mt-6 xl:text-base xl:leading-7">
            Coordinate requests, assign technicians, track assets, and keep client teams informed from one secure workspace.
          </p>
          <div className="mt-5 grid max-w-xl grid-cols-3 gap-3 xl:mt-10">
            {[
              ["24/7", "request visibility"],
              ["Role-based", "team access"],
              ["Live", "workflow alerts"],
            ].map(([value, label]) => (
              <div key={value} className="rounded-lg border border-white/12 bg-white/8 p-3 backdrop-blur xl:p-4">
                <p className="text-xl font-semibold xl:text-2xl">{value}</p>
                <p className="mt-1 text-xs text-[#b8dce3]">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative grid grid-cols-3 gap-3 text-xs text-[#d7eef2] xl:text-sm">
          {["Tenant isolation", "Audit-ready updates", "Client portal"].map((item) => (
            <span key={item} className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-[#61d4c0]" />
              {item}
            </span>
          ))}
        </div>
      </section>
      <section className="flex items-center justify-center px-4 py-10">
        <Card className="premium-panel w-full max-w-xl border-[#d6e4e7]">
          <CardContent className="p-6 md:p-8">
            <div className="mb-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-[#e4f3f5] text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
            </div>
            {children}
          </CardContent>
        </Card>
      </section>
    </main>
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
