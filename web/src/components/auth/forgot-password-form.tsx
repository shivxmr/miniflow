"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { forgotPassword } from "@/lib/auth-api";
import { validateEmail } from "@/lib/validation";
import { FormAlert } from "./form-alert";

/**
 * Requests a password-reset link. The backend never reveals whether the email
 * is registered, so on success we always show the same neutral confirmation.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const emailError = validateEmail(email);
    if (emailError) {
      setFieldError(emailError);
      return;
    }

    setFieldError(undefined);
    setFormError("");
    setSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (caught) {
      setFormError(
        caught instanceof ApiError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
            Check your email
          </h1>
          <p className="text-sm text-muted">
            If an account exists for <span className="text-ink">{email.trim()}</span>,
            we&apos;ve sent a link to reset your password. The link expires in 15
            minutes.
          </p>
        </header>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
          Forgot your password?
        </h1>
        <p className="text-sm text-muted">
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </header>

      {formError && <FormAlert message={formError} />}

      <Input
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldError}
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Send reset link
      </Button>

      <p className="text-center text-sm text-muted">
        Remembered it?{" "}
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
