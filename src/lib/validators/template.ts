import { z } from 'zod'
import { TemplateType, FileType } from '@prisma/client'

export const templateMappingSchema = z.record(z.string(), z.string())

export const createTemplateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空').max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(TemplateType),
  mappings: templateMappingSchema,
  fileType: z.nativeEnum(FileType),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  presetKey: z.string().max(50).optional(),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export type CreateTemplateSchema = z.infer<typeof createTemplateSchema>
export type UpdateTemplateSchema = z.infer<typeof updateTemplateSchema>
