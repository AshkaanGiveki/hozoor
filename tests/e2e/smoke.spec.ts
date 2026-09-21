import { test, expect } from "@playwright/test";

test("login page renders RTL authentication form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.getByRole("textbox").first()).toBeVisible();
  await expect(page.locator("main form button")).toBeVisible();
});
