import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("judge flow locates and verifies the concurrency gap", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Passing tests/ })).toBeVisible();
  await page.getByRole("button", { name: "Analyze the change" }).click();
  await expect(page.getByText("Bundled reference replay · not a live run")).toBeVisible();
  await expect(page.getByText("Unproven · R3")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("proof-gap.png"), fullPage: true });
  await page.getByRole("button", { name: "Generate falsifying test" }).click();
  const bench = page.getByRole("complementary", { name: "Test the weakest claim" });
  await expect(bench.getByText("Counterexample confirmed", { exact: true })).toBeVisible();
  await expect(page.getByText(/Both requests succeed/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("counterexample.png"), fullPage: true });
});

test("exact evidence is keyboard reachable", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Analyze the change" })).toBeFocused();
  await page.keyboard.press("Enter");
  const evidence = page.getByRole("button", { name: /tests\/seat-service\.test\.ts:13/ });
  for (let step = 0; step < 6 && !(await evidence.evaluate((element) => element === document.activeElement)); step += 1) await page.keyboard.press("Tab");
  await expect(evidence).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Server-validated source excerpt" })).toBeVisible();
  await expect(page.getByText("Exact bytes matched")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(evidence).toBeFocused();
});

test("tablet layout keeps the verification bench usable", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze the change" }).click();
  await expect(page.getByRole("heading", { name: "Test the weakest claim" })).toBeVisible();
  const verifyButton = page.getByRole("button", { name: "Generate falsifying test" });
  await verifyButton.scrollIntoViewIfNeeded();
  await expect(verifyButton).toBeInViewport();
});

test("replay state has no detectable WCAG A or AA violations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze the change" }).click();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(results.violations).toEqual([]);
});

test("reduced motion and narrow layouts remain stable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze the change" }).click();
  const metrics = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth, behavior: getComputedStyle(document.documentElement).scrollBehavior }));
  expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.behavior).toBe("auto");
});

test("retryable API errors offer an honest replay fallback", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Temporary test outage" }) }));
  await page.goto("/");
  await page.getByRole("button", { name: "Analyze the change" }).click();
  await expect(page.locator(".error-state")).toContainText("Temporary test outage");
  await expect(page.getByRole("button", { name: "Replay bundled reference run" })).toBeVisible();
});
