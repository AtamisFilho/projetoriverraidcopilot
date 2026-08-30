"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function Tabs({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-3", className)} {...props} />;
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-secondary/50 p-1 backdrop-blur",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  active,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean; value?: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      data-state={active ? "active" : "inactive"}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer",
        "text-muted-foreground hover:text-foreground",
        active && "bg-card text-foreground shadow-md border border-border/60",
        className
      )}
      {...props}
    />
  );
}

function TabsContent({
  className,
  active,
  ...props
}: React.ComponentProps<"div"> & { active?: boolean; value?: string }) {
  if (!active) return null;
  return (
    <div
      role="tabpanel"
      className={cn("outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
