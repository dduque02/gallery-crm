import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Artwork, InsertArtwork, Contact } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { Star, Upload, X, Plus, CalendarIcon, ChevronsUpDown, Check } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

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
  { value: "not_for_sale", label: "Not for Sale" },
  { value: "returned", label: "Returned" },
  { value: "reference", label: "Reference" },
];

const MARKET_OPTIONS = [
  { value: "n_a", label: "N/A" },
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
];

const INVOICE_STATUS_OPTIONS = [
  { value: "not_invoiced", label: "Not Invoiced" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
];

const PROFIT_COLORS = ["#6b8cce", "#b0b0b0", "#c5d86d"]; // blue=acquisition, gray=associated, green=profit

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

function DatePickerField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const date = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !value && "text-muted-foreground")}>
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? format(parseISO(value), "MMM yyyy") : (placeholder || "Select date")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => { if (d) { onChange(format(d, "yyyy-MM-dd")); setOpen(false); } }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function ProjectedProfitChart({ retailPrice, costPrice, associatedCosts }: { retailPrice: number; costPrice: number; associatedCosts: number }) {
  const profit = retailPrice - costPrice - associatedCosts;
  if (retailPrice <= 0) return null;

  const data = [
    { name: "Acquisition cost", value: Math.max(costPrice, 0) },
    { name: "Associated costs", value: Math.max(associatedCosts, 0) },
    { name: "Profit", value: Math.max(profit, 0) },
  ].filter(d => d.value > 0);

  if (data.length === 0) return null;

  const profitPct = ((profit / retailPrice) * 100).toFixed(1);
  const currency = "$";

  return (
    <div className="border rounded-lg p-4">
      <h4 className="text-[10px] uppercase tracking-widest text-center text-muted-foreground mb-2">Projected Profit</h4>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                {data.map((_, i) => <Cell key={i} fill={PROFIT_COLORS[
                  _ .name === "Acquisition cost" ? 0 : _.name === "Associated costs" ? 1 : 2
                ]} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {[
            { label: "Acquisition cost", value: costPrice, color: PROFIT_COLORS[0] },
            { label: "Associated costs", value: associatedCosts, color: PROFIT_COLORS[1] },
            { label: "Profit", value: profit, color: PROFIT_COLORS[2] },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
              <span className="text-muted-foreground">{item.label}</span>
              <span className="ml-auto font-medium">{currency}{item.value.toLocaleString()}</span>
            </div>
          ))}
          <div className="pt-1 border-t text-xs text-center">
            <span className="font-semibold">{currency}{profit.toLocaleString()} ({profitPct}%)</span>
            <p className="text-[10px] text-muted-foreground">Based on retail price of {currency}{retailPrice.toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContactCombobox({ value, onChange }: { value: number | null | undefined; onChange: (id: number | null, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: contactsData } = useQuery<{ data: Contact[]; total: number }>({
    queryKey: ["/api/contacts", { search, pageSize: 20 }],
    queryFn: async () => {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(search)}&pageSize=20`);
      return res.json();
    },
    enabled: open,
  });

  const contacts = contactsData?.data || [];

  // Fetch selected contact name
  const { data: selectedContact } = useQuery<Contact>({
    queryKey: ["/api/contacts", value],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${value}`);
      return res.json();
    },
    enabled: !!value,
  });

  const displayName = selectedContact?.name || (value ? `Contact #${value}` : "");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className={cn("w-full justify-between h-9 text-sm font-normal", !value && "text-muted-foreground")}>
          {value ? displayName : "Search contacts..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search contacts..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No contacts found.</CommandEmpty>
            <CommandGroup>
              {contacts.map(c => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange(c.id, c.name);
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === c.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <span className="font-medium">{c.name}</span>
                    {c.company && <span className="text-muted-foreground ml-1">({c.company})</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Upload failed" }));
    throw new Error(err.message);
  }
  const { url } = await res.json();
  return url;
}

interface ImageEntry {
  url: string;
  file?: File;
  isNew: boolean;
}

interface ArtworkFormProps {
  onSuccess: () => void;
  initial?: Artwork;
}

export function ArtworkForm({ onSuccess, initial }: ArtworkFormProps) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<InsertArtwork>>({
    title: "", artistName: "", medium: "", dimensions: "", year: "",
    inscription: "", retailPrice: 0, retailCurrency: "USD", costPrice: 0,
    status: "available", availability: "in_stock",
    location: "", locationDetail: "", isEdition: false, editionInfo: "",
    category: "", provenance: "", exhibitionHistory: "", literature: "",
    condition: "", conditionNotes: "", importance: 0, stockNumber: "",
    // New fields
    isEquipment: false, market: "n_a", associatedCosts: 0,
    consignorId: null, consignorIsArtist: false,
    consignmentFromDate: "", consignmentReturnDue: "",
    consignmentReturned: false, consignmentReminderDate: "",
    consignmentTerms: "", consignmentPercentage: 0,
    consignmentNetValue: 0, consignmentNotes: "",
    consignmentHistory: "", contractSigned: false,
    nonStandardContract: false, consignmentInvoiceStatus: "",
    additionalCertificates: "", additionalDocuments: "",
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
      // New fields from initial
      isEquipment: initial.isEquipment || false, market: initial.market || "n_a",
      associatedCosts: initial.associatedCosts || 0,
      consignorId: initial.consignorId || null, consignorIsArtist: initial.consignorIsArtist || false,
      consignmentFromDate: initial.consignmentFromDate || "",
      consignmentReturnDue: initial.consignmentReturnDue || "",
      consignmentReturned: initial.consignmentReturned || false,
      consignmentReminderDate: initial.consignmentReminderDate || "",
      consignmentTerms: initial.consignmentTerms || "",
      consignmentPercentage: initial.consignmentPercentage || 0,
      consignmentNetValue: initial.consignmentNetValue || 0,
      consignmentNotes: initial.consignmentNotes || "",
      consignmentHistory: initial.consignmentHistory || "",
      contractSigned: initial.contractSigned || false,
      nonStandardContract: initial.nonStandardContract || false,
      consignmentInvoiceStatus: initial.consignmentInvoiceStatus || "",
      additionalCertificates: initial.additionalCertificates || "",
      additionalDocuments: initial.additionalDocuments || "",
    } : {}),
  });

  // Primary image
  const [primaryImage, setPrimaryImage] = useState<ImageEntry | null>(
    initial?.imageUrl ? { url: initial.imageUrl, isNew: false } : null
  );
  const [primaryDragOver, setPrimaryDragOver] = useState(false);

  // Secondary images
  const [secondaryImages, setSecondaryImages] = useState<ImageEntry[]>(
    (initial?.secondaryImages || []).map(url => ({ url, isNew: false }))
  );
  const [secondaryDragOver, setSecondaryDragOver] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (primaryImage?.isNew && primaryImage.url.startsWith("blob:")) URL.revokeObjectURL(primaryImage.url);
      secondaryImages.forEach(img => {
        if (img.isNew && img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
      });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast({ title: "Invalid format", description: "Only JPG, PNG, and WebP are accepted.", variant: "destructive" });
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "File too large", description: "Maximum size is 20 MB.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handlePrimaryFile = (file: File) => {
    if (!validateFile(file)) return;
    if (primaryImage?.isNew && primaryImage.url.startsWith("blob:")) URL.revokeObjectURL(primaryImage.url);
    setPrimaryImage({ url: URL.createObjectURL(file), file, isNew: true });
  };

  const handleSecondaryFiles = (files: FileList) => {
    const newEntries: ImageEntry[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!validateFile(file)) continue;
      newEntries.push({ url: URL.createObjectURL(file), file, isNew: true });
    }
    setSecondaryImages(prev => [...prev, ...newEntries]);
  };

  const removeSecondary = (index: number) => {
    setSecondaryImages(prev => {
      const img = prev[index];
      if (img.isNew && img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const promoteToSecondary = () => {
    if (primaryImage) {
      setSecondaryImages(prev => [...prev, primaryImage]);
    }
  };

  const promoteSecondaryToPrimary = (index: number) => {
    const img = secondaryImages[index];
    if (primaryImage) {
      setSecondaryImages(prev => {
        const updated = [...prev];
        updated[index] = primaryImage;
        return updated;
      });
    } else {
      setSecondaryImages(prev => prev.filter((_, i) => i !== index));
    }
    setPrimaryImage(img);
  };

  const clearPrimary = () => {
    if (primaryImage?.isNew && primaryImage.url.startsWith("blob:")) URL.revokeObjectURL(primaryImage.url);
    setPrimaryImage(null);
    if (primaryInputRef.current) primaryInputRef.current.value = "";
  };

  const set = (fields: Partial<InsertArtwork>) => setForm(prev => ({ ...prev, ...fields }));

  const mutation = useMutation({
    mutationFn: async (data: InsertArtwork) => {
      setIsUploading(true);

      // Upload primary if new
      let imageUrl = initial?.imageUrl || null;
      if (primaryImage?.isNew && primaryImage.file) {
        imageUrl = await uploadImage(primaryImage.file);
      } else if (primaryImage && !primaryImage.isNew) {
        imageUrl = primaryImage.url;
      } else {
        imageUrl = null;
      }

      // Upload secondary images (only new ones)
      const secondaryUrls: string[] = [];
      for (const img of secondaryImages) {
        if (img.isNew && img.file) {
          const url = await uploadImage(img.file);
          secondaryUrls.push(url);
        } else {
          secondaryUrls.push(img.url);
        }
      }

      setIsUploading(false);

      const payload = { ...data, imageUrl, secondaryImages: secondaryUrls.length > 0 ? secondaryUrls : null };
      return isEdit
        ? apiRequest("PATCH", `/api/artworks/${initial!.id}`, payload)
        : apiRequest("POST", "/api/artworks", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artworks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: isEdit ? "Artwork updated" : "Artwork added" });
      onSuccess();
    },
    onError: (err: Error) => {
      setIsUploading(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="flex flex-col h-[70vh]">
      <Tabs defaultValue="artwork" className="flex flex-col flex-1 min-h-0">
        <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-10 shrink-0">
          {[
            { value: "artwork", label: "Artwork" },
            { value: "provenance", label: "Provenance & Docs" },
            { value: "financial", label: "Financial" },
            { value: "acquisition", label: "Acquisition" },
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

              {/* Right: images */}
              <div className="w-48 shrink-0 space-y-3">
                {/* Primary image */}
                <div>
                  <Label className="text-xs">Main Image</Label>
                  <div
                    className={`mt-1 aspect-square bg-muted rounded-md flex items-center justify-center overflow-hidden relative cursor-pointer border-2 border-dashed transition-colors ${primaryDragOver ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/30"}`}
                    onDragOver={e => { e.preventDefault(); e.stopPropagation(); setPrimaryDragOver(true); }}
                    onDragLeave={() => setPrimaryDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setPrimaryDragOver(false);
                      const file = e.dataTransfer.files[0];
                      if (file) handlePrimaryFile(file);
                    }}
                    onClick={() => primaryInputRef.current?.click()}
                  >
                    {primaryImage ? (
                      <img src={primaryImage.url} alt="Main" className="object-contain w-full h-full" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-muted-foreground/30">
                        <Upload className="h-8 w-8" />
                        <span className="text-[10px] uppercase tracking-widest text-center px-2">Drop or click</span>
                      </div>
                    )}
                    <input
                      ref={primaryInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePrimaryFile(f); }}
                    />
                  </div>
                  {primaryImage && (
                    <button type="button" onClick={clearPrimary}
                      className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-3 w-3" /> Remove
                    </button>
                  )}
                </div>

                {/* Secondary images */}
                <div>
                  <Label className="text-xs">Additional Images</Label>
                  <div className="mt-1 grid grid-cols-3 gap-1.5">
                    {secondaryImages.map((img, i) => (
                      <div key={i} className="relative group aspect-square bg-muted rounded overflow-hidden">
                        <img
                          src={img.url} alt="" className="object-cover w-full h-full cursor-pointer"
                          onClick={() => promoteSecondaryToPrimary(i)}
                          title="Click to set as main"
                        />
                        <button type="button"
                          onClick={() => removeSecondary(i)}
                          className="absolute top-0.5 right-0.5 h-4 w-4 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="h-2.5 w-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                    {/* Add more button */}
                    <div
                      className={`aspect-square bg-muted rounded flex items-center justify-center cursor-pointer border-2 border-dashed transition-colors ${secondaryDragOver ? "border-primary bg-primary/5" : "border-transparent hover:border-muted-foreground/30"}`}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); setSecondaryDragOver(true); }}
                      onDragLeave={() => setSecondaryDragOver(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setSecondaryDragOver(false);
                        handleSecondaryFiles(e.dataTransfer.files);
                      }}
                      onClick={() => secondaryInputRef.current?.click()}
                    >
                      <Plus className="h-4 w-4 text-muted-foreground/40" />
                      <input
                        ref={secondaryInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={e => { if (e.target.files) handleSecondaryFiles(e.target.files); e.target.value = ""; }}
                      />
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">Click a thumbnail to set as main</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── Tab 2: Provenance & Docs ─── */}
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
            <div className="border-t pt-4">
              <div>
                <Label className="text-xs">Additional Certificates</Label>
                <Textarea value={form.additionalCertificates || ""} onChange={e => set({ additionalCertificates: e.target.value })} rows={3} placeholder="Certificate details..." />
              </div>
            </div>
            <div>
              <Label className="text-xs">Additional Documents</Label>
              <Textarea value={form.additionalDocuments || ""} onChange={e => set({ additionalDocuments: e.target.value })} rows={3} placeholder="Document references..." />
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
                <Label className="text-xs">Market</Label>
                <div className="flex gap-4 pt-5">
                  {MARKET_OPTIONS.map(o => (
                    <label key={o.value} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="market"
                        checked={(form.market || "n_a") === o.value}
                        onChange={() => set({ market: o.value })}
                        className="accent-primary"
                      />
                      <span className="text-xs">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="equipment"
                checked={form.isEquipment || false}
                onCheckedChange={(v) => set({ isEquipment: !!v })}
              />
              <Label htmlFor="equipment" className="text-xs cursor-pointer">This item is equipment</Label>
            </div>

            {/* Pricing */}
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Associated Costs</Label>
                <Input type="number" value={form.associatedCosts || ""} onChange={e => set({ associatedCosts: Number(e.target.value) })} />
              </div>
            </div>

            {/* Projected Profit Chart */}
            <ProjectedProfitChart
              retailPrice={form.retailPrice || 0}
              costPrice={form.costPrice || 0}
              associatedCosts={form.associatedCosts || 0}
            />
          </TabsContent>

          {/* ─── Tab 4: Acquisition ─── */}
          <TabsContent value="acquisition" className="px-6 py-4 mt-0 space-y-4">
            {/* Acquisition Type Toggle */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
              <button
                type="button"
                onClick={() => set({ availability: "consigned_in" })}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
                  form.availability === "consigned_in"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Consignment
              </button>
              <button
                type="button"
                onClick={() => set({ availability: "in_stock" })}
                className={cn(
                  "px-4 py-1.5 text-xs font-medium rounded-md transition-colors",
                  form.availability === "in_stock"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Purchase
              </button>
            </div>

            {/* ── Consignment Fields ── */}
            {form.availability === "consigned_in" && (
              <div className="space-y-4">
                {/* Consignor */}
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Consignor Details</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Consigned by</Label>
                      <ContactCombobox
                        value={form.consignorId}
                        onChange={(id, name) => set({ consignorId: id })}
                      />
                    </div>
                    <div className="flex items-end pb-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="consignorIsArtist"
                          checked={form.consignorIsArtist || false}
                          onCheckedChange={(v) => set({ consignorIsArtist: !!v })}
                        />
                        <Label htmlFor="consignorIsArtist" className="text-xs cursor-pointer">Consignor is the artist</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Dates</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">From date</Label>
                      <DatePickerField
                        value={form.consignmentFromDate || ""}
                        onChange={v => set({ consignmentFromDate: v })}
                        placeholder="Select start date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Return due</Label>
                      <div className="flex gap-2 items-center">
                        <div className="flex-1">
                          <DatePickerField
                            value={form.consignmentReturnDue || ""}
                            onChange={v => set({ consignmentReturnDue: v })}
                            placeholder="Select return date"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Checkbox
                            id="returned"
                            checked={form.consignmentReturned || false}
                            onCheckedChange={(v) => set({ consignmentReturned: !!v })}
                          />
                          <Label htmlFor="returned" className="text-xs cursor-pointer whitespace-nowrap">Returned</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Reminder date</Label>
                      <DatePickerField
                        value={form.consignmentReminderDate || ""}
                        onChange={v => set({ consignmentReminderDate: v })}
                        placeholder="Set reminder"
                      />
                    </div>
                  </div>
                </div>

                {/* Terms */}
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Terms</h3>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="consignmentTerms"
                        checked={form.consignmentTerms === "percentage"}
                        onChange={() => set({ consignmentTerms: "percentage" })}
                        className="accent-primary"
                      />
                      <span className="text-xs">Work to a percentage</span>
                    </label>
                    {form.consignmentTerms === "percentage" && (
                      <div className="ml-6 w-32">
                        <Input
                          type="number"
                          value={form.consignmentPercentage || ""}
                          onChange={e => { const pct = Number(e.target.value); set({ consignmentPercentage: pct, costPrice: Math.round((form.retailPrice || 0) * pct / 100) }); }}
                          placeholder="%"
                        />
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="consignmentTerms"
                        checked={form.consignmentTerms === "net_value"}
                        onChange={() => set({ consignmentTerms: "net_value" })}
                        className="accent-primary"
                      />
                      <span className="text-xs">Work to a net value (cost price for margin scheme)</span>
                    </label>
                    {form.consignmentTerms === "net_value" && (
                      <div className="ml-6 flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">$</span>
                        <Input
                          type="number"
                          className="w-40"
                          value={form.consignmentNetValue || ""}
                          onChange={e => { const v = Number(e.target.value); set({ consignmentNetValue: v, costPrice: v }); }}
                          placeholder="Amount"
                        />
                        {form.consignorId && (
                          <span className="text-xs text-muted-foreground">to consignor</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes & History */}
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={form.consignmentNotes || ""} onChange={e => set({ consignmentNotes: e.target.value })} rows={3} placeholder="Consignment notes..." />
                  </div>
                  <div>
                    <Label className="text-xs">History</Label>
                    <Textarea value={form.consignmentHistory || ""} onChange={e => set({ consignmentHistory: e.target.value })} rows={3} placeholder="Consignment history..." />
                  </div>
                </div>

                {/* Contract */}
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Contract</h3>
                  <div className="flex gap-6">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="contractSigned"
                        checked={form.contractSigned || false}
                        onCheckedChange={(v) => set({ contractSigned: !!v })}
                      />
                      <Label htmlFor="contractSigned" className="text-xs cursor-pointer">Contract signed</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="nonStandardContract"
                        checked={form.nonStandardContract || false}
                        onCheckedChange={(v) => set({ nonStandardContract: !!v })}
                      />
                      <Label htmlFor="nonStandardContract" className="text-xs cursor-pointer">Non standard contract</Label>
                    </div>
                  </div>
                  <div className="w-48">
                    <Label className="text-xs">Consignment invoice status</Label>
                    <Select value={form.consignmentInvoiceStatus || ""} onValueChange={v => set({ consignmentInvoiceStatus: v })}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{INVOICE_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* ── Purchase Fields ── */}
            {form.availability === "in_stock" && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <h3 className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Purchase Details</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Purchased from</Label>
                      <ContactCombobox
                        value={form.consignorId}
                        onChange={(id, name) => set({ consignorId: id })}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Purchase date</Label>
                      <DatePickerField
                        value={form.consignmentFromDate || ""}
                        onChange={v => set({ consignmentFromDate: v })}
                        placeholder="Select date"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Purchase price</Label>
                      <Input type="number" value={form.costPrice || ""} onChange={e => set({ costPrice: Number(e.target.value) })} placeholder="Amount paid" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={form.consignmentNotes || ""} onChange={e => set({ consignmentNotes: e.target.value })} rows={3} placeholder="Purchase notes..." />
                </div>
              </div>
            )}
          </TabsContent>

          {/* ─── Tab 5: Location & Condition ─── */}
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
          disabled={mutation.isPending || isUploading || !form.title || !form.artistName}
        >
          {isUploading ? "Uploading images..." : mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Artwork"}
        </Button>
      </div>
    </div>
  );
}
