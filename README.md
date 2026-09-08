# AitherFiles

AitherFiles is a lightweight, mobile-friendly browser file manager for AitherForge.

## Backend

AitherFiles uses **Firebase Authentication + MinIO**.

- **Firebase Spark** handles accounts and authentication.
- **MinIO** handles the actual file objects.
- The static web app can stay on GitHub Pages.
- A small Node API in `backend/` verifies Firebase ID tokens and talks to MinIO using private server credentials.
- Every user's objects live under `users/{Firebase UID}/`, and the API refuses access outside that prefix.
- The client enforces a **3 GB AitherFiles quota** before uploads.

This avoids Firebase Cloud Storage, so AitherFiles does not require Firebase Storage/Blaze for its file storage.

## Features

- Firebase Email/Password authentication
- Firebase Google authentication
- Private per-user MinIO storage
- Upload files by picker or drag and drop
- Search and sort cloud files
- Recent, images, and documents filters
- Open/download and delete cloud files
- 3 GB AitherFiles app quota
- Responsive iPhone, tablet, and desktop interface
- GitHub Pages compatible

## Firebase setup

1. Create a Firebase project on the Spark plan and register a Web App.
2. Enable **Authentication** and turn on Email/Password and/or Google sign-in.
3. Copy the Web App configuration into `firebase-config.js`.
4. Create a Firebase service account for the private backend. **Never put its JSON key in the GitHub Pages files.**

## MinIO setup

1. Run MinIO/AIStor Free on a machine or host you control. MinIO is S3-compatible object storage. The original MinIO Community Edition is now source-only/archived, while MinIO lists AIStor Free as the community standalone option.
2. Create a bucket named `aitherfiles` (the API can also create it automatically).
3. Create a MinIO access key with permission to the AitherFiles bucket.
4. Run `backend/` with these environment variables:

```text
PORT=8787
MINIO_ENDPOINT=your-minio-host.example.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=aitherfiles
AITHERFILES_ORIGIN=https://your-pages-domain.example
FIREBASE_SERVICE_ACCOUNT_JSON={...}
```

5. Install and start the API:

```bash
cd backend
npm install
npm start
```

6. Put the public HTTPS API URL in `minio-config.js`:

```js
const minio = {
  apiUrl: "https://your-aitherfiles-api.example.com"
};
export default minio;
```

7. Publish AitherFiles with GitHub Pages.

### Security

The browser never receives the MinIO secret key. It signs in with Firebase, sends its Firebase ID token to the API, and the API verifies that token before reading or changing objects. The API only allows a user to access keys beginning with their own `users/{Firebase UID}/` prefix.

## Version

AitherFiles 3.1.0 — Firebase Auth + MinIO storage migration
