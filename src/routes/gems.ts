import { Router, type Request } from 'express'
import {
  createGem,
  deleteGem,
  getGem,
  listGems,
  skuExists,
  updateGem,
} from '../gemRepository.js'
import { authenticate, HttpError, requirePermission } from '../middleware.js'
import { createGemSchema, listQuerySchema, updateGemSchema } from '../schemas.js'

export const gemsRouter = Router()

gemsRouter.use(authenticate)

// With middleware in the chain, Express types params as string | string[]
const idOf = (req: Request): string => String(req.params.id)

gemsRouter.get('/', requirePermission('inventory', 2), (req, res) => {
  // Treat "?q=" or "?minPrice=" (empty strings) as "not provided"
  // console.log('gemsRouter initialized', idOf(req))
  const cleaned = Object.fromEntries(
    Object.entries(req.query).filter(([, value]) => value !== '')
  )
  res.json(listGems(listQuerySchema.parse(cleaned)))
})

gemsRouter.get('/:id', requirePermission('inventory', 2), (req, res) => {
  // console.log('gemsRouter initialized', idOf(req))
  const gem = getGem(idOf(req))
  if (!gem) throw new HttpError(404, 'Gem not found')
  res.json(gem)
})

gemsRouter.post('/', requirePermission('inventory', 4), (req, res) => {
  const input = createGemSchema.parse(req.body)
  if (skuExists(input.sku)) {
    throw new HttpError(409, 'SKU already exists', [
      { path: 'sku', message: 'SKU already exists' },
    ])
  }
  res.status(201).json(createGem(input))
})

gemsRouter.patch('/:id', requirePermission('inventory', 4), (req, res) => {
  const patch = updateGemSchema.parse(req.body)
  if (patch.sku && skuExists(patch.sku, idOf(req))) {
    throw new HttpError(409, 'SKU already exists', [
      { path: 'sku', message: 'SKU already exists' },
    ])
  }
  const updated = updateGem(idOf(req), patch)
  if (!updated) throw new HttpError(404, 'Gem not found')
  res.json(updated)
})

gemsRouter.delete('/:id', requirePermission('inventory', 4), (req, res) => {
  if (!deleteGem(idOf(req))) throw new HttpError(404, 'Gem not found')
  res.status(204).end()
})
