import { Router, type Request } from 'express'
import {
  assertCanWriteSomewhere,
  assertLevel,
  moduleOf,
  PERMISSION,
  resolveListScope,
} from '../access.js'
import {
  createGem,
  deleteGem,
  getGem,
  listGems,
  skuExists,
  updateGem,
} from '../gemRepository.js'
import { authenticate, HttpError } from '../middleware.js'
import { createGemSchema, listQuerySchema, updateGemSchema } from '../schemas.js'

export const gemsRouter = Router()

gemsRouter.use(authenticate)

// With middleware in the chain, Express types params as string | string[]
const idOf = (req: Request): string => String(req.params.id)

// Loads the gem and checks the caller may write to the place it lives in
// (active gems: inventory write, archived gems: archive write)
function loadGemForWrite(req: Request) {
  assertCanWriteSomewhere(req.user)
  const gem = getGem(idOf(req))
  if (!gem) throw new HttpError(404, 'Gem not found')
  assertLevel(req.user, moduleOf(gem), PERMISSION.WRITE)
  return gem
}

gemsRouter.get('/', (req, res) => {
  // Treat "?q=" or "?minPrice=" (empty strings) as "not provided"
  const cleaned = Object.fromEntries(
    Object.entries(req.query).filter(([, value]) => value !== '')
  )
  const query = listQuerySchema.parse(cleaned)
  res.json(listGems({ ...query, archived: resolveListScope(req.user, query.archived) }))
})

gemsRouter.get('/:id', (req, res) => {
  const gem = getGem(idOf(req))
  if (!gem) throw new HttpError(404, 'Gem not found')
  assertLevel(req.user, moduleOf(gem), PERMISSION.READ)
  res.json(gem)
})

gemsRouter.post('/', (req, res) => {
  assertLevel(req.user, 'inventory', PERMISSION.WRITE)
  const input = createGemSchema.parse(req.body)
  if (skuExists(input.sku)) {
    throw new HttpError(409, 'SKU already exists', [
      { path: 'sku', message: 'SKU already exists' },
    ])
  }
  res.status(201).json(createGem(input))
})

// Also used for Archive ({ archived: true }) and Restore ({ archived: false })
gemsRouter.patch('/:id', (req, res) => {
  const current = loadGemForWrite(req)
  const patch = updateGemSchema.parse(req.body)
  if (patch.sku && skuExists(patch.sku, current.id)) {
    throw new HttpError(409, 'SKU already exists', [
      { path: 'sku', message: 'SKU already exists' },
    ])
  }
  const updated = updateGem(current.id, patch)
  if (!updated) throw new HttpError(404, 'Gem not found')
  res.json(updated)
})

// A real, permanent delete (archived or not)
gemsRouter.delete('/:id', (req, res) => {
  const gem = loadGemForWrite(req)
  deleteGem(gem.id)
  res.status(204).end()
})