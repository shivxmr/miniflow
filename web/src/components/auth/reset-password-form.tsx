"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { resetPassword } from "@/lib/auth-api";
import { validatePassword } from "@/lib/validation";
import { FormAlert } from "./form-alert";

interface FieldErrors {
  password?: string;
  confirm?: string;
}

/**
 * Sets a new password from a reset link. The token comes from the
 * `?token=` query param; on success we redirect to `/login?reset=1`, where the
 * sign-in form shows a confirmation toast.
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!token) {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
            Invalid reset link
          </h1>
          <p className="text-sm text-muted">
            This link is missing its token or is malformed. Request a new one to
            continue.
          </p>
        </header>
        <Link
          href="/forgot-password"
          className="inline-flex h-12 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-paper transition-colors hover:bg-accent/90"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const passwordError = validatePassword(password);
    const confirmError =
      password === confirm ? null : "Passwords do not match";
    if (passwordError || confirmError) {
      setFieldErrors({
        password: passwordError ?? undefined,
        confirm: confirmError ?? undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (caught) {
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
          Set a new password
        </h1>
        <p className="text-sm text-muted">
          Choose a strong password you don&apos;t use elsewhere.
        </p>
      </header>

      {formError && <FormAlert message={formError} />}

      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
      />
      <Input
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
        error={fieldErrors.confirm}
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Update password
      </Button>

      <p className="text-center text-sm text-muted">
        <Link
          href="/login"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
