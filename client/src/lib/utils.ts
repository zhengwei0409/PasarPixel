// clsx: merges multiple class names into one string
// ClassValue: TypeScript type for accepted input values (string, array, object, etc.)
import { clsx, type ClassValue } from "clsx"
// twMerge: resolves Tailwind CSS class conflicts (e.g. px-2 + px-4 → keeps px-4)
import { twMerge } from "tailwind-merge"

// cn (class names): shadcn/ui helper used by all components to safely merge Tailwind classes
// Usage: cn("px-2 text-sm", isActive && "bg-blue-500")
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs)) // step 1: clsx merges → step 2: twMerge resolves conflicts
}
