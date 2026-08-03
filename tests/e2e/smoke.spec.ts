import { test, expect } from "@playwright/test";
test("صفحه ورود فارسی است", async ({ page }) => { await page.goto("/login"); await expect(page.locator("html")).toHaveAttribute("dir", "rtl"); await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible(); });
