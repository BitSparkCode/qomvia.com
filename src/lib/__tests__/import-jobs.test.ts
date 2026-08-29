import { describe, expect, it } from "vitest";
import { MAX_WATCHED_PRODUCTS, productBudget } from "@/lib/products/jobs";
import { MAX_IMPORT_PRODUCTS } from "@/lib/products/parse";
import { CLAIM_MAILBOXES } from "@/lib/stores/claim";

describe("import budgets", () => {
  it("samples a competitor instead of mirroring it", () => {
    expect(productBudget("watched")).toBe(MAX_WATCHED_PRODUCTS);
    expect(productBudget("owned")).toBe(MAX_IMPORT_PRODUCTS);
    expect(MAX_WATCHED_PRODUCTS).toBeLessThan(MAX_IMPORT_PRODUCTS);
  });

  it("treats an unknown kind as watched, so an unproved store cannot pull the large budget", () => {
    expect(productBudget("something-else")).toBe(MAX_WATCHED_PRODUCTS);
  });
});

describe("ownership proof", () => {
  it("accepts only administrative mailboxes", () => {
    expect(CLAIM_MAILBOXES).toContain("admin");
    expect(CLAIM_MAILBOXES).not.toContain("marketing");
    expect(CLAIM_MAILBOXES.every((mailbox) => /^[a-z]+$/.test(mailbox))).toBe(true);
  });
});
