import { z } from "zod";

// ============================================================================
// PERSONA - User's own identity/avatar for chatting
// ============================================================================

export interface Persona {
  id: string;
  userId: string;
  name: string;
  description?: string;
  personality?: string; // Character traits, background
  avatar?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const PersonaCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  personality: z.string().max(5000).optional(),
  avatar: z.string().optional(),
  isDefault: z.boolean().optional().default(false),
});

export const PersonaUpdateSchema = PersonaCreateSchema.partial();

export type PersonaCreate = z.infer<typeof PersonaCreateSchema>;
export type PersonaUpdate = z.infer<typeof PersonaUpdateSchema>;

export interface PersonaRepository {
  create(userId: string, data: PersonaCreate): Promise<Persona>;
  findById(id: string, userId: string): Promise<Persona | null>;
  findByUserId(userId: string): Promise<Persona[]>;
  findDefault(userId: string): Promise<Persona | null>;
  update(id: string, userId: string, data: PersonaUpdate): Promise<Persona>;
  delete(id: string, userId: string): Promise<void>;
  setDefault(id: string, userId: string): Promise<Persona>;
}
