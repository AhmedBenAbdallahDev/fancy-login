"use client";

import EditCharacter from "@/components/edit-character";
import { use } from "react";

export default function EditCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <EditCharacter id={id} />;
}
