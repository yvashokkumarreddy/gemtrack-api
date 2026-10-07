import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ListQuery } from './schemas.js'
import type {
  CreateGemInput,
  GemItem,
  GemOwnership,
  GemStockType,
  Paginated,
  UpdateGemInput,
} from './types.js'

// Storage lives behind these functions, so it can be swapped for MongoDB
// (Mongoose) later without touching the routes.
const dataFile = fileURLToPath(new URL('../data/gems.json', import.meta.url))
const seedFile = fileURLToPath(new URL('../data/gems.seed.json', import.meta.url))

if (!existsSync(dataFile)) copyFileSync(seedFile, dataFile)

// Rows written before a field existed are filled in when the file is loaded:
//  - archived: true for sold gems, false for the rest (the "sold = archived" rule)
//  - ownership / stockType: spread across the gems (by id) so filters have data
type StoredGem = Omit<GemItem, 'ownership' | 'stockType' | 'archived'> &
  Partial<Pick<GemItem, 'ownership' | 'stockType' | 'archived'>>

const OWNERSHIPS: GemOwnership[] = ['owned', 'memo_in', 'partner']
const STOCK_TYPES: GemStockType[] = ['single', 'parcel', 'set', 'pair']

function withDefaults(gem: StoredGem): GemItem {
  const n = Number(gem.id) || 0
  return {
    ...gem,
    ownership: gem.ownership ?? OWNERSHIPS[n % OWNERSHIPS.length],
    stockType: gem.stockType ?? STOCK_TYPES[n % STOCK_TYPES.length],
    archived: gem.archived ?? gem.status === 'sold',
  }
}

function readStoredGems(): { rows: StoredGem[]; wrapped: boolean } {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(dataFile, 'utf-8'))
  } catch {
    throw new Error(`Could not read ${dataFile}. Delete it to reset from the seed data.`)
  }

  // A plain array, or json-server's { "gems": [...] } shape
  if (Array.isArray(raw)) return { rows: raw as StoredGem[], wrapped: false }
  if (typeof raw === 'object' && raw !== null && 'gems' in raw && Array.isArray(raw.gems)) {
    return { rows: raw.gems as StoredGem[], wrapped: true }
  }
  throw new Error(`${dataFile} must contain an array of gems. Delete it to reset from the seed data.`)
}

const stored = readStoredGems()
let gems: GemItem[] = stored.rows.map(withDefaults)

function save(): void {
  writeFileSync(dataFile, JSON.stringify(gems, null, 2))
}

// Persist the migration straight away, so the file on disk matches the API
const migrated = stored.wrapped || stored.rows.some((row) => row.archived === undefined || row.ownership === undefined || row.stockType === undefined)
if (migrated) save()

type SortField = 'sku' | 'name' | 'caratWeight' | 'cost' | 'price' | 'status'

export function listGems(query: ListQuery): Paginated<GemItem> {
  const search = query.q?.toLowerCase()

  const rows = gems.filter((gem) => {
    if (search && !`${gem.name} ${gem.sku}`.toLowerCase().includes(search)) return false
    if (query.status && gem.status !== query.status) return false
    if (query.ownership && gem.ownership !== query.ownership) return false
    if (query.stockType && gem.stockType !== query.stockType) return false
    if (query.archived !== undefined && gem.archived !== query.archived) return false
    if (query.minPrice !== undefined && gem.price < query.minPrice) return false
    if (query.maxPrice !== undefined && gem.price > query.maxPrice) return false
    return true
  })

  const [field, direction] = query.sort.split(':') as [SortField, 'asc' | 'desc']
  rows.sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    const cmp =
      typeof av === 'number' && typeof bv === 'number'
        ? av - bv
        : String(av).localeCompare(String(bv))
    return direction === 'asc' ? cmp : -cmp
  })

  const total = rows.length
  const start = (query.page - 1) * query.limit

  return {
    data: rows.slice(start, start + query.limit),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  }
}

export function getGem(id: string): GemItem | undefined {
  return gems.find((gem) => gem.id === id)
}

export function skuExists(sku: string, exceptId?: string): boolean {
  const wanted = sku.toLowerCase()
  return gems.some((gem) => gem.sku.toLowerCase() === wanted && gem.id !== exceptId)
}

// Business rule, enforced here so no client can get around it:
// a gem that is set to "sold" is archived in that same write, whatever the
// client sent for `archived`.
export function createGem(input: CreateGemInput): GemItem {
  const nextId = String(Math.max(0, ...gems.map((gem) => Number(gem.id))) + 1)
  const archived = input.status === 'sold' ? true : (input.archived ?? false)
  const gem: GemItem = { id: nextId, ...input, archived }
  gems.push(gem)
  save()
  return gem
}

export function updateGem(id: string, patch: UpdateGemInput): GemItem | undefined {
  const index = gems.findIndex((gem) => gem.id === id)
  if (index === -1) return undefined
  const current = gems[index]

  // "Set to sold" means moving to sold. A gem that is already sold and was
  // restored by hand stays restored when it is edited later (the edit form
  // sends status: 'sold' again, and that must not undo the Restore).
  // Moving away from sold never un-archives; that stays a manual Restore.
  const becomesSold = patch.status === 'sold' && current.status !== 'sold'

  const updated: GemItem = {
    ...current,
    ...patch,
    archived: becomesSold ? true : (patch.archived ?? current.archived),
  }
  gems[index] = updated
  save()
  return updated
}

export function deleteGem(id: string): boolean {
  const before = gems.length
  gems = gems.filter((gem) => gem.id !== id)
  if (gems.length === before) return false
  save()
  return true
}