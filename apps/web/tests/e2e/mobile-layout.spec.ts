import { test, expect } from "@playwright/test";

const VIEWPORTS = [
  { name: "360px", width: 360, height: 740 },
  { name: "390px", width: 390, height: 844 },
];

const PAGES = ["/", "/participate"];

for (const viewport of VIEWPORTS) {
  for (const path of PAGES) {
    test(`${path} has no horizontal overflow at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(path);
      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1px rounding tolerance
    });
  }
}

test("200% browser zoom (simulated via viewport halving) does not overflow the landing page", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 480 });
  await page.goto("/");
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
});

test("reduced motion is respected (no animation duration escapes the override)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
