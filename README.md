# Expense Tracker Web

React + TypeScript + Vite web version of the Android Expense Tracker app.

## Setup

1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Run:

```bash
npm install
```

4. Create `.env` from `.env.example`:

```bash
copy .env.example .env
```

5. Put your Supabase URL and anon key in `.env`.

6. In Supabase Dashboard > Authentication > URL Configuration, add:

```txt
http://localhost:5173/auth/callback
```

Later, also add your deployed domain callback URL.

7. Start development server:

```bash
npm run dev
```

8. Open:

```txt
http://localhost:5173
```

## Build

```bash
npm run build
npm run preview
```

## Notes

- Uses the same Supabase tables as the Android app.
- Keeps browser secrets safe by using only the anon key through Vite env variables.
- Browser daily reminders work while the web app is open. For reliable closed-browser push notifications, add a proper PWA/service-worker push flow later.
