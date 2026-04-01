"use client";

import { useState } from "react";
import { ExternalCharacterBrowser } from "@/components/external-characters";
import { TagBlocklistManager } from "@/components/external-characters";
import { Button } from "ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "ui/sheet";
import { Settings, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ExternalCharacterBrowsePage() {
  const router = useRouter();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleImportSuccess = (characterId: string, name: string) => {
    toast.success(`Imported "${name}"`, {
      action: {
        label: "View",
        onClick: () => router.push(`/character/${characterId}`),
      },
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center px-4">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link href="/characters">
              <ArrowLeft className="size-4 mr-2" />
              Back to Characters
            </Link>
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              Import External Characters
            </h1>
            <p className="text-xs text-muted-foreground">
              Browse JannyAI, Chub, Wyvern, CharacterTavern, RisuAI and more
            </p>
          </div>

          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings className="size-4 mr-2" />
                Settings
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetTitle className="sr-only">Browser Settings</SheetTitle>
              <div className="space-y-6 pt-6">
                <TagBlocklistManager />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main Content */}
      <main className="container px-4 py-6">
        <ExternalCharacterBrowser onImportSuccess={handleImportSuccess} />
      </main>
    </div>
  );
}
