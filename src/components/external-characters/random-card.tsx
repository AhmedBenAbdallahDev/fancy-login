"use client";

import { useState, useCallback } from "react";
import { Button } from "ui/button";
import { Dice1, Dice5, Shuffle, Loader2 } from "lucide-react";
import type {
  ExternalCharacterCard,
  ExternalSourceSlug,
} from "app-types/external-character";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";

const SOURCES_FOR_RANDOM: ExternalSourceSlug[] = [
  "jannyai",
  "chub",
  "wyvern",
  "character_tavern",
  "risuai",
  "backyard",
  "pygmalion",
];

interface RandomCardButtonProps {
  currentSource?: ExternalSourceSlug;
  onCardSelected: (card: ExternalCharacterCard) => void;
}

export function RandomCardButton({
  currentSource,
  onCardSelected,
}: RandomCardButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const fetchRandomCard = useCallback(
    async (source?: ExternalSourceSlug) => {
      setIsLoading(true);
      try {
        // Pick a random source if not specified
        const targetSource =
          source ||
          SOURCES_FOR_RANDOM[
            Math.floor(Math.random() * SOURCES_FOR_RANDOM.length)
          ];

        // Fetch a random page
        const randomPage = Math.floor(Math.random() * 10) + 1;

        const response = await fetch(
          `/api/external-characters/search?source=${targetSource}&page=${randomPage}&limit=40&sort=popular`,
        );

        if (!response.ok) {
          throw new Error("Failed to fetch cards");
        }

        const data = await response.json();
        const cards = data.cards || [];

        if (cards.length === 0) {
          // Try another source
          const altSource =
            SOURCES_FOR_RANDOM[
              Math.floor(Math.random() * SOURCES_FOR_RANDOM.length)
            ];
          const altResponse = await fetch(
            `/api/external-characters/search?source=${altSource}&page=1&limit=40&sort=popular`,
          );
          const altData = await altResponse.json();
          const altCards = altData.cards || [];

          if (altCards.length > 0) {
            const randomCard =
              altCards[Math.floor(Math.random() * altCards.length)];
            onCardSelected(randomCard);
          }
          return;
        }

        // Pick a random card
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        onCardSelected(randomCard);
      } catch (error) {
        console.error("[Random Card] Error:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [onCardSelected],
  );

  const handleRandomSameSource = useCallback(() => {
    if (currentSource && currentSource !== "all") {
      fetchRandomCard(currentSource);
    } else {
      fetchRandomCard();
    }
  }, [currentSource, fetchRandomCard]);

  const handleRandomAnySource = useCallback(() => {
    fetchRandomCard();
  }, [fetchRandomCard]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Dice5 className="size-4" />
          )}
          <span className="hidden sm:inline">Random</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {currentSource && currentSource !== "all" && (
          <DropdownMenuItem onClick={handleRandomSameSource}>
            <Shuffle className="size-4 mr-2" />
            Random from {currentSource}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={handleRandomAnySource}>
          <Dice1 className="size-4 mr-2" />
          Random from Any Source
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Random buttons for the detail modal
interface RandomModalButtonsProps {
  onRandomSameSource: () => void;
  onRandomAnySource: () => void;
  isLoading?: boolean;
}

export function RandomModalButtons({
  onRandomSameSource,
  onRandomAnySource,
  isLoading,
}: RandomModalButtonsProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onRandomSameSource}
        disabled={isLoading}
        className="flex-1"
      >
        {isLoading ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Shuffle className="size-4 mr-2" />
        )}
        Same Source
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={onRandomAnySource}
        disabled={isLoading}
        className="flex-1"
      >
        {isLoading ? (
          <Loader2 className="size-4 mr-2 animate-spin" />
        ) : (
          <Dice1 className="size-4 mr-2" />
        )}
        Any Source
      </Button>
    </div>
  );
}
