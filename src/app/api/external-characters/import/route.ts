/**
 * External Characters API - Import Character
 * POST /api/external-characters/import
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";
import { characterRepository, lorebookRepository } from "@/lib/db/repository";
import {
  getExternalCharacter,
  transformToImportData,
} from "@/lib/external-characters";
import {
  ImportCharacterSchema,
  type ExternalSourceSlug,
} from "app-types/external-character";

export async function POST(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ImportCharacterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.errors },
        { status: 400 },
      );
    }

    const {
      source,
      externalId,
      name: overrideName,
      tags: overrideTags,
      isPublic,
    } = parsed.data;

    // 1. Fetch full character data from source
    const externalCard = await getExternalCharacter(
      source as ExternalSourceSlug,
      externalId,
    );

    // 2. Transform to our format
    const importData = transformToImportData(externalCard);

    // 3. Create character in our DB
    const character = await characterRepository.create(session.user.id, {
      name: overrideName || importData.name,
      tagline: importData.tagline,
      description: importData.description,
      avatar: importData.avatar,
      personality: importData.personality,
      systemPrompt: importData.systemPrompt,
      greeting: importData.greeting,
      exampleDialogue: importData.exampleDialogue,
      scenario: importData.scenario,
      postHistoryInstructions: importData.postHistoryInstructions,
      alternateGreetings: importData.alternateGreetings,
      tags: overrideTags || importData.tags,
      isNSFW: importData.isNSFW,
      isPublic: isPublic || false,
      tokenCount: importData.tokenCount,
      allowedTools: [], // External characters don't have tools
      externalSource: importData.externalSource,
      externalId: importData.externalId,
      externalUrl: importData.externalUrl,
      externalCreator: importData.externalCreator,
      originalData: importData.originalData,
    });

    // 4. Import lorebook if present
    if (importData.characterBook?.entries?.length) {
      await lorebookRepository.create(character.id, {
        name: importData.characterBook.name || "Imported Lorebook",
        entries: importData.characterBook.entries,
        isEmbedded: true,
        sourceLorebookId: externalId,
      });
    }

    return NextResponse.json({
      success: true,
      character: {
        id: character.id,
        name: character.name,
        externalSource: character.externalSource,
      },
      hasLorebook: !!importData.characterBook?.entries?.length,
    });
  } catch (error) {
    console.error("[External Characters] Import error:", error);
    return NextResponse.json(
      { error: "Failed to import character" },
      { status: 500 },
    );
  }
}
