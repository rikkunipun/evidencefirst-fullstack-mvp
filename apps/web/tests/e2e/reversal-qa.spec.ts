import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function loginAsResearcher(page: import("@playwright/test").Page) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim();
  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: list } = await supabase.auth.admin.listUsers();
  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())!;
  const password = randomBytes(12).toString("base64url");
  await supabase.auth.admin.updateUserById(user.id, { password });
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("reversal QA refuses an overbroad unsupported assertion and delivers zero factual claims", async ({ page }) => {
  await loginAsResearcher(page);
  const res = await page.request.post("/api/admin/reversal", {
    data: {
      submittedClaim: "Walking outside a gym guarantees identical muscle growth and perfect consistency for every person.",
      packId: "activity",
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.supported).toBe(false);
  expect(body.matchedClaimIds).toEqual([]);
  expect(body.refusalReceipt).not.toBeNull();
  expect(body.refusalReceipt.deliveredFactualClaims).toBe(0);
});

test("reversal QA confirms exact support for an actually-approved claim (membership check, not a false-positive refusal)", async ({ page }) => {
  await loginAsResearcher(page);
  const res = await page.request.post("/api/admin/reversal", {
    data: {
      submittedClaim: "WHO states that doing some physical activity is better than doing none.",
      packId: "activity",
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.supported).toBe(true);
  expect(body.matchedClaimIds).toEqual(["C1"]);
});

test("reversal QA rejects cross-pack text even if it is verbatim from a different enabled pack", async ({ page }) => {
  await loginAsResearcher(page);
  const res = await page.request.post("/api/admin/reversal", {
    data: {
      submittedClaim: "The 2013 review rated practice testing as having high utility for learning.",
      packId: "activity",
    },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.supported).toBe(false);
});
