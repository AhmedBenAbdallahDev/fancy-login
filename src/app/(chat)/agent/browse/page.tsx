import { BrowseAgentsList } from "@/components/browse-agents/browse-agents-list";
import { ScrollArea } from "ui/scroll-area";
import { getTranslations } from "next-intl/server";

export default async function BrowseAgentsPage() {
  const t = await getTranslations();

  return (
    <ScrollArea className="h-full w-full">
      <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {t("Agent.browseTitle")}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base mt-1">
            {t("Agent.browseDescription")}
          </p>
        </div>

        <BrowseAgentsList />
      </div>
    </ScrollArea>
  );
}
