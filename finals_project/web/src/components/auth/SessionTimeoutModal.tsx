"use client";

/**
 * SessionTimeoutModal - warning dialog shown when the application-level
 * session is about to expire. Re-uses the existing `<Modal>` so the
 * visual language matches every other confirmation in the app.
 *
 * Behavior:
 *  - "Stay signed in" - tells the parent to extend the session.
 *    The parent writes a new expiry to localStorage and re-arms
 *    its timers, which causes this modal to unmount because the
 *    warning state flips back to false.
 *  - "Sign out now" - tells the parent to log the user out
 *    immediately, bypassing the countdown.
 *  - The countdown text re-renders every second so the user can
 *    see exactly how long they have.
 *
 * The modal itself is non-dismissible: pressing Escape, clicking
 * the overlay, or hitting the X button does nothing. The user has
 * to make a choice (extend or leave). This is intentional - an
 * auto-dismissing warning defeats the point of the warning.
 */

import { useEffect, useState } from "react";
import { Clock, LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface SessionTimeoutModalProps {
 isOpen: boolean;
 /** Absolute expiry timestamp (ms since epoch). */
 expiresAt: number | null;
 onStay: () => void;
 onSignOut: () => void;
}

function formatCountdown(msRemaining: number): string {
 if (msRemaining <= 0) return "0:00";
 const totalSeconds = Math.ceil(msRemaining / 1000);
 const minutes = Math.floor(totalSeconds / 60);
 const seconds = totalSeconds % 60;
 return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SessionTimeoutModal({
 isOpen,
 expiresAt,
 onStay,
 onSignOut,
}: SessionTimeoutModalProps) {
 // The countdown is computed on a 1s interval so the user can see
 // the time shrinking. We re-derive the label from `expiresAt` on
 // every tick rather than decrementing state - the source of truth
 // is the absolute expiry, not a local counter.
 const [now, setNow] = useState<number>(() => Date.now());

 useEffect(() => {
  if (!isOpen) return;
  const handle = window.setInterval(() => setNow(Date.now()), 1000);
  return () => window.clearInterval(handle);
 }, [isOpen]);

 const msRemaining = expiresAt ? Math.max(0, expiresAt - now) : 0;

 return (
  <Modal
   isOpen={isOpen}
   onClose={() => {
   /* Non-dismissible - user must click a footer button. */
   }}
   title="Session expiring soon"
    description="For your security, you'll be signed out after a period of inactivity."
   icon={<Clock className="w-5 h-5" />}
   size="sm"
   closeOnOverlayClick={false}
   dismissible={false}
   footer={
    <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
     <Button
      variant="secondary"
      onClick={onSignOut}
      className="flex-1 sm:flex-none"
      icon={<LogOut className="w-4 h-4" />}
     >
      Sign out now
     </Button>
     <Button
      variant="primary"
      onClick={onStay}
      className="flex-1 sm:flex-none"
     >
      Stay signed in
     </Button>
    </div>
   }
  >
   <div className="px-4 py-5 rounded-lg bg-printflow-primary-container/30 border border-printflow-primary/20 text-center">
    <p className="type-label text-printflow-on-surface-variant uppercase tracking-wide">
     Time remaining
    </p>
    <p className="text-3xl font-semibold tabular-nums text-printflow-on-surface mt-1">
     {formatCountdown(msRemaining)}
    </p>
   </div>
   <p className="text-sm text-printflow-on-surface-variant mt-4 leading-relaxed">
    Choose <span className="font-medium text-printflow-on-surface">Stay signed in</span> to
    continue working, or{" "}
    <span className="font-medium text-printflow-on-surface">Sign out now</span>{" "}
    to end your session. If you don&apos;t choose, you&apos;ll be signed out
    automatically when the timer reaches zero.
   </p>
  </Modal>
 );
}
