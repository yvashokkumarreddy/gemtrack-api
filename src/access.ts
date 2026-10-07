import { HttpError } from './middleware.js'
import type { GemItem, ModuleKey, PermissionLevel, TokenPayload } from './types.js'

// 0 = none, 2 = read, 4 = write (same levels as the frontend)
export const PERMISSION = { NONE: 0, READ: 2, WRITE: 4 } as const

const FORBIDDEN = 'You do not have permission to do this'

export function levelOf(user: TokenPayload | undefined, module: ModuleKey): PermissionLevel {
  if (!user) return 0
  const explicit = user.permissions[module]
  if (explicit !== undefined) return explicit // an explicit value always wins
  // Tokens issued before the archive permission existed have no `archive` key.
  // Treat it as equal to `inventory` (the frontend does the same).
  return module === 'archive' ? (user.permissions.inventory ?? 0) : 0
}

export function assertLevel(user: TokenPayload | undefined, module: ModuleKey, min: PermissionLevel): void {
  if (levelOf(user, module) < min) throw new HttpError(403, FORBIDDEN)
}

// A gem is governed by the permission of the place it lives in right now:
// active gems by `inventory`, archived gems by `archive`.
export function moduleOf(gem: Pick<GemItem, 'archived'>): ModuleKey {
  return gem.archived ? 'archive' : 'inventory'
}

// Used before looking a gem up, so a user with no write access at all gets
// a 403 rather than learning (via 404 vs 403) which ids exist.
export function assertCanWriteSomewhere(user: TokenPayload | undefined): void {
  if (levelOf(user, 'inventory') < PERMISSION.WRITE && levelOf(user, 'archive') < PERMISSION.WRITE) {
    throw new HttpError(403, FORBIDDEN)
  }
}

// Which gems may this request list? `requested` is the ?archived= filter.
//  - archived=true  needs archive read, archived=false needs inventory read
//  - no filter: show only what the user is allowed to see (both, if allowed)
// Returns the filter the list query must apply.
export function resolveListScope(user: TokenPayload | undefined, requested: boolean | undefined): boolean | undefined {
  const canSeeActive = levelOf(user, 'inventory') >= PERMISSION.READ
  const canSeeArchived = levelOf(user, 'archive') >= PERMISSION.READ

  if (requested === true) {
    if (!canSeeArchived) throw new HttpError(403, FORBIDDEN)
    return true
  }
  if (requested === false) {
    if (!canSeeActive) throw new HttpError(403, FORBIDDEN)
    return false
  }
  if (canSeeActive && canSeeArchived) return undefined
  if (canSeeActive) return false
  if (canSeeArchived) return true
  throw new HttpError(403, FORBIDDEN)
}
