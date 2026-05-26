# Company Email Sender Setup

Use this guide when you want OTP and booking emails to show a branded sender such as:

`Nearby Helper <support@yourdomain.com>`

## What You Need

1. A domain name
   Example: `yourdomain.com`
2. A real mailbox on that domain
   Example: `support@yourdomain.com`
3. SMTP credentials for that mailbox

## Environment Variables

Update `server/.env` with your mail provider details:

```env
BUSINESS_NAME=Nearby Helper
EMAIL_FROM_NAME=Nearby Helper
SUPPORT_EMAIL=support@yourdomain.com

SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=support@yourdomain.com
SMTP_PASS=your_smtp_password
SMTP_FROM=support@yourdomain.com

GMAIL_USER=
GMAIL_PASSWORD=
```

## Google Workspace Example

If your domain mailbox is hosted on Google Workspace:

```env
BUSINESS_NAME=Nearby Helper
EMAIL_FROM_NAME=Nearby Helper
SUPPORT_EMAIL=support@yourdomain.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=support@yourdomain.com
SMTP_PASS=your_google_app_password
SMTP_FROM=support@yourdomain.com

GMAIL_USER=
GMAIL_PASSWORD=
```

Notes:
- Turn on 2-Step Verification for the mailbox.
- Create an App Password.
- Use the App Password in `SMTP_PASS`.

## Gmail Personal Account Example

If you only have a Gmail account right now, the app can still show the company display name:

```env
BUSINESS_NAME=Nearby Helper
EMAIL_FROM_NAME=Nearby Helper
SUPPORT_EMAIL=yourgmail@gmail.com

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

GMAIL_USER=yourgmail@gmail.com
GMAIL_PASSWORD=your_gmail_app_password
```

This will usually show a branded sender name, but the underlying email address will still be your Gmail address.

## Important Limitation

You cannot make emails truly come from `support@yourdomain.com` unless that mailbox really exists and you have valid SMTP credentials for it.

## After Updating

1. Save `server/.env`
2. Restart the backend server
3. Test forgot-password or booking email delivery

## SMS OTP Note

SMS sender identity is controlled by Twilio and telecom routes. It does not use your email sender settings.
