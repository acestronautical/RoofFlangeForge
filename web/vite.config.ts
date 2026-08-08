import { defineConfig } from "vite";

// The site is served at https://acestronautical.github.io/RoofFlangeForge/
// once deployed. Set the base path so all bundled asset URLs and
// `import.meta.env.BASE_URL` resolve to that prefix; `/` in local dev keeps
// `npm run dev` friction-free. Electron builds load index.html from file://
// so they need relative asset URLs -- opt in with ELECTRON=1.
export default defineConfig(({ command }) => ({
    base: process.env.ELECTRON
        ? "./"
        : command === "build" ? "/RoofFlangeForge/" : "/",
    build: {
        target: "es2022",
        sourcemap: true,
    },
    server: {
        port: 5173,
    },
}));
