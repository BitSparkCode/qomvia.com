import { afterEach, describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "@/lib/admin";

const original = process.env.ADMIN_EMAILS;

afterEach(() => {
  process.env.ADMIN_EMAILS = original;
});

describe("staff allowlist", () => {
  it("is empty unless the environment names someone", () => {
    delete process.env.ADMIN_EMAILS;
    expect(adminEmails()).toEqual([]);
    expect(isAdminEmail("someone@example.com")).toBe(false);
  });

  it("matches case-insensitively across a comma list", () => {
    process.env.ADMIN_EMAILS = " Owner@Example.com , staff@example.com ";
    expect(adminEmails()).toEqual(["owner@example.com", "staff@example.com"]);
    expect(isAdminEmail("OWNER@example.com")).toBe(true);
    expect(isAdminEmail("owner@example.com.evil.test")).toBe(false);
  });
});
