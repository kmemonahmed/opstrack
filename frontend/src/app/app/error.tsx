"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function CompanyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState homeHref="/app/dashboard" onAction={reset} />;
}
