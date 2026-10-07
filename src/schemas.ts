import { z } from 'zod'

export const gemStatusSchema = z.enum(['in_stock', 'sold', 'on_memo'])
export const gemOwnershipSchema = z.enum(['owned', 'memo_in', 'partner'])
export const gemStockTypeSchema = z.enum(['parcel', 'single', 'set', 'pair'])

export const createGemSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required'),
  name: z.string().trim().min(1, 'Name is required'),
  caratWeight: z.number().positive('Carat weight must be greater than 0'),
  color: z.string().trim().min(1, 'Color is required'),
  clarity: z.string().trim().min(1, 'Clarity is required'),
  ownership: gemOwnershipSchema,
  stockType: gemStockTypeSchema,
  cut: z.string().trim().min(1, 'Cut is required'),
  cost: z.number().min(0, 'Cost cannot be negative'),
  price: z.number().min(0, 'Price cannot be negative'),
  status: gemStatusSchema,
})

export const updateGemSchema = createGemSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field is required',
  })

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  q: z.string().trim().optional(),
  status: gemStatusSchema.optional(),
  ownership: gemOwnershipSchema.optional(),
  stockType: gemStockTypeSchema.optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z
    .string()
    .regex(/^(sku|name|caratWeight|cost|price|status):(asc|desc)$/, 'Invalid sort')
    .default('sku:asc'),
})

export type ListQuery = z.infer<typeof listQuerySchema>

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required'),
  password: z.string().min(1, 'Password is required'),
})
