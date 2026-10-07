import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express'
import jwt from 'jsonwebtoken'
import { ZodError } from 'zod'
import { config } from './config.js'
import type { ModuleKey, PermissionLevel, TokenPayload } from './types.js'

export interface FieldError {
  path: string
  message: string
}

export class HttpError extends Error {
  status: number
  errors?: FieldError[]

  constructor(status: number, message: string, errors?: FieldError[]) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

// Reuse the caller's request id (the frontend sends one) or make a new one
export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header('x-request-id') ?? randomUUID()
  res.locals.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}

export const delay: RequestHandler = async (_req, _res, next) => {
  if (config.delayMs > 0) await sleep(config.delayMs)
  next()
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization')
  if (!header?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Authentication required')
  }
  try {
    req.user = jwt.verify(header.slice(7), config.jwtSecret) as TokenPayload
  } catch {
    throw new HttpError(401, 'Invalid or expired token')
  }
  next()
}

// 0 = none, 2 = read, 4 = write, same levels as the frontend
export function requirePermission(module: ModuleKey, minLevel: PermissionLevel): RequestHandler {
  return (req, _res, next) => {
    const level = req.user?.permissions[module] ?? 0
    if (level < minLevel) {
      throw new HttpError(403, 'You do not have permission to do this')
    }
    next()
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`))
}

export const errorHandler: ErrorRequestHandler = (err, _req: Request, res: Response, _next: NextFunction) => {
  const requestId = res.locals.requestId as string

  if (err instanceof ZodError) {
    const errors: FieldError[] = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
    res.status(422).json({ message: 'Validation failed', errors, requestId })
    return
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message, errors: err.errors, requestId })
    return
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ message: 'Malformed JSON body', requestId })
    return
  }

  console.error(`[${requestId}]`, err)
  res.status(500).json({ message: 'Internal server error', requestId })
}
