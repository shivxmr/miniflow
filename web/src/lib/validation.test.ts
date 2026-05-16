import { describe, expect, it } from "vitest";

import { validateEmail, validateName, validatePassword } from "./validation";

describe("validateEmail", () => {
  it("requires a value", () => {
    expect(validateEmail("")).toBe("Email is required");
    expect(validateEmail("   ")).toBe("Email is required");
  });

  it("rejects malformed addresses", () => {
    expect(validateEmail("notanemail")).toBe("Enter a valid email address");
    expect(validateEmail("missing@tld")).toBe("Enter a valid email address");
    expect(validateEmail("@nolocal.com")).toBe("Enter a valid email address");
  });

  it("accepts a well-formed address, ignoring surrounding whitespace", () => {
    expect(validateEmail("ada@example.com")).toBeNull();
    expect(validateEmail("  ada@example.com  ")).toBeNull();
  });
});

describe("validatePassword", () => {
  it("requires a value", () => {
    expect(validatePassword("")).toBe("Password is required");
  });

  it("enforces a minimum length of 8 characters", () => {
    expect(validatePassword("short12")).toBe(
      "Password must be at least 8 characters",
    );
  });

  it("accepts a password of at least 8 characters", () => {
    expect(validatePassword("longenough")).toBeNull();
  });
});

describe("validateName", () => {
  it("requires a non-empty value", () => {
    expect(validateName("")).toBe("Name is required");
    expect(validateName("   ")).toBe("Name is required");
  });

  it("rejects names longer than 120 characters", () => {
    expect(validateName("a".repeat(121))).toBe(
      "Name must be 120 characters or fewer",
    );
  });

  it("accepts a reasonable name", () => {
    expect(validateName("Ada Lovelace")).toBeNull();
  });
});
