# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — start the Vite dev server on `0.0.0.0:5173`.
- `npm run build` — run `vue-tsc` type-checking and produce the production build in `dist/`.
- `npm run preview` — preview the built app locally.
- `npm run sync:android` — build the web app and sync Capacitor assets into Android.
- `npm run open:android` — open the Android project in Android Studio.
- `npm run run:android` — build and run the app on Android through Capacitor.

## Verification

- There is no test runner or lint script configured in `package.json`.
- The main automated verification currently available is `npm run build`.

## Architecture

- This is a Vue 3 + TypeScript + Vite app using Element Plus for UI and Capacitor for native device integration.
- App bootstrap is minimal: `src/main.ts` creates the Vue app, installs `Element Plus` and the router, then mounts `src/App.vue`, which only hosts `router-view`.
- Routing lives in `src/router/index.ts` and is intentionally small: `/` shows the product list, `/product/new` creates a product, and `/product/:id` edits an existing product using the same form page.

## Product Flow

- `src/views/ProductListPage.vue` is the main screen. It loads products, handles text search, toggles between card/list layouts, imports/exports backup JSON, and drives photo-based search.
- `src/views/ProductFormPage.vue` owns create/edit/delete flows for a single product, including image capture, attachment upload, field validation, and persistence.
- The list page refreshes on `onMounted`; because the app now uses a plain `router-view`, navigating back from the form remounts the list and reloads persisted data.

## Data and Storage

- `src/services/product-store.ts` is the persistence boundary. On web it stores the full product list in Capacitor Preferences as JSON; on native platforms it uses `@capacitor-community/sqlite` with `products` and `product_visual_index` tables.
- The storage path diverges by platform, so storage-related fixes usually belong in `product-store.ts` instead of the view components.
- `src/types/product.ts` defines the core domain model. `StoredFile` is part of `Product`, so file metadata is persisted together with each product record.

## File Handling and Backup

- `src/services/file-service.ts` abstracts file persistence, preview/open behavior, backup export, and backup restore.
- On web, stored files are kept as data URLs inside the product model. On native platforms, files are written under Capacitor `Directory.Data`, and the model stores filesystem-relative paths.
- `src/services/backup-service.ts` exports a JSON payload with embedded base64 file contents and imports by fully replacing existing products via `replaceAllProducts()`.

## Visual Search

- `src/services/visual-search-service.ts` registers a custom Capacitor plugin named `VisualSearch` and only enables it on Android (`Capacitor.getPlatform() === 'android'`).
- Visual search works by extracting labels from an image, storing per-product label indexes in `product_visual_index`, and ranking matches by label-overlap similarity.
- The web app intentionally treats visual search as unsupported. If work touches this area, expect the native Android plugin implementation to matter even though it is not present in this repository.

## Styling

- Global app tokens live in `src/theme/variables.css`.
- Shared global layout styles live in `src/style.css`.
- Each view keeps its own scoped styles inside the `.vue` file.

## Repository Notes

- `README.md` is still the default Vite/Vue starter README and does not document this app.
- `src/components/HelloWorld.vue` and the Vite SVG assets are starter-template leftovers and are not part of the product-management flow.
- There is currently no checked-in `android/` project directory, even though Capacitor Android commands are configured in `package.json`.
