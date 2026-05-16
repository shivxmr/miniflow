"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import {
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/validation";
import { useAuth } from "./auth-context";
import { FormAlert } from "./form-alert";

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

/** The account creation form. On success the new user is signed straight in. */
export function SignupForm() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const nameError = validateName(name);
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    if (nameError || emailError || passwordError) {
      setFieldErrors({
        name: nameError ?? undefined,
        email: emailError ?? undefined,
        password: passwordError ?? undefined,
      });
      return;
    }

    setFieldErrors({});
    setFormError("");
    setSubmitting(true);
    try {
      await signup({ name: name.trim(), email: email.trim(), password });
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
          Create your account
        </h1>
        <p className="text-sm text-muted">
          Start planning projects with your team in minutes.
        </p>
      </header>

      {formError && <FormAlert message={formError} />}

      <Input
        label="Name"
        autoComplete="name"
        placeholder="Ada Lovelace"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={fieldErrors.name}
      />
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
        autoComplete="new-password"
        placeholder="At least 8 characters"
        hint="Use at least 8 characters."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password}
      />

      <Button type="submit" size="lg" fullWidth loading={submitting}>
        Create account
      </Button>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
