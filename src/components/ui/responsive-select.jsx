import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Wrapper responsivo para campos de seleção.
// - Desktop (>=768px): dropdown Popover padrão (Select do shadcn).
// - Mobile (<768px): bottom sheet deslizante (Drawer) — melhor usabilidade touch,
//   evita o Popover dentro de Drawers/Dialogs mobile.
// API: options=[{value,label}], value, onValueChange, placeholder.
export function ResponsiveSelect({
  value,
  onValueChange,
  options = [],
  placeholder,
  triggerClassName,
  title,
  disabled,
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label;

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className={cn("rounded-xl", triggerClassName)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 rounded-xl",
          triggerClassName
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
      </button>
      <DrawerContent>
        {title && (
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
        )}
        <div className="max-h-[60vh] overflow-y-auto p-2 pb-6">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onValueChange?.(o.value);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center justify-between rounded-lg px-3 py-3 text-sm text-left transition-colors",
                o.value === value
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-secondary"
              )}
            >
              {o.label}
              {o.value === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default ResponsiveSelect;