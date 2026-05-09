# Invoice Generator — quick reference

This project is a **React + Vite** invoice builder. Use the steps below to run it locally.

## Prerequisites

- [Node.js](https://nodejs.org/) **18+** (LTS recommended)
- npm (comes with Node)

## Install

From the project root:

```bash
npm install
```

## Development server

```bash
npm run dev
```

Then open the URL shown in the terminal (usually `http://localhost:5173`).

## Production build

```bash
npm run build
```

Output is written to the `dist/` folder.

## Preview the production build locally

```bash
npm run preview
```

## Branding

- The page title, favicon, and header logo are set in `index.html` and use `public/logo.svg`. Replace that file or update the `<img>` / `<link rel="icon">` paths in `index.html` to use your own asset.

## Features (short)

- Fill bill-from / bill-to, line items, tax, discount, currency
- The browser **tab title** updates to `Your company name · Invoice Generator` when Bill from has a name
- **Review Invoice** opens a modal preview
- **Download Invoice** saves a **PDF** file
- Data for saved invoices is stored in the browser (`localStorage`)

## Troubleshooting

- If `npm install` fails, check your Node version (`node -v`) and try again on a stable network.
