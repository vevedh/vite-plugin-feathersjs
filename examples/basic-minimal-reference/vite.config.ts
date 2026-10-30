import { defineConfig } from 'vite'
import feathers from 'vite-plugin-feathersjs'

export default defineConfig({
  plugins: [feathers({
    serviceFiles: 'server/**/*.ts',
    adapter: 'koa', // change to 'express' to use the other HTTP adapter
    prefix: '/api',
    socketio: { port: 3031, origins: ['http://localhost:5173'] },
  })],
})
