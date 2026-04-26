# GTNH Calculator · Hosting Package

This package is ready for static hosting and does not require a build step.

## What is included

- Built web files (`index.html`, `*.js`, `assets/`)
- `resource.config.js` (default CDN mode)
- Empty `data/` folder (no `data.bin` / `atlas.webp` payload)

## Default behavior

By default, this package loads data from:

`https://cdn.jsdelivr.net/gh/KZdavid/gtnh-calc-data-zh-CN@GTNH-2.8.4/`

You can change this in `resource.config.js`.

## Switch to local data mode

1. Edit `resource.config.js`:
   - Set `resourceBaseUrl` to `""`
2. Put files into `data/`:
   - `data.bin`
   - `atlas.webp`

Reference config is also provided in `resource.config.local.example.js`.

## Deploy

Upload all files in this package to your static server root.
No Node.js or build command is required.
