"use client";

import { useEffect } from "react";
import { X, CheckCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  type?: "success" | "error" | "info" | "loading";
  showClose?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  type = "info",
  showClose = true,
}: ModalProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle className="h-12 w-12 text-green-400" />,
    error: <AlertTriangle className="h-12 w-12 text-red-400" />,
    info: <Info className="h-12 w-12 text-cyan-400" />,
    loading: <Loader2 className="h-12 w-12 text-white animate-spin" />,
  };

  const borderColors = {
    success: "border-green-400",
    error: "border-red-400",
    info: "border-white",
    loading: "border-white",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
        onClick={type !== "loading" ? onClose : undefined}
      />

      {/* Modal */}
      <div
        className={`relative bg-black border-2 ${borderColors[type]} p-8 max-w-md w-full mx-4 font-mono animate-in fade-in zoom-in duration-200`}
      >
        {/* Close Button */}
        {showClose && type !== "loading" && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 border-2 border-white p-2 hover:bg-white hover:text-black transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Content */}
        <div className="text-center">
          {/* Icon */}
          <div className="flex justify-center mb-6">{icons[type]}</div>

          {/* Title */}
          {title && (
            <h2 className="text-xl font-bold tracking-wider mb-4 uppercase">
              {title}
            </h2>
          )}

          {/* Body */}
          <div className="text-sm text-white/80 leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Convenience component for success modal
interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SuccessModal({
  isOpen,
  onClose,
  title,
  message,
  actionLabel = "OK",
  onAction,
}: SuccessModalProps) {
  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} type="success" title={title}>
      <p className="mb-6">{message}</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={handleAction}
          className="border-2 border-green-400 bg-green-400 text-black px-8 py-3 text-sm font-bold tracking-wider hover:bg-black hover:text-green-400 transition-colors"
        >
          [{actionLabel}]
        </button>
      </div>
    </Modal>
  );
}

// Convenience component for confirmation modal
interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: "info" | "error";
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "CONFIRM",
  cancelLabel = "CANCEL",
  type = "info",
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} type={type} title={title}>
      <p className="mb-6">{message}</p>
      <div className="flex justify-center gap-4">
        <button
          onClick={onClose}
          className="border-2 border-white px-6 py-3 text-sm font-bold tracking-wider hover:bg-white hover:text-black transition-colors"
        >
          [{cancelLabel}]
        </button>
        <button
          onClick={onConfirm}
          className="border-2 border-white bg-white text-black px-6 py-3 text-sm font-bold tracking-wider hover:bg-black hover:text-white transition-colors"
        >
          [{confirmLabel}]
        </button>
      </div>
    </Modal>
  );
}

// Loading modal
interface LoadingModalProps {
  isOpen: boolean;
  message?: string;
}

export function LoadingModal({ isOpen, message = "PROCESSING..." }: LoadingModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={() => {}} type="loading" showClose={false}>
      <p className="text-white/60 tracking-wider">{message}</p>
    </Modal>
  );
}
