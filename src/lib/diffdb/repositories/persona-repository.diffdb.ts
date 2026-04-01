import { DiffDBClient } from "../client";
import {
  Persona,
  PersonaCreate,
  PersonaUpdate,
  PersonaRepository,
} from "app-types/persona";

const PERSONA_FILE = "personas.json";

export function createDiffDBPersonaRepository(
  diffdbClient: DiffDBClient,
  repoName: string,
): PersonaRepository {
  const readPersonas = async (): Promise<Persona[]> => {
    try {
      const fileInfo = await diffdbClient.readFile(repoName, PERSONA_FILE);
      if (!fileInfo) return [];
      const content = Buffer.from(fileInfo.content, "base64").toString("utf-8");
      return JSON.parse(content) as Persona[];
    } catch (error: any) {
      if (error.status === 404) {
        return [];
      }
      throw error;
    }
  };

  const writePersonas = async (personas: Persona[]): Promise<void> => {
    await diffdbClient.writeFile(
      repoName,
      PERSONA_FILE,
      JSON.stringify(personas, null, 2),
    );
  };

  return {
    async create(userId: string, data: PersonaCreate): Promise<Persona> {
      const personas = await readPersonas();

      // If setting as default, unset other defaults
      if (data.isDefault) {
        personas.forEach((p) => {
          if (p.userId === userId) p.isDefault = false;
        });
      }

      const newPersona: Persona = {
        id: crypto.randomUUID(),
        userId,
        name: data.name,
        description: data.description,
        personality: data.personality,
        avatar: data.avatar,
        isDefault: data.isDefault ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      personas.push(newPersona);
      await writePersonas(personas);

      return newPersona;
    },

    async findById(id: string, userId: string): Promise<Persona | null> {
      const personas = await readPersonas();
      return personas.find((p) => p.id === id && p.userId === userId) ?? null;
    },

    async findByUserId(userId: string): Promise<Persona[]> {
      const personas = await readPersonas();
      return personas
        .filter((p) => p.userId === userId)
        .sort((a, b) => {
          if (a.isDefault && !b.isDefault) return -1;
          if (!a.isDefault && b.isDefault) return 1;
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        });
    },

    async findDefault(userId: string): Promise<Persona | null> {
      const personas = await readPersonas();
      return personas.find((p) => p.userId === userId && p.isDefault) ?? null;
    },

    async update(
      id: string,
      userId: string,
      data: PersonaUpdate,
    ): Promise<Persona> {
      const personas = await readPersonas();
      const index = personas.findIndex(
        (p) => p.id === id && p.userId === userId,
      );

      if (index === -1) {
        throw new Error("Persona not found");
      }

      // If setting as default, unset other defaults
      if (data.isDefault) {
        personas.forEach((p) => {
          if (p.userId === userId) p.isDefault = false;
        });
      }

      personas[index] = {
        ...personas[index],
        ...data,
        updatedAt: new Date(),
      };

      await writePersonas(personas);
      return personas[index];
    },

    async delete(id: string, userId: string): Promise<void> {
      const personas = await readPersonas();
      const filtered = personas.filter(
        (p) => !(p.id === id && p.userId === userId),
      );
      await writePersonas(filtered);
    },

    async setDefault(id: string, userId: string): Promise<Persona> {
      const personas = await readPersonas();

      // Unset all defaults for this user
      personas.forEach((p) => {
        if (p.userId === userId) p.isDefault = false;
      });

      // Set the new default
      const persona = personas.find((p) => p.id === id && p.userId === userId);
      if (!persona) {
        throw new Error("Persona not found");
      }

      persona.isDefault = true;
      persona.updatedAt = new Date();

      await writePersonas(personas);
      return persona;
    },
  };
}
