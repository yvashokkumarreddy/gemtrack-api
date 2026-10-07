export type GemStatus = 'in_stock' | 'sold' | 'on_memo'
export type GemOwnership = 'owned' | 'memo_in' | 'partner'
export type GemStockType = 'parcel' | 'single' | 'set' | 'pair'

export interface GemItem {
  id: string
  sku: string
  name: string
  caratWeight: number
  color: string
  clarity: string
  ownership: GemOwnership
  stockType: GemStockType
  cut: string
  cost: number
  price: number
  status: GemStatus
  archived: boolean
}

// `archived` is optional on create: it defaults to false (and is forced to
// true when the gem is created as sold)
export type CreateGemInput = Omit<GemItem, 'id' | 'archived'> & { archived?: boolean }
export type UpdateGemInput = Partial<Omit<GemItem, 'id'>>

export type PermissionLevel = 0 | 2 | 4
export type ModuleKey = 'inventory' | 'archive'
export type Role = 'admin' | 'viewer' | 'guest'

// Same shape as AuthUser in the frontend, plus the JWT subject
export interface TokenPayload {
  sub: string
  name: string
  role: Role
  tenantId: string
  currency: string
  // Partial: tokens issued before the `archive` permission existed only have `inventory`
  permissions: Partial<Record<ModuleKey, PermissionLevel>>
}

export interface Paginated<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}
