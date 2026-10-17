"use client";

import { Check, Copy } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import claudeLogo from "@/public/claude.png";
import codexLogo from "@/public/codex.png";

const MotionCopy = motion.create(Copy);
const MotionCheck = motion.create(Check);

const AGENT_INSTALL = {
  codex:
    "codex plugin marketplace add AlanChen4/promotercat\ncodex plugin add promotercat@promotercat",
  claude:
    "claude plugin marketplace add AlanChen4/promotercat\nclaude plugin install promotercat@promotercat",
};

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md bg-muted py-3 pl-3 pr-12 text-xs leading-5">
        <code>{text}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 size-7 text-muted-foreground hover:text-foreground"
        aria-label={copied ? "Copied" : "Copy install commands"}
        title={copied ? "Copied" : "Copy"}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            if (resetTimer.current) clearTimeout(resetTimer.current);
            setCopied(true);
            setMessage("Copied");
            resetTimer.current = setTimeout(() => {
              setCopied(false);
              setMessage("");
            }, 2000);
          } catch {
            setMessage("Could not copy. Select and copy the text above.");
          }
        }}
      >
        <MotionCopy
          aria-hidden="true"
          className="absolute size-4"
          initial={false}
          animate={{ opacity: copied ? 0 : 1 }}
        />
        <MotionCheck
          aria-hidden="true"
          className="absolute size-4"
          initial={false}
          animate={{ opacity: copied ? 1 : 0 }}
        />
      </Button>
      <output
        className={
          message && !copied ? "mt-2 block text-xs text-destructive" : "sr-only"
        }
      >
        {message}
      </output>
    </div>
  );
}

export function ForAgents() {
  const [client, setClient] = useState<"codex" | "claude">("codex");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Add to Codex or Claude Code"
          className="hidden shrink-0 items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 md:inline-flex"
        >
          Add to
          <Image src={codexLogo} alt="" width={16} height={16} />
          <Image src={claudeLogo} alt="" width={16} height={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        aria-label="Agent installation"
        className="w-[560px] max-w-[calc(100vw-2rem)] space-y-3 p-3"
      >
        <DropdownMenuRadioGroup
          aria-label="Agent client"
          value={client}
          onValueChange={(value) => {
            if (value === "codex" || value === "claude") setClient(value);
          }}
          className="flex items-center gap-1"
        >
          {(["codex", "claude"] as const).map((value) => (
            <DropdownMenuRadioItem
              key={value}
              value={value}
              onSelect={(event) => event.preventDefault()}
            >
              <Image
                src={value === "codex" ? codexLogo : claudeLogo}
                alt=""
                width={18}
                height={18}
                className="size-[18px] shrink-0"
              />
              {value === "codex" ? "Codex" : "Claude Code"}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <CopyBlock key={client} text={AGENT_INSTALL[client]} />
        <p className="text-sm text-muted-foreground">
          30 requests/minute and 1,000/day per account.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
