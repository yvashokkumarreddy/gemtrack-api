import { app } from './app.js'
import { config } from './config.js'

app.listen(config.port, () => {
  console.log(`GemTrack API running on http://localhost:${config.port}`)
  console.log(`Allowing browser requests from ${config.clientOrigin}`)
  if (config.delayMs > 0) console.log(`Artificial latency: ${config.delayMs}ms`)
})
