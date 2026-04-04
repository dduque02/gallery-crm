import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Artwork, InsertArtwork } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Star, ImageIcon } from "lucide-react";

const CATEGORIES = [
  "Painting", "Sculpture", "Photography", "Installation", "Print",
  "Drawing", "Mixed Media", "Digital", "Textile Art", "Work on Paper", "Other",
];
const CONDITIONS = ["Excellent", "Good", "Fair", "Poor", "N/A"];
const CURRENCIES = ["USD", "EUR", "GBP", "CHF", "JPY", "COP"];

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "sold", label: "Sold" },
  { value: "reserved", label: "Reserved" },
  { value: "on_loan", label: "On Loan" },
  { value: "on_consignment", label: "Consignment" },
  { value: "consigned_out", label: "Consigned Out" },
  { value: "not_for_sale", label: "Not for Sale" },
  { value: "returned", label: "Returned" },
  { value: "reference", label: "Reference" },
];
const AVAILABILITY_OPTIONS = [
  { value: "in_stock", label: "In Stock" },
  { value: "consigned_in", label: "Consigned In" },
  { value: "consigned_out", label: "Consigned Out" },
];

function ClickableStars({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5 pt-2">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} type="button" onClick={() => onChange(value === i ? 0 : i)} className="focus:outline-none">
          <Star className={`h-5 w-5 transition-colors ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-amber-300"}`} />
        </button>
      ))}
    </div>
  );
}

interface ArtworkFormProps {
  onSuccess: () => void;
  initial?: Artwork;
}

