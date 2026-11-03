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
  await expect(page.getByRole("heading", { name: greeting })).toBeVisible({ timeout: 20_000 });
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

test("safety chain catches a missed child and clears once every child is accounted for", async ({ page }) => {
  test.skip(process.env.E2E_LIVE === "1", "Safety Chain uses sample riders in live mode");
  await openDashboard(page);
  await page.getByRole("button", { name: "Reset data" }).click();
  await expect(page.getByRole("button", { name: /2 safety alerts/ })).toBeVisible();
  await page.getByRole("button", { name: /2 safety alerts/ }).click();
  await expect(page.getByText("Ishaan Rao was never scanned off the bus")).toBeVisible();
  await expect(page.getByText("Kabir Nair reached school but is marked absent")).toBeVisible();

  await page.getByLabel("Demo role").selectOption("driver");
  await page.locator("nav .nav-item", { hasText: "Safety Chain" }).click();
  const confirm = page.getByRole("button", { name: "Confirm bus is empty" });
  await expect(confirm).toBeDisabled();
  await page.getByRole("button", { name: "Scan off" }).click();
  for (const step of ["Walked to the last row", "Checked under every seat", "Checked the back door and luggage area"]) await page.getByLabel(step).check();
  await confirm.click();
  await expect(page.getByText("No children on board")).toBeVisible();
  await page.getByLabel("Handover code for Meera Mehta").fill("0000");
  await page.getByRole("button", { name: "Release" }).first().click();

  await page.getByLabel("Demo role").selectOption("administrator");
  await page.locator("nav .nav-item", { hasText: "Safety Chain" }).click();
  await expect(page.getByText("Ishaan Rao was never scanned off the bus")).toHaveCount(0);
  await page.getByRole("button", { name: /Found in class/ }).click();
  await expect(page.getByText("Kabir Nair reached school but is marked absent")).toHaveCount(0);
});
