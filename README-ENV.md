# Environment Setup

To connect the Web App to your Google Sheet, you need to create a `.env.local` file in the `webapp` folder with the following keys:

```bash
GOOGLE_CLIENT_EMAIL=your-service-account@example.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
SPREADSHEET_ID=your_spreadsheet_id_here
```

## How to get credentials:
1. Go to Google Cloud Console.
2. Create a Service Account.
3. Download the JSON key.
4. Enable "Google Sheets API".
5. Share your Spreadsheet with the `client_email` address (Give "Editor" permission).
