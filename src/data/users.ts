import bcrypt from 'bcryptjs'
import type { ModuleKey, PermissionLevel, Role } from '../types.js'

export interface UserRecord {
  id: string
  email: string
  passwordHash: string
  name: string
  role: Role
  tenantId: string
  currency: string
  permissions: Record<ModuleKey, PermissionLevel>
}

const hash = (password: string) => bcrypt.hashSync(password, 10)

// Demo accounts: one per permission level the frontend needs to test
export const users: UserRecord[] = [
  {
    id: 'u1',
    email: 'admin@gemtrack.dev',
    passwordHash: hash('Admin@123'),
    name: 'Asha (Admin)',
    role: 'admin',
    tenantId: 'tenant-1',
    currency: 'INR',
    permissions: { inventory: 4, archive: 4 },
  },
  {
    id: 'u2',
    email: 'viewer@gemtrack.dev',
    passwordHash: hash('Viewer@123'),
    name: 'Ravi (Viewer)',
    role: 'viewer',
    tenantId: 'tenant-1',
    currency: 'INR',
    permissions: { inventory: 2, archive: 2 },
  },
  {
    id: 'u3',
    email: 'guest@gemtrack.dev',
    passwordHash: hash('Guest@123'),
    name: 'Guest (No access)',
    role: 'guest',
    tenantId: 'tenant-1',
    currency: 'INR',
    permissions: { inventory: 0, archive: 0 },
  },
]
