export const config = {
  port: Number(process.env.PORT ?? 3001),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  // Artificial latency (ms) on every /api/v1 request, so you can see
  // loading states and caching behaviour in the frontend.
  delayMs: Number(process.env.DELAY_MS ?? 0),
}
