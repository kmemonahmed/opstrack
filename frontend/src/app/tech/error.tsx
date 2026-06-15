"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/error-state";

export default function TechnicianError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState homeHref="/tech/work-orders" onAction={reset} />;
}
