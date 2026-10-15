"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Enums } from "@/types/database.types";

type SelfPromotionStatus = Enums<"self_promotion_status">;

type FiltersProps = {
  selectedSelfPromotion: SelfPromotionStatus[];
  selfPromotionOptions: {
    label: string;
    value: SelfPromotionStatus;
  }[];
  onSelfPromotionChange: (value: SelfPromotionStatus, checked: boolean) => void;
};

export function Filters({
  selectedSelfPromotion,
  selfPromotionOptions,
  onSelfPromotionChange,
}: FiltersProps) {
  return (
    <div className="flex flex-col md:flex-row w-full gap-x-4 gap-y-2">
      <Label>Self-Promotion Allowed</Label>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {selfPromotionOptions.map((option) => {
          const checkboxId = `self-promotion-${option.value}`;
          const checked = selectedSelfPromotion.includes(option.value);
          const readOnly = checked && selectedSelfPromotion.length === 1;
          return (
            <div
              key={option.value}
              className={`flex items-center gap-1.5 text-sm text-muted-foreground${readOnly ? " opacity-50" : ""}`}
            >
              <Checkbox
                id={checkboxId}
                checked={checked}
                aria-readonly={readOnly || undefined}
                onCheckedChange={(nextChecked) => {
                  if (!readOnly) {
                    onSelfPromotionChange(option.value, Boolean(nextChecked));
                  }
                }}
              />
              <Label htmlFor={checkboxId} className="text-muted-foreground">
                {option.label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
