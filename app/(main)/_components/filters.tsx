"use client";

import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Image from "next/image";
import Link from "next/link";
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
import logo from "@/public/logo.png";
import type { Enums } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;

export type ActivityThresholdOption = {
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
  minimumActivity: number | null;
  maximumActivity: number | null;
  isMinimumOpenEnded: boolean;
  maximumActivityOptions: ActivityThresholdOption[];
  activityFilterAnyValue: string;
  activityThresholdOptions: ActivityThresholdOption[];
  onSearchInputChange: (value: string) => void;
  onSelfPromotionChange: (value: SelfPromotionStatus, checked: boolean) => void;
  onMinimumActivityChange: (value: string) => void;
  onMaximumActivityChange: (value: string) => void;
};

export function Filters({
  searchInput,
  selectedSelfPromotion,
  selfPromotionOptions,
  minimumActivity,
  maximumActivity,
  isMinimumOpenEnded,
  maximumActivityOptions,
  activityFilterAnyValue,
  activityThresholdOptions,
  onSearchInputChange,
  onSelfPromotionChange,
  onMinimumActivityChange,
  onMaximumActivityChange,
}: FiltersProps) {
  return (
    <div className="grid gap-4 w-full">
      <div className="flex w-full items-center gap-3">
        <Link href="/" aria-label="PromoterCat home" className="shrink-0">
          <Image src={logo} alt="PromoterCat" width={42} height={42} priority />
        </Link>
        <div className="relative min-w-0 flex-1">
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
          <Label className="w-28">Weekly active</Label>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Min
              </span>
              <Select
                value={
                  minimumActivity !== null
                    ? String(minimumActivity)
                    : activityFilterAnyValue
                }
                onValueChange={onMinimumActivityChange}
              >
                <SelectTrigger className="min-w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activityFilterAnyValue}>Any</SelectItem>
                  {activityThresholdOptions.map(({ label, value }) => (
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
                  maximumActivity !== null
                    ? String(maximumActivity)
                    : activityFilterAnyValue
                }
                onValueChange={onMaximumActivityChange}
                disabled={isMinimumOpenEnded}
              >
                <SelectTrigger className="min-w-28">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activityFilterAnyValue}>Any</SelectItem>
                  {maximumActivityOptions.map(({ label, value }) => (
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
