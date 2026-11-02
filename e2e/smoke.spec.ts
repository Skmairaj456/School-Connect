import { expect, test, type Page } from "@playwright/test";

const greeting = /Good (morning|afternoon|evening)/i;

// With Supabase configured the sign-in screen appears first; live login only runs when E2E_LIVE=1.
async function openDashboard(page: Page) {
  await page.goto("/");
  const signIn = page.getByRole("button", { name: /^Sign in/i });
  const demoRole = page.getByLabel("Demo role");
  await expect(signIn.or(demoRole)).toBeVisible({ timeout: 15_000 });
  if (await signIn.isVisible()) {
    if (process.env.E2E_LIVE === "1") {
      await page.getByLabel("Email").fill("admin@school-connect.demo");
      await page.getByLabel("Password").fill("SchoolDemo!2026");
      await signIn.click();
    } else {
      await page.getByRole("button", { name: "Explore the interactive demo" }).click();
    }
  }
  await expect(page.getByRole("heading", { name: greeting })).toBeVisible();
}

test("demo role workflows remain usable on desktop and mobile", async ({ page }) => {
  await openDashboard(page);
  const demoRole = page.getByLabel("Demo role");
  if (await demoRole.count()) {
    await expect(page.getByText("DEMO MODE")).toBeVisible();
    await demoRole.selectOption("parent");
    await expect(page.getByRole("heading", { name: /, Ananya/i })).toBeVisible();
  } else {
    await expect(page.getByText("LIVE MODE")).toBeVisible();
    await expect(page.getByRole("heading", { name: greeting })).toBeVisible();
  }
  await page.getByRole("button", { name: "Syllabus tracker" }).click();
  await expect(page.getByRole("heading", { name: "Syllabus" })).toBeVisible();
  const updateButton = page.getByRole("button", { name: /Update Plant systems and growth/i });
  if (await updateButton.count()) {
    await updateButton.click();
    await page.reload();
    await page.getByRole("button", { name: "Syllabus tracker" }).click();
    await expect(page.getByText("In Progress").first()).toBeVisible();
  }
});

test("mobile navigation opens without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDashboard(page);
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