export function ArtworkForm({ onSuccess, initial }: ArtworkFormProps) {
  const { toast } = useToast();
  const isEdit = !!initial;

  const [form, setForm] = useState<Partial<InsertArtwork>>({
    title: "", artistName: "", medium: "", dimensions: "", year: "",
    inscription: "", retailPrice: 0, retailCurrency: "USD", costPrice: 0,
    status: "available", availability: "in_stock",
    location: "", locationDetail: "", isEdition: false, editionInfo: "",
    category: "", provenance: "", exhibitionHistory: "", literature: "",
    condition: "", conditionNotes: "", importance: 0, stockNumber: "",
    ...(initial ? {
      title: initial.title, artistName: initial.artistName, medium: initial.medium || "",
      dimensions: initial.dimensions || "", year: initial.year || "", inscription: initial.inscription || "",
      retailPrice: initial.retailPrice || 0, retailCurrency: initial.retailCurrency || "USD",
      costPrice: initial.costPrice || 0, status: initial.status, availability: initial.availability || "in_stock",
      location: initial.location || "", locationDetail: initial.locationDetail || "",
      isEdition: initial.isEdition || false, editionInfo: initial.editionInfo || "",
      category: initial.category || "", provenance: initial.provenance || "",
      exhibitionHistory: initial.exhibitionHistory || "", literature: initial.literature || "",
      condition: initial.condition || "", conditionNotes: initial.conditionNotes || "",
      importance: initial.importance || 0, stockNumber: initial.stockNumber || "",
    } : {}),
  });

  const set = (fields: Partial<InsertArtwork>) => setForm(prev => ({ ...prev, ...fields }));

  const mutation = useMutation({
    mutationFn: (data: InsertArtwork) =>
      isEdit ? apiRequest("PATCH", `/api/artworks/${initial!.id}`, data) : apiRequest("POST", "/api/artworks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artworks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: isEdit ? "Artwork updated" : "Artwork added" });
      onSuccess();
    },
  });

  return (
    <div className="flex flex-col h-[70vh]">
      <Tabs defaultValue="artwork" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10 shrink-0">
          {[
            { value: "artwork", label: "Artwork" },
            { value: "provenance", label: "Provenance" },
            { value: "financial", label: "Financial" },
            { value: "location", label: "Location & Condition" },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="text-[10px] uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-2">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <ScrollArea className="flex-1">
          {/* ─── Tab 1: Artwork ─── */}
          <TabsContent value="artwork" className="px-6 py-4 mt-0">
            <div className="flex gap-6">
              {/* Left: fields */}
              <div className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Artist Name *</Label>
                    <Input value={form.artistName} onChange={e => set({ artistName: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Title *</Label>
                    <Input value={form.title} onChange={e => set({ title: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Stock Number</Label>
                    <Input value={form.stockNumber || ""} onChange={e => set({ stockNumber: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Year</Label>
                    <Input value={form.year || ""} onChange={e => set({ year: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Category</Label>
                    <Select value={form.category || ""} onValueChange={v => set({ category: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Medium</Label>
                  <Input value={form.medium || ""} onChange={e => set({ medium: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Dimensions</Label>
                    <Input value={form.dimensions || ""} onChange={e => set({ dimensions: e.target.value })} placeholder="e.g. 100 x 80 cm" />
                  </div>
                  <div>
                    <Label className="text-xs">Inscription (signed/dated)</Label>
                    <Input value={form.inscription || ""} onChange={e => set({ inscription: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={form.isEdition || false} onCheckedChange={v => set({ isEdition: v })} />
                    <Label className="text-xs">Is Edition</Label>
                  </div>
                  {form.isEdition && (
                    <div className="flex-1">
                      <Input value={form.editionInfo || ""} onChange={e => set({ editionInfo: e.target.value })} placeholder="e.g. Edition of 5, AP 2" />
                    </div>
                  )}
                </div>
                <div>
                  <Label className="text-xs">Importance</Label>
                  <ClickableStars value={form.importance || 0} onChange={v => set({ importance: v })} />
                </div>
              </div>
              {/* Right: image preview */}
              <div className="w-48 shrink-0">
                <Label className="text-xs">Preview</Label>
                <div className="mt-1 aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden">
                  {initial?.imageUrl ? (
                    <img src={initial.imageUrl} alt={initial.title} className="object-contain w-full h-full" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                      <ImageIcon className="h-10 w-10" />
                      <span className="text-[10px] uppercase tracking-widest">No image</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Provenance / Exhibitions ─── */}
          <TabsContent value="provenance" className="px-6 py-4 mt-0 space-y-4">
            <div>
              <Label className="text-xs">Provenance</Label>
              <Textarea value={form.provenance || ""} onChange={e => set({ provenance: e.target.value })} rows={4} placeholder="Ownership history..." />
            </div>
            <div>
              <Label className="text-xs">Exhibition History</Label>
              <Textarea value={form.exhibitionHistory || ""} onChange={e => set({ exhibitionHistory: e.target.value })} rows={4} placeholder="Previous exhibitions..." />
            </div>
            <div>
              <Label className="text-xs">Literature</Label>
              <Textarea value={form.literature || ""} onChange={e => set({ literature: e.target.value })} rows={4} placeholder="Publications, catalogues..." />
            </div>
          </TabsContent>

          {/* ─── Tab 3: Financial ─── */}
          <TabsContent value="financial" className="px-6 py-4 mt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.status || "available"} onValueChange={v => set({ status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Availability</Label>
                <Select value={form.availability || "in_stock"} onValueChange={v => set({ availability: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{AVAILABILITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Retail Price</Label>
                <Input type="number" value={form.retailPrice || ""} onChange={e => set({ retailPrice: Number(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={form.retailCurrency || "USD"} onValueChange={v => set({ retailCurrency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Cost Price</Label>
                <Input type="number" value={form.costPrice || ""} onChange={e => set({ costPrice: Number(e.target.value) })} />
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 4: Location & Condition ─── */}
          <TabsContent value="location" className="px-6 py-4 mt-0 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Location</Label>
                <Input value={form.location || ""} onChange={e => set({ location: e.target.value })} placeholder="e.g. Medellín Gallery" />
              </div>
              <div>
                <Label className="text-xs">Location Detail</Label>
                <Input value={form.locationDetail || ""} onChange={e => set({ locationDetail: e.target.value })} placeholder="e.g. Room 2, Wall A" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Condition</Label>
                <Select value={form.condition || ""} onValueChange={v => set({ condition: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{CONDITIONS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Condition Notes</Label>
                <Input value={form.conditionNotes || ""} onChange={e => set({ conditionNotes: e.target.value })} />
              </div>
            </div>
          </TabsContent>
        </ScrollArea>
      </Tabs>

      {/* Footer fijo */}
      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t shrink-0">
        <Button variant="outline" onClick={onSuccess}>Cancel</Button>
        <Button
          onClick={() => mutation.mutate(form as InsertArtwork)}
          disabled={mutation.isPending || !form.title || !form.artistName}
        >
          {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Artwork"}
        </Button>
      </div>
    </div>
  );
}
