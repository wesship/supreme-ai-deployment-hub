
// This is a wrapper around the toast component from shadcn/ui
import { Toast, ToastActionElement, ToastProps } from "@/components/ui/toast";

// Define the extended toast props type with all required properties
export type ExtendedToastProps = {
  variant?: 'default' | 'destructive' | 'success' | 'warning' | 'info';
  title?: string;
  description?: string;
  duration?: number;
  action?: ToastActionElement;
};

// Internal state for imperative toast calls (mirrors shadcn/ui pattern)
type ToastFn = (props: ExtendedToastProps) => void;
let _toastFn: ToastFn | null = null;

/** Called once by the Toaster component to register the imperative handler */
export const _registerToast = (fn: ToastFn) => { _toastFn = fn; };

/** Imperative toast helper — safe to call outside React components */
export const toast = (props: ExtendedToastProps) => {
  if (_toastFn) _toastFn(props);
};

// Wrapper for useToast that handles the extended variants
export const useToast = () => {
  return {
    toast,
  };
};
