import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env vars from `.env` files
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    define: {
      __FRONTEND_URL__: JSON.stringify(env.VITE_FRONTEND_URL),
    },
  }
})
