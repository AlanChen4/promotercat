"use client";

export type SearchSuggestion = {
  label: string;
  emoji: string;
  query: string;
};

type SearchSuggestionsProps = {
  suggestions: SearchSuggestion[];
  onSelect: (query: string) => void;
};

export function SearchSuggestions({
  suggestions,
  onSelect,
}: SearchSuggestionsProps) {
  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap justify-center gap-2">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.label}
            type="button"
            className="flex items-center cursor-pointer gap-2 rounded-full bg-muted px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => onSelect(suggestion.query)}
          >
            <span aria-hidden="true">{suggestion.emoji}</span>
            <span>{suggestion.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
