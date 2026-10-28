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

- Run `npm run build` (vue-tsc + Vite) after changes.
- Run `npm test` for Playwright browser regressions; first install Chromium with `npx playwright install chromium`, or use installed Chrome via `PLAYWRIGHT_CHANNEL=chrome npm test` in Git Bash.
- Tests use isolated browser contexts and a Vite server at `127.0.0.1:4174`; they do not touch the user's normal browser data. Native Android behavior still requires device validation.
- There is no lint script. Read `DOC/PROGRESS.md` at the start and update it before ending a development session.

## Architecture

- This is a Vue 3 + TypeScript + Vite app using Element Plus for UI and Capacitor for native device integration.
- App bootstrap is minimal: `src/main.ts` creates the Vue app, installs `Element Plus` and the router, then mounts `src/App.vue`, which only hosts `router-view`.
- Routing lives in `src/router/index.ts`: `/` lists products; `/product/new` and `/product/:id` share the form; media/model routes cover product assets; `/video-entry` hosts offline batch candidate review.

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
- Web/Android can fall back to JS image signatures for similarity, not semantic labels. The current repository does not contain a native `VisualSearch` implementation.
- `isSemanticLabelingSupported()` checks runtime plugin availability. Never claim Android naming works just because the TypeScript interface exists; current Web naming is manual.

## Styling

- Global app tokens live in `src/theme/variables.css`.
- Shared global layout styles live in `src/style.css`.
- Each view keeps its own scoped styles inside the `.vue` file.

## Repository Notes

- `src/components/HelloWorld.vue` 与 Vite 模板 SVG 是残留文件,可清理;
- 2026-10-28 接续：本项目为 AgentMall 采集商品；视频录入页面和四字段表单已实现，15 项浏览器回归通过，安卓和微信端仍未联调。详见 `DOC/PROGRESS.md`。
- `android/` 已纳入仓库：当前 Java 文件为 `MainActivity` 和 `OfflineSpeechPlugin`，并无 VisualSearch 插件实现。
- 空库存/价格表示未知，不可补零或擅自四舍五入；视频候选必须人工确认名称，失败重试沿用固定 ID。
- CSV 只传五列，无图片/批发价；AgentMall 旧导入器存在表头/引号/空数值兼容问题，不能宣称销售端闭环已验证。
