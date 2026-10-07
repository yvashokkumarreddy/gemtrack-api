import type { TokenPayload } from './types.js'

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload
    }
  }
}

export {}
