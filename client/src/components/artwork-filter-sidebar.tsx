import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";

const ARTWORK_TYPES = [
  "Painting", "Sculpture", "Photography", "Installation", "Print",
  "Drawing", "Mixed Media", "Digital", "Textile Art", "Work on Paper",
];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "consigned_out", label: "Consigned Out" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "not_for_sale", label: "Not for Sale" },
  { value: "returned", label: "Returned" },
  { value: "on_loan", label: "On Loan" },
  { value: "reference", label: "Reference" },
];

interface FilterSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  selectedStatuses: string[];
  onStatusesChange: (statuses: string[]) => void;
  selectedLocations: string[];
  onLocationsChange: (locations: string[]) => void;
  locations: string[];
  showStatusFilter: boolean;
  showLocationFilter: boolean;
}

function toggleValue(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
}

function FilterSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen ?? true}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-1 group">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pb-3 px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ArtworkFilterSidebar({
  open, onOpenChange,
  selectedCategories, onCategoriesChange,
  selectedStatuses, onStatusesChange,
  selectedLocations, onLocationsChange,
  locations,
  showStatusFilter, showLocationFilter,
}: FilterSidebarProps) {
  const totalActive = selectedCategories.length + selectedStatuses.length + selectedLocations.length;

  const handleClearAll = () => {
    onCategoriesChange([]);
    onStatusesChange([]);
    onLocationsChange([]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xs font-bold uppercase tracking-widest">Filters</SheetTitle>
            {totalActive > 0 && (
              <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest h-6 px-2 font-medium text-muted-foreground" onClick={handleClearAll}>
                Clear All
              </Button>
            )}
          </div>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="px-4 py-2 space-y-1">
            <FilterSection title="Artwork Type" defaultOpen={true}>
              <div className="space-y-1.5">
                {ARTWORK_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedCategories.includes(type)}
                      onCheckedChange={() => onCategoriesChange(toggleValue(selectedCategories, type))}
                    />
                    <span className="text-xs">{type}</span>
                  </label>
                ))}
              </div>
            </FilterSection>

            {showStatusFilter && (
              <FilterSection title="Status" defaultOpen={true}>
                <div className="space-y-1.5">
                  {STATUS_OPTIONS.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedStatuses.includes(opt.value)}
                        onCheckedChange={() => onStatusesChange(toggleValue(selectedStatuses, opt.value))}
                      />
                      <span className="text-xs">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>
            )}

            {showLocationFilter && locations.length > 0 && (
              <FilterSection title="Location" defaultOpen={false}>
                <div className="space-y-1.5">
                  {locations.map(loc => (
                    <label key={loc} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedLocations.includes(loc)}
                        onCheckedChange={() => onLocationsChange(toggleValue(selectedLocations, loc))}
                      />
                      <span className="text-xs">{loc}</span>
                    </label>
                  ))}
                </div>
              </FilterSection>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
