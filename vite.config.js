import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/forexfactory": {
        target: "https://nfs.faireconomy.media",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/forexfactory/, "/ff_calendar_thisweek.json"),
      },
    },
  },
});
