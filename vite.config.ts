import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/kw-timetable-2602/',
  server: {
    allowedHosts: ['ga111o-desktop'],
  },
})
