/**
 * Client-side form validation. Mirrors the backend Pydantic constraints
 * (see api/app/schemas/auth.py) so users get immediate feedback, but the
 * server stays the source of truth.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PASSWORD_MIN_LENGTH = 8;
const NAME_MAX_LENGTH = 120;
const PROJECT_NAME_MAX_LENGTH = 160;
const PROJECT_DESCRIPTION_MAX_LENGTH = 2000;

/** Returns an error message, or `null` when the email is valid. */
export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) {
    return "Email is required";
  }
  if (!EMAIL_PATTERN.test(email)) {
    return "Enter a valid email address";
  }
  return null;
}

/** Returns an error message, or `null` when the password is valid. */
export function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required";
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  }
  return null;
}

/** Returns an error message, or `null` when the name is valid. */
export function validateName(value: string): string | null {
  const name = value.trim();
  if (!name) {
    return "Name is required";
  }
  if (name.length > NAME_MAX_LENGTH) {
    return `Name must be ${NAME_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

/** Returns an error message, or `null` when the project name is valid. */
export function validateProjectName(value: string): string | null {
  const name = value.trim();
  if (!name) {
    return "Project name is required";
  }
  if (name.length > PROJECT_NAME_MAX_LENGTH) {
    return `Name must be ${PROJECT_NAME_MAX_LENGTH} characters or fewer`;
  }
  return null;
}

/** Returns an error message, or `null` when the project description is valid. */
export function validateProjectDescription(value: string): string | null {
  if (value.length > PROJECT_DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${PROJECT_DESCRIPTION_MAX_LENGTH} characters or fewer`;
  }
  return null;
}
