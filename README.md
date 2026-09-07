# AitherFiles

AitherFiles is a lightweight, mobile-friendly browser file manager for AitherForge.

## Cloud storage

AitherFiles now uses **Puter.js cloud storage** instead of the old Render backend. Puter provides per-user cloud storage through its browser SDK, so AitherFiles does not need its own storage bucket, Render service, API key, or payment information. Puter documents browser-based authentication and cloud file operations through `puter.fs`.

Each signed-in user gets their own Puter storage space. AitherFiles keeps its files inside an `AitherFiles` folder and enforces a **3 GB AitherFiles app limit** before uploads.

## Features

- Clean Aither-style dark interface
- Responsive layout for iPhone, tablet, and desktop
- Puter cloud storage and authentication
- Upload files by picker or drag and drop
- Search and sort cloud files
- Recent, images, and documents filters
- Delete cloud files
- 3 GB AitherFiles app quota
- No Render backend required
- No Aither storage API key required
- GitHub Pages compatible

## How it works

AitherFiles loads Puter.js directly in the browser. When a user signs in, Puter handles authentication and scopes cloud storage to that user's account. Files are written to the user's Puter cloud storage under the `AitherFiles` directory.

## Run

Open `index.html` in a browser or publish the repository with GitHub Pages.

## Version

AitherFiles 2.0.0