"use client";

import { useState } from "react";
import { Pricing } from "@/components/pricing";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type UpgradeModalProps = {
  source?: string;
  trigger: React.ReactNode;
};

export function UpgradeModal({
  source = "unknown",
  trigger,
}: UpgradeModalProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pt-4 pb-0">
          <DialogTitle className="flex text-xl sm:text-2xl font-medium justify-center items-center">
            Choose Your Plan
          </DialogTitle>
          <DialogDescription className="flex items-center justify-center gap-2 text-center">
            Not happy with your subscription? Cancel anytime or email for a
            refund.
          </DialogDescription>
        </DialogHeader>
        <div className="px-4 pb-4">
          <Pricing source={source} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
