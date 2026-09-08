# AitherFiles

AitherFiles is a lightweight, mobile-friendly browser file manager for AitherForge.

## Firebase backend

AitherFiles now uses **Firebase Authentication + Cloud Storage** as its primary cloud backend. The web app remains compatible with GitHub Pages because the Firebase Web SDK runs directly in the browser.

Each signed-in user gets an isolated storage namespace under `users/{Firebase UID}/`. Firebase Storage Rules restrict reads and writes to the authenticated user's own UID. AitherFiles also enforces a **3 GB app-level quota** in the client before uploads.

## Features

- Firebase Email/Password authentication
- Firebase Google authentication
- Per-user private Firebase Storage
- Upload files by picker or drag and drop
- Search and sort cloud files
- Recent, images, and documents filters
- Open and delete cloud files
- 3 GB AitherFiles app quota
- Responsive iPhone, tablet, and desktop interface
- GitHub Pages compatible
- No Render backend required for the browser app

## Firebase setup

1. Create a Firebase project and register a Web App.
2. Enable **Authentication** and turn on Email/Password and/or Google sign-in.
3. Create/enable **Cloud Storage**.
4. Copy the Web App configuration into `firebase-config.js`.
5. Deploy the rules in `storage.rules` to your Firebase Storage bucket.
6. Add your GitHub Pages domain to Firebase Authentication's authorized domains if Firebase asks for it.

The Firebase Web configuration is intentionally stored client-side. The API key in a Firebase Web App config is not a server secret; access control comes from Firebase Authentication and Storage Rules.

## Run

Open `index.html` in a browser or publish the repository with GitHub Pages after completing Firebase setup.

## Version

AitherFiles 3.0.0 — Firebase backend migration
