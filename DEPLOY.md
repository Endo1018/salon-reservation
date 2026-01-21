# System Connections & Deployment Guide

This file serves as the **SINGLE SOURCE OF TRUTH** for all system connections.
**Rule:** always verify these settings before diagnosing "not reflected" issues.

## 1. Connection Information (Critical)

### A. Git Repository
*   **Repository URL:** `https://github.com/Endo1018/salon-reservation.git`
*   **Production Branch:** `main`

### B. Vercel Project
*   **Project Name:** `webapp` (connected to `Endo1018/salon-reservation`)
*   **Project URL:** `https://webapp-mauve-rho.vercel.app` (Primary)
*   **Note:** If deployment is not triggered, check **Settings > Git** to ensure it is connected to `Endo1018/salon-reservation`.

### C. Database (Neon / PostgreSQL)
*   **Provider:** Neon (AWS us-east-1)
*   **Environment Variable Key:** `DATABASE_URL`
*   **Value (Production/Vercel):**
    ```text
    postgresql://neondb_owner:npg_bT2Uq3aVstod@ep-rough-bonus-ahqucvo1-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
    ```
    *(Set this in Vercel > Settings > Environment Variables)*

### D. Google Sheets Integration
*   **Service Account:** `your-service-account@example.com` (Check `.env.local` for `GOOGLE_CLIENT_EMAIL` and `GOOGLE_PRIVATE_KEY`)
*   **Spreadsheet ID:** `your_spreadsheet_id_here` (Check `.env.local` for `SPREADSHEET_ID`)
    *   *Required Permission:* The Service Account must be an **Editor** of this spreadsheet.

---

## 2. Deployment Steps

### Initial Setup (One-time)
1.  **Git Remote Setup**:
    ```bash
    git remote add origin https://github.com/Endo1018/salon-reservation.git
    git branch -M main
    ```

2.  **Vercel Connection**:
    *   Import repository `Endo1018/salon-reservation`.
    *   Add `DATABASE_URL` to Environment Variables.

### Routine Deployment (Update)
1.  **Commit & Push**:
    ```bash
    git add .
    git commit -m "feat: description of changes"
    git push origin main
    ```
2.  **Verify**:
    *   Check Vercel Dashboard for "Building" status.
    *   If not building, check the Git connection setting in Vercel.

## 3. Post-Deployment Checks
1.  **Staff Wage UI**: Verify `BHXH` is visible in `/admin/staff`.
2.  **Database**: Verify data persistence.

