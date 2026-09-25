import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [tailwindcss()],
  resolve: { alias: { "@": new URL("../src", import.meta.url).pathname } },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://test.supabase.invalid"),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify("test-key"),
  },
  server: { host: "127.0.0.1", port: 4179, strictPort: true },
});
