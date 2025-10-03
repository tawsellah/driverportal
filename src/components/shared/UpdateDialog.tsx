
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, RefreshCw } from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ElementType } from "react";

interface UpdateDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  Icon?: ElementType<LucideProps>;
  title: string;
  bodyText?: string;
  versionCurrent?: string;
  versionNew?: string;
  ctaText: string;
  onCtaClick: () => void;
}

export function UpdateDialog({
  isOpen,
  onOpenChange,
  Icon = RefreshCw,
  title,
  bodyText,
  versionCurrent,
  versionNew,
  ctaText,
  onCtaClick,
}: UpdateDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-md rounded-lg shadow-lg p-0" 
        onInteractOutside={(e) => e.preventDefault()} // Prevent closing on overlay click
        hideCloseButton // Hide default close button
      >
        <DialogHeader className="hidden">
           {/* This title is required for accessibility but is visually hidden. */}
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative p-6 pt-12">
          {/* Custom Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-4 left-4 rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
          
          {/* Icon */}
          <div className="absolute top-4 right-4 text-primary">
            <Icon className="h-6 w-6" />
          </div>

          {/* Real Visible Title */}
          <h2 className="text-2xl font-bold text-center mb-4">{title}</h2>

          {/* Body Text */}
          <div className="text-center text-muted-foreground space-y-2 mb-8">
            {bodyText && <p>{bodyText}</p>}
            {versionCurrent && versionNew && (
              <p className="mt-2 text-sm">
                  النسخة الحالية: {versionCurrent}
                  <br/>
                  النسخة الجديدة: {versionNew}
              </p>
            )}
          </div>

          {/* CTA Button */}
          <Button
            onClick={onCtaClick}
            className="w-full h-12 text-lg"
          >
            {ctaText}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
