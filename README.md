# Salon Reservation System

## 🚨 Deployment & Infrastructure Rules (Important)
To avoid confusion, please adhere to the following rules:

### 1. Vercel Project Configuration
- **Active Project**: `webapp` (https://webapp-mauve-rho.vercel.app)
  - *Do NOT use `salon-reservation` project on Vercel.*
- **Repository**: `Endo1018/salon-reservation`
- **Branch**: `main` (Auto-deploys on push)

### 2. Timezone Standards
- **System Time**: Vietnam Time (UTC+7)
- **Sync Logic**:
  - The "Google Sheet Sync" calculates "Yesterday" starting from **00:00 Vietnam Time**.
  - This ensures bookings made early in the morning (e.g., 01:00 AM) are correctly included in the current day/month scope.

### 3. Troubleshooting Sync
- If "Sync" seems to fail (no changes):
  - Check the **Black Toast Notification** at the bottom of the screen.
  - It will list **"Missing Services"** if the sheet contains service names that don't match the Database.
  - **Action**: Rename the service in the DB or the Sheet to match exactly.

## Status
- **Latest Update**: 2026-02-02 (Fixed Timezone Gap & Error Reporting)

## Overview
A Next.js application for salon reservation and staff management.
