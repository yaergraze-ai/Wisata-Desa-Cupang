import { test, expect } from "@playwright/test";

test.describe("Isolasi Peran & Otorisasi RBAC Antar Dashboard (§10.3)", () => {
  test("1. Pengunjung tanpa login dialihkan ke halaman masuk saat mengakses dashboard terlindungi", async ({
    page,
  }) => {
    // Member dashboard
    await page.goto("/dashboard");
    await page.waitForURL(/(\/masuk|\/id\/masuk)/, { timeout: 15000 });
    expect(page.url()).toContain("masuk");

    // Staff dashboard
    await page.goto("/dashboard/staff");
    await page.waitForURL(/(\/masuk|\/id\/masuk)/, { timeout: 15000 });
    expect(page.url()).toContain("masuk");

    // Admin dashboard
    await page.goto("/dashboard/admin");
    await page.waitForURL(/(\/masuk|\/id\/masuk)/, { timeout: 15000 });
    expect(page.url()).toContain("masuk");

    // Super Admin dashboard
    await page.goto("/dashboard/super-admin");
    await page.waitForURL(/(\/masuk|\/id\/masuk)/, { timeout: 15000 });
    expect(page.url()).toContain("masuk");
  });

  test("2. Akun Petugas Lapangan (STAFF) dibatasi dari Dashboard Admin dan Super Admin", async ({
    page,
  }) => {
    // Login sebagai staf
    await page.goto("/masuk?next=%2Fdashboard%2Fstaff");
    await page.waitForLoadState("networkidle");
    await page.fill("#login-email", "staff.batulawang@wisatacirebon.id");
    await page.fill("#login-password", "Petugas#Cirebon2026!");
    await page.click("button[type=submit]");

    // Berhasil masuk ke dashboard staff
    await page.waitForURL(/\/dashboard\/staff/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard/staff");

    // Coba buka Dashboard Admin -> otomatis dialihkan ke perannya (/dashboard/staff)
    await page.goto("/dashboard/admin");
    await page.waitForURL(/\/dashboard\/staff/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard/staff");

    // Coba buka Dashboard Super Admin -> otomatis dialihkan ke perannya (/dashboard/staff)
    await page.goto("/dashboard/super-admin");
    await page.waitForURL(/\/dashboard\/staff/, { timeout: 15000 });
    expect(page.url()).toContain("/dashboard/staff");
  });

  test("3. Akun Super Admin memiliki akses penuh ke Dashboard Admin dan Tata Kelola Super Admin", async ({
    page,
  }) => {
    // Login Super Admin
    await page.goto("/masuk?next=%2Fdashboard%2Fadmin");
    await page.waitForLoadState("networkidle");
    await page.fill("#login-email", "superadmin@wisatacirebon.id");
    await page.fill("#login-password", "SuperAdmin#Cirebon2026!");
    await page.click("button[type=submit]");

    // Navigasi ke Dashboard Admin
    await page.waitForURL(/\/dashboard\/admin/, { timeout: 15000 });
    await expect(page.locator("[data-testid='admin-dashboard-client']")).toBeVisible({ timeout: 15000 });

    // Navigasi ke Dashboard Super Admin
    await page.goto("/dashboard/super-admin");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-testid='super-admin-dashboard-client']")).toBeVisible({ timeout: 15000 });
  });
});
