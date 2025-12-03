"use client";

import { FavouriteIcon, SquareLock01Icon } from "@hugeicons/core-free-icons";
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
    <div className="grid gap-4">
      <Input
        id="subreddit-search"
        placeholder="Try “finance” or “food”"
        value={searchInput}
        onChange={(event) => onSearchInputChange(event.target.value)}
        className="max-w-xl"
      />

      <div className="flex gap-x-4 items-center">
        <Label>Self-Promotion</Label>
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

      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label>Members</Label>
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
