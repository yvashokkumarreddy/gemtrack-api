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

// Data files created before these fields existed have no ownership/stockType.
// Spread them across the existing gems (by id) so the filters have something
// to filter. Saved to disk on the next create/update/delete.
type StoredGem = Omit<GemItem, 'ownership' | 'stockType'> &
  Partial<Pick<GemItem, 'ownership' | 'stockType'>>

const OWNERSHIPS: GemOwnership[] = ['owned', 'memo_in', 'partner']
const STOCK_TYPES: GemStockType[] = ['single', 'parcel', 'set', 'pair']

function withDefaults(gem: StoredGem): GemItem {
  const n = Number(gem.id) || 0
  return {
    ...gem,
    ownership: gem.ownership ?? OWNERSHIPS[n % OWNERSHIPS.length],
    stockType: gem.stockType ?? STOCK_TYPES[n % STOCK_TYPES.length],
  }
}

function readStoredGems(): StoredGem[] {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(dataFile, 'utf-8'))
  } catch {
    throw new Error(`Could not read ${dataFile}. Delete it to reset from the seed data.`)
  }

  // A plain array, or json-server's { "gems": [...] } shape
  if (Array.isArray(raw)) return raw as StoredGem[]
  if (typeof raw === 'object' && raw !== null && 'gems' in raw && Array.isArray(raw.gems)) {
    return raw.gems as StoredGem[]
  }
  throw new Error(`${dataFile} must contain an array of gems. Delete it to reset from the seed data.`)
}

// (save() writes a plain array, so the file is normalised on the next change)
let gems: GemItem[] = readStoredGems().map(withDefaults)

function save(): void {
  writeFileSync(dataFile, JSON.stringify(gems, null, 2))
}

type SortField = 'sku' | 'name' | 'caratWeight' | 'cost' | 'price' | 'status'

export function listGems(query: ListQuery): Paginated<GemItem> {
  const search = query.q?.toLowerCase()

  const rows = gems.filter((gem) => {
    if (search && !`${gem.name} ${gem.sku}`.toLowerCase().includes(search)) return false
    if (query.status && gem.status !== query.status) return false
    if (query.ownership && gem.ownership !== query.ownership) return false
    if (query.stockType && gem.stockType !== query.stockType) return false
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

export function createGem(input: CreateGemInput): GemItem {
  const nextId = String(Math.max(0, ...gems.map((gem) => Number(gem.id))) + 1)
  const gem: GemItem = { id: nextId, ...input }
  gems.push(gem)
  save()
  return gem
}

export function updateGem(id: string, patch: UpdateGemInput): GemItem | undefined {
  const index = gems.findIndex((gem) => gem.id === id)
  if (index === -1) return undefined
  const updated: GemItem = { ...gems[index], ...patch }
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