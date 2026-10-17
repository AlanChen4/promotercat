"use client";

import { Check, Copy, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Image from "next/image";
import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
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

function AgentWindow({
  onClose,
  triggerRef,
}: {
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const tabId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [client, setClient] = useState<"codex" | "claude">("codex");
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const clamp = (x: number, y: number) => {
    const rect = panelRef.current?.getBoundingClientRect();
    return {
      x: Math.max(
        12,
        Math.min(x, window.innerWidth - (rect?.width ?? 560) - 12),
      ),
      y: Math.max(
        12,
        Math.min(y, window.innerHeight - (rect?.height ?? 600) - 12),
      ),
    };
  };
  useEffect(() => {
    const rect = panelRef.current?.getBoundingClientRect();
    const anchor = triggerRef.current?.getBoundingClientRect();
    setPosition({
      x: Math.max(
        12,
        Math.min(
          (anchor?.right ?? window.innerWidth - 12) - (rect?.width ?? 560),
          window.innerWidth - (rect?.width ?? 560) - 12,
        ),
      ),
      y: Math.max(
        12,
        Math.min(
          (anchor?.bottom ?? 12) + 8,
          window.innerHeight - (rect?.height ?? 600) - 12,
        ),
      ),
    });
    setReady(true);
    const resize = () => {
      drag.current = null;
      setDragging(false);
      if (window.innerWidth < 768) {
        onClose();
        return;
      }
      const bounds = panelRef.current?.getBoundingClientRect();
      if (bounds)
        setPosition({
          x: Math.max(
            12,
            Math.min(bounds.left, window.innerWidth - bounds.width - 12),
          ),
          y: Math.max(
            12,
            Math.min(bounds.top, window.innerHeight - bounds.height - 12),
          ),
        });
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("resize", resize);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", keydown);
    };
  }, [onClose, triggerRef]);

  useEffect(() => {
    if (ready) closeRef.current?.focus();
  }, [ready]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: ready ? 1 : 0, scale: ready ? 1 : 0.95 }}
      exit={{ opacity: 0, scale: 0.95 }}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label="For Agents"
      className="fixed z-30 flex max-h-[calc(100dvh-24px)] w-[560px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl"
      style={{
        left: position.x,
        top: position.y,
        visibility: ready ? "visible" : "hidden",
      }}
    >
      <header
        className={`flex h-11 shrink-0 touch-none select-none items-center gap-3 px-4 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={(event) => {
          if (
            (event.target instanceof Element &&
              event.target.closest("button, [role='tab']")) ||
            !event.isPrimary ||
            event.button !== 0 ||
            event.pointerType === "touch"
          )
            return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: position.x,
            top: position.y,
          };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start?.id === event.pointerId)
            setPosition(
              clamp(
                start.left + event.clientX - start.x,
                start.top + event.clientY - start.y,
              ),
            );
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onLostPointerCapture={() => {
          drag.current = null;
          setDragging(false);
        }}
      >
        <div
          role="tablist"
          aria-label="Agent client"
          className="flex items-center gap-4"
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
              return;
            event.preventDefault();
            const next =
              event.key === "Home"
                ? "codex"
                : event.key === "End"
                  ? "claude"
                  : client === "codex"
                    ? "claude"
                    : "codex";
            setClient(next);
            document.getElementById(`${tabId}-${next}`)?.focus();
          }}
        >
          {(["codex", "claude"] as const).map((value) => (
            <motion.button
              animate={{
                color:
                  client === value
                    ? "var(--foreground)"
                    : "var(--muted-foreground)",
              }}
              whileHover={{ color: "var(--foreground)" }}
              key={value}
              id={`${tabId}-${value}`}
              role="tab"
              type="button"
              aria-selected={client === value}
              aria-controls={`${tabId}-panel`}
              tabIndex={client === value ? 0 : -1}
              onClick={() => setClient(value)}
              className="inline-flex cursor-pointer items-center gap-2 rounded py-1 text-sm font-medium focus-visible:outline-2"
            >
              <Image
                src={value === "codex" ? codexLogo : claudeLogo}
                alt=""
                width={18}
                height={18}
                className={`size-[18px] shrink-0 ${client === value ? "opacity-100" : "opacity-50"}`}
              />
              {value === "codex" ? "Codex" : "Claude Code"}
            </motion.button>
          ))}
        </div>
        <button
          ref={closeRef}
          type="button"
          aria-label="Close For Agents"
          onClick={onClose}
          className="ml-auto cursor-pointer rounded p-1 text-muted-foreground hover:bg-muted focus-visible:outline-2"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 space-y-2 overflow-y-auto px-5 pb-5 text-sm leading-6">
        <section className="space-y-3">
          <div
            id={`${tabId}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabId}-${client}`}
          >
            <CopyBlock key={client} text={AGENT_INSTALL[client]} />
          </div>
        </section>
        <p className="text-muted-foreground">
          30 requests/minute and 1,000/day per account.
        </p>
      </div>
    </motion.div>,
    document.body,
  );
}

export function ForAgents() {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // Stable callback keeps the window's position when its contents change.
  const close = useRef(() => {
    setOpen(false);
    trigger.current?.focus();
  }).current;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-label="Add to Codex or Claude Code"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="hidden shrink-0 items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 md:inline-flex"
      >
        Add to
        <Image src={codexLogo} alt="" width={16} height={16} />
        <Image src={claudeLogo} alt="" width={16} height={16} />
      </button>
      <AnimatePresence>
        {open ? <AgentWindow onClose={close} triggerRef={trigger} /> : null}
      </AnimatePresence>
    </>
  );
}
