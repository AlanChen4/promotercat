"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
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
            placeholder='Keywords separated by commas (e.g. "gaming, game development")'
            value={searchInput}
            onChange={(event) => onSearchInputChange(event.target.value)}
            className="pl-9 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row w-full gap-x-4 gap-y-2">
        <Label className="">Promotion Allowed?</Label>
        <div className="flex gap-x-4">
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
      </div>

      <div className="w-full flex flex-wrap items-start gap-4">
        <div className="flex w-full flex-wrap items-center gap-3">
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
                disabled={isMinimumOpenEnded}
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
      </div>
    </div>
  );
}
