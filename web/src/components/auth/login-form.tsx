"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api";
import { validateEmail } from "@/lib/validation";
import { useAuth } from "./auth-context";
import { FormAlert } from "./form-alert";

interface FieldErrors {
  email?: string;
  password?: string;
}

/** The sign-in form. On success the GuestGuard redirects to the dashboard. */
export function LoginForm() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Surface the "password updated" confirmation after a reset redirect, once.
  const announcedReset = useRef(false);
  useEffect(() => {
    if (searchParams.get("reset") === "1" && !announcedReset.current) {
      announcedReset.current = true;
      showToast({
        title: "Password updated",
        description: "Please log in with your new password.",
        tone: "success",
      });
    }
  }, [searchParams, showToast]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = password ? null : "Password is required";
    if (emailError || passwordError) {
      setFieldErrors({
        email: emailError ?? undefined,
        password: passwordError ?? undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // The GuestGuard observes the new auth status and redirects.
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        Object.keys(caught.fieldErrors).length > 0
      ) {
        setFieldErrors(caught.fieldErrors);
      } else {
        setFormError(
          caught instanceof ApiError
            ? caught.message
            : "Something went wrong. Please try again.",
        );
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-3xl leading-tight tracking-tight text-ink">
          Welcome back
        </h1>
        <p className="text-sm text-muted">
          Sign in to pick up where your team left off.
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
        error={fieldErrors.email}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
      />

      <div className="-mt-2 text-right">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-accent underline-offset-2 hover:underline"
        >
          Forgot password?
        </Link>
      </div>

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Sign in
      </Button>

      <p className="text-center text-sm text-muted">
        New to MiniFlow?{" "}
        <Link
          href="/signup"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
