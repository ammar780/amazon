# TVS Incident Response System v2.0

Amazon SP-API Incident Response & Compliance Dashboard for **The Vitamin Shots**.

Built to address all three Amazon SP-API rejection points.

## Deploy to Railway

### Step 1 — Push to GitHub

```bash
cd tvs-incident-response
git init
git add .
git commit -m "TVS Incident Response System v2.0"
gh repo create tvs-incident-response --private --source=. --push
```

### Step 2 — Create Railway Project

1. Go to https://railway.app → **New Project**
2. Click **Deploy from GitHub repo** → select `tvs-incident-response`
3. Click **+ New** → **Database** → **Add PostgreSQL**
4. Click on the PostgreSQL service → **Connect** → copy `DATABASE_URL`
5. Click on your app service → **Variables** tab → **Raw Editor** → paste:

```
DATABASE_URL=your-postgresql-url-from-step-4
JWT_SECRET=run-openssl-rand-hex-32-to-generate
NODE_ENV=production
ADMIN_EMAIL=devin@thevitaminshots.com
ADMIN_PASSWORD=YourSecurePassword
ADMIN_NAME=Devin
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
ORG_NAME=The Vitamin Shots
ORG_DOMAIN=thevitaminshots.com
ORG_CONTACT_EMAIL=support@thevitaminshots.com
AMAZON_SECURITY_EMAIL=security@amazon.com
```

6. Railway auto-deploys. Wait for the build to finish (~2 min).
7. Go to **Settings** → **Networking** → **Generate Domain** to get your public URL.

### Step 3 — Set Up Your System

1. Open your Railway URL → login with ADMIN_EMAIL / ADMIN_PASSWORD
2. **IRT Roles** → Add 5 team members (Incident Commander, Security Lead, Communications Lead, Operations Lead, Compliance Officer)
3. **Encryption Audit** → Click "Scan All Endpoints"
4. **6-Month Reviews** → Record your first review (version 1.0, check all boxes)
5. **Compliance** → Check off all items that are met
6. **Screenshot every page** for your Amazon submission

## Local Development

```bash
# Install
npm install
cd client && npm install --legacy-peer-deps && cd ..

# Set up environment
cp .env.example .env
# Edit .env with your local PostgreSQL URL

# Run
node server/index.js
# Frontend: cd client && npm start
```
