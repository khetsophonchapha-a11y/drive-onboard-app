import * as React from "react";
import { ChevronsUpDown, X, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string;
};

export type SearchableSelectProps = {
  options: SearchableSelectOption[];
  value?: string;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  allowClear?: boolean;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
};

const MAX_VISIBLE = 100; // render at most 100 items at a time for performance

export const SearchableSelect = React.forwardRef<HTMLButtonElement, SearchableSelectProps>(({
  options,
  value,
  onChange,
  placeholder = "เลือกตัวเลือก...",
  searchPlaceholder = "ค้นหา...",
  emptyLabel = "ไม่พบข้อมูล",
  allowClear = false,
  disabled,
  className,
  contentClassName,
}, ref) => {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = React.useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  );

  const filteredOptions = React.useMemo(() => {
    let result = options;
    if (query.trim()) {
      const lowerQuery = query.trim().toLowerCase();
      result = options.filter(
        (option) =>
          option.label.toLowerCase().includes(lowerQuery) ||
          option.value.toLowerCase().includes(lowerQuery) ||
          option.description?.toLowerCase().includes(lowerQuery)
      );
    }
    // Limit rendered items for performance with large datasets
    return result.slice(0, MAX_VISIBLE);
  }, [options, query]);

  const totalMatches = React.useMemo(() => {
    if (!query.trim()) return options.length;
    const lowerQuery = query.trim().toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(lowerQuery) ||
        option.value.toLowerCase().includes(lowerQuery) ||
        option.description?.toLowerCase().includes(lowerQuery)
    ).length;
  }, [options, query]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    setQuery("");
  };

  // Auto-focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !selectedOption && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <span className="truncate flex-1 text-left">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <div className="flex items-center gap-1 ml-2 shrink-0">
            {allowClear && value && (
              <span
                role="button"
                tabIndex={-1}
                className="rounded-full hover:bg-muted p-0.5"
                onClick={handleClear}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClear(e as unknown as React.MouseEvent); }}
              >
                <X className="h-3.5 w-3.5 opacity-60" />
                <span className="sr-only">ล้างค่า</span>
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn("w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0", contentClassName)}
        align="start"
        sideOffset={4}
      >
        {/* Search input */}
        <div className="p-2 border-b">
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8"
          />
        </div>

        {/* Scrollable options list */}
        <div
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: "240px" }}
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <div className="py-1">
              {filteredOptions.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent transition-colors",
                      isSelected && "bg-accent font-medium"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate leading-none">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="text-xs text-muted-foreground truncate">
                          {option.description}
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Show count when there are many results */}
        {totalMatches > MAX_VISIBLE && (
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground text-center">
            แสดง {MAX_VISIBLE} จาก {totalMatches} รายการ — พิมพ์เพื่อกรองเพิ่มเติม
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});
SearchableSelect.displayName = "SearchableSelect";
