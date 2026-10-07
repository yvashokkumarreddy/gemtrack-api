import bcrypt from 'bcryptjs'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { users } from '../data/users.js'
import { HttpError } from '../middleware.js'
import { loginSchema } from '../schemas.js'
import type { TokenPayload } from '../types.js'

export const authRouter = Router()

authRouter.post('/login', (req, res) => {
  const { email, password } = loginSchema.parse(req.body)

  const user = users.find((u) => u.email === email.toLowerCase())
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new HttpError(401, 'Invalid email or password')
  }

  const payload: TokenPayload = {
    sub: user.id,
    name: user.name,
    role: user.role,
    tenantId: user.tenantId,
    currency: user.currency,
    permissions: user.permissions,
  }

  const token = jwt.sign(payload, config.jwtSecret, { expiresIn: '8h' })
  res.json({ token })
})
