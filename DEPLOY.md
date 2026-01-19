# Deployment Guide (Vercel + PostgreSQL)

Your application is now ready for the cloud! Follow these steps to publish it.

## 1. Create a GitHub Repository
1.  Go to [GitHub.com](https://github.com/new).
2.  Create a new repository (e.g., `spa-attendance-app`).
3.  Run the following commands in your terminal (`webapp` folder):

```bash
git remote add origin https://github.com/YOUR_USERNAME/spa-attendance-app.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Vercel
1.  Go to [Vercel.com](https://vercel.com/new).
2.  Import your `spa-attendance-app` repository.
3.  **Database Integration**:
    *   In the "Storage" section of the setup (or after created), click "Add" -> "Postgres".
    *   Accept the terms and create the database.
    *   Vercel will automatically add environment variables (`POSTGRES_URL` etc.) to your project.
4.  **Deploy**:
    *   Click "Deploy".
    *   Vercel will build your app and verify the database connection.

## 3. Post-Deployment Setup
Once the site is live:
1.  Go to the Vercel Project Dashboard.
2.  Click "Storage" -> "Browser" (or Query console).
3.  You need to "Seed" the initial data (Staff, etc.) or you can use the **Staff Management** page (`/admin/staff`) on the live site to create your first admin user.
    *   *Note: Since the database is fresh, it will be empty.*

---
**Troubleshooting**:
If the build fails on "Prisma Client", make sure you ran the `postinstall` script or Vercel's default "Install Command" (`npm install`) should handle it.
