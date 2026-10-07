import cors from 'cors'
import express from 'express'
import { config } from './config.js'
import { delay, errorHandler, notFound, requestId } from './middleware.js'
import { authRouter } from './routes/auth.js'
import { gemsRouter } from './routes/gems.js'

export const app = express()

app.use(requestId)
app.use(cors({ origin: config.clientOrigin, exposedHeaders: ['X-Request-Id'] }))
app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' })
})

app.use('/api/v1', delay)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/gems', gemsRouter)

app.use(notFound)
app.use(errorHandler)
