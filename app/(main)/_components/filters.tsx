"use client";

import {
  FavouriteIcon,
  Search01Icon,
  SquareLock01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UpgradeModal } from "@/components/upgrade-modal";
import { useAuth } from "@/providers/auth-provider";
import type { Enums } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;

export type MemberThresholdOption = {
  label: string;
  value: number;
  isOpenEnded?: boolean;
};

type FiltersProps = {
  searchInput: string;
  selectedSelfPromotion: SelfPromotionStatus[];
  selfPromotionOptions: {
    label: string;
    value: SelfPromotionStatus;
  }[];
  canUseMembersFilter: boolean;
  minimumMembers: number | null;
  maximumMembers: number | null;
  isMinimumOpenEnded: boolean;
  maximumMembersOptions: MemberThresholdOption[];
  membersFilterAnyValue: string;
  memberThresholdOptions: MemberThresholdOption[];
  onSearchInputChange: (value: string) => void;
  onSelfPromotionChange: (value: SelfPromotionStatus, checked: boolean) => void;
  onMinimumMembersChange: (value: string) => void;
  onMaximumMembersChange: (value: string) => void;
};

export function Filters({
  searchInput,
  selectedSelfPromotion,
  selfPromotionOptions,
  canUseMembersFilter,
  minimumMembers,
  maximumMembers,
  isMinimumOpenEnded,
  maximumMembersOptions,
  membersFilterAnyValue,
  memberThresholdOptions,
  onSearchInputChange,
  onSelfPromotionChange,
  onMinimumMembersChange,
  onMaximumMembersChange,
}: FiltersProps) {
  const { isPremium, isPremiumLoading } = useAuth();
  const membersFilterDisabled = !canUseMembersFilter;

  return (
    <div className="grid gap-4 w-full">
      <div className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="subreddit-search"
            placeholder='Try "finance" or "food recipes"'
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            className="pl-9 text-sm"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-sm font-semibold text-muted-foreground underline-offset-2 hover:text-foreground"
            >
              How do I use this site?
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs p-4 text-sm">
            <p>
              Discover Reddit communities that welcome promotion so you can
              reach an audience without breaking the rules.
            </p>
            <ol className="mt-2 space-y-1.5 list-decimal pl-4">
              <li>Search by topic keywords to surface relevant subreddits.</li>
              <li>Filter by promotion permissions to narrow the list.</li>
              <li>Start promoting!</li>
            </ol>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex w-full gap-x-4 items-center">
        <Label className="w-20">Promotion</Label>
        {selfPromotionOptions.map((option) => {
          const checkboxId = `self-promotion-${option.value}`;
          return (
            <div
              key={option.value}
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <Checkbox
                id={checkboxId}
                checked={selectedSelfPromotion.includes(option.value)}
                onCheckedChange={(checked) =>
                  onSelfPromotionChange(option.value, Boolean(checked))
                }
              />
              <Label htmlFor={checkboxId} className="text-muted-foreground">
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>

      <div className="w-full flex flex-wrap items-start gap-4">
        <div className="hidden w-full flex-wrap items-center gap-3">
          <Label className="w-20">Members</Label>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Min
              </span>
              <Select
                value={
                  minimumMembers !== null
                    ? String(minimumMembers)
                    : membersFilterAnyValue
                }
                onValueChange={onMinimumMembersChange}
                disabled={membersFilterDisabled}
              >
                <SelectTrigger className="min-w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={membersFilterAnyValue}>Any</SelectItem>
                  {memberThresholdOptions.map(({ label, value }) => (
                    <SelectItem key={value} value={String(value)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Max
              </span>
              <Select
                value={
                  maximumMembers !== null
                    ? String(maximumMembers)
                    : membersFilterAnyValue
                }
                onValueChange={onMaximumMembersChange}
                disabled={membersFilterDisabled || isMinimumOpenEnded}
              >
                <SelectTrigger className="min-w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={membersFilterAnyValue}>Any</SelectItem>
                  {maximumMembersOptions.map(({ label, value }) => (
                    <SelectItem key={value} value={String(value)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        {membersFilterDisabled && (
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted-foreground/40 px-3 py-1.5 text-sm text-muted-foreground">
            <HugeiconsIcon icon={SquareLock01Icon} className="size-4" />
            <span>Login or sign up for full search access</span>
          </div>
        )}
        {!membersFilterDisabled && !isPremium && !isPremiumLoading && (
          <UpgradeModal
            source="search_filters"
            trigger={
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-amber-500/60 px-3 py-1.5 text-sm text-amber-700 cursor-pointer">
                <HugeiconsIcon icon={FavouriteIcon} className="size-4" />
                <span>Upgrade to unlock all search results</span>
              </div>
            }
          />
        )}
      </div>
    </div>
  );
}
