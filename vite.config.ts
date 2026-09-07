import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Na GitHub Pages aplikacja stoi pod https://tbitowt.github.io/Zadaniomat/,
  // więc odwołania do zasobów muszą zawierać ten podkatalog. Lokalnie zostaje
  // adres główny, bo scripts/ui.mjs puka do http://localhost:5199/.
  base: process.env.GITHUB_ACTIONS ? '/Zadaniomat/' : '/',
  plugins: [react()],
})
