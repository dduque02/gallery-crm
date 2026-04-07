import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Artwork } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ArtworkFilterSidebar } from "@/components/artwork-filter-sidebar";
import { ArtworkForm } from "@/components/artwork-form";
import {
  Plus, Search, ImageIcon, Star, X, Pencil, ArrowUpDown, Trash2,
  ChevronLeft, ChevronRight, SlidersHorizontal, Eye, EyeOff,
} from "lucide-react";

const statusDot: Record<string, string> = {
  available: "bg-emerald-500", reserved: "bg-amber-400", sold: "bg-red-500",
  on_loan: "bg-blue-400", on_consignment: "bg-purple-400", consigned_out: "bg-purple-400",
  not_for_sale: "bg-gray-400", returned: "bg-orange-400", reference: "bg-cyan-400",
};
const statusLabels: Record<string, string> = {
  available: "Available", sold: "Sold", on_loan: "On Loan",
  on_consignment: "Consignment", consigned_out: "Consigned Out", reserved: "Reserved",
  not_for_sale: "Not for Sale", returned: "Returned", reference: "Reference",
};

function formatCurrency(val: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

function ImportanceStars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-3 w-3 ${i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

interface PaginatedArtworks {
  data: Artwork[];
  total: number;
  page: number;
  pageSize: number;
}

function DetailRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (<div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p><p className={`text-sm ${multiline ? "whitespace-pre-line" : ""}`}>{value}</p></div>);
}

function DetailPanel({ artwork, onClose, onEdit, onDelete }: { artwork: Artwork; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const allImages = [
    ...(artwork.imageUrl ? [artwork.imageUrl] : []),
    ...(artwork.secondaryImages || []),
  ];
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{artwork.stockNumber || `#${artwork.id}`}</span>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Delete artwork?</AlertDialogTitle><AlertDialogDescription>This will permanently delete "{artwork.title}".</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <div className="aspect-square bg-muted flex items-center justify-center shrink-0 overflow-hidden">
        {allImages.length > 0 ? (
          <img src={allImages[activeImageIdx] || allImages[0]} alt={artwork.title} className="object-contain w-full h-full" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/30"><ImageIcon className="h-12 w-12" /><span className="text-[10px] uppercase tracking-widest">No image</span></div>
        )}
      </div>
      {allImages.length > 1 && (
        <div className="flex gap-1 px-4 py-2 border-b shrink-0 overflow-x-auto">
          {allImages.map((url, i) => (
            <button key={i} type="button" onClick={() => setActiveImageIdx(i)}
              className={`h-10 w-10 shrink-0 rounded overflow-hidden border-2 transition-colors ${i === activeImageIdx ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}>
              <img src={url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <div className="px-4 py-3 border-b space-y-1 shrink-0">
        <p className="text-xs font-bold uppercase tracking-wide">{artwork.artistName}</p>
        <p className="text-sm"><span className="italic">{artwork.title}</span>{artwork.year && <span className="text-muted-foreground">, {artwork.year}</span>}</p>
        {artwork.medium && <p className="text-xs text-muted-foreground">{artwork.medium}</p>}
        {artwork.dimensions && <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>}
        <div className="flex items-center gap-2 pt-1">
          <div className={`h-2 w-2 rounded-full ${statusDot[artwork.status]}`} />
          <span className="text-[10px] uppercase tracking-widest font-medium">{statusLabels[artwork.status]}</span>
          {(artwork.importance ?? 0) > 0 && <ImportanceStars value={artwork.importance ?? 0} />}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <Tabs defaultValue="prices" className="h-full flex flex-col">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4 h-9 shrink-0">
            {["prices", "status", "location", "provenance", "info"].map(t => (
              <TabsTrigger key={t} value={t} className="text-[10px] uppercase tracking-widest rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-1.5">{t}</TabsTrigger>
            ))}
          </TabsList>
          <ScrollArea className="flex-1">
            <TabsContent value="prices" className="px-4 py-3 space-y-3 mt-0">
              <DetailRow label="Retail Price" value={artwork.retailPrice ? formatCurrency(artwork.retailPrice, artwork.retailCurrency || "USD") : "\u2014"} />
              <DetailRow label="Cost Price" value={artwork.costPrice ? formatCurrency(artwork.costPrice, artwork.retailCurrency || "USD") : "\u2014"} />
              {artwork.retailPrice && artwork.costPrice && <DetailRow label="Margin" value={`${Math.round(((artwork.retailPrice - artwork.costPrice) / artwork.retailPrice) * 100)}%`} />}
              <DetailRow label="Currency" value={artwork.retailCurrency || "USD"} />
            </TabsContent>
            <TabsContent value="status" className="px-4 py-3 space-y-3 mt-0">
              <DetailRow label="Status" value={statusLabels[artwork.status]} />
              <DetailRow label="Availability" value={artwork.availability?.replace(/_/g, " ") || "\u2014"} />
              <DetailRow label="Condition" value={artwork.condition || "\u2014"} />
              {artwork.category && <DetailRow label="Category" value={artwork.category} />}
              {artwork.genre && <DetailRow label="Genre" value={artwork.genre} />}
              {artwork.series && <DetailRow label="Series" value={artwork.series} />}
            </TabsContent>
            <TabsContent value="location" className="px-4 py-3 space-y-3 mt-0">
              <DetailRow label="Location" value={artwork.location || "\u2014"} />
              <DetailRow label="Detail" value={artwork.locationDetail || "\u2014"} />
            </TabsContent>
            <TabsContent value="provenance" className="px-4 py-3 space-y-3 mt-0">
              <DetailRow label="Provenance" value={artwork.provenance || "\u2014"} multiline />
              {artwork.exhibitionHistory && <DetailRow label="Exhibition History" value={artwork.exhibitionHistory} multiline />}
              {artwork.literature && <DetailRow label="Literature" value={artwork.literature} multiline />}
            </TabsContent>
            <TabsContent value="info" className="px-4 py-3 space-y-3 mt-0">
              {artwork.description && <DetailRow label="Description" value={artwork.description} multiline />}
              {artwork.internalNotes && <DetailRow label="Internal Notes" value={artwork.internalNotes} multiline />}
              {artwork.tags && artwork.tags.length > 0 && (
                <div><p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">{artwork.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}</div>
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </div>
    </div>
  );
}

interface ArtistSummary {
  artistName: string;
  count: number;
  imageUrl: string | null;
  group: string;
}

export default function Artworks() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("artist");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editArtwork, setEditArtwork] = useState<Artwork | null>(null);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [artistGroup, setArtistGroup] = useState<"active" | "for_review">("active");
  const { toast } = useToast();

  const statusParam = selectedStatuses.length > 0 ? selectedStatuses.join(",") : "all";
  const categoryParam = selectedCategories.length > 0 ? selectedCategories.join(",") : "all";
  const locationParam = selectedLocations.length > 0 ? selectedLocations.join(",") : "all";
  const filterCount = selectedStatuses.length + selectedCategories.length + selectedLocations.length;

  // Locations from DB
  const { data: locations = [] } = useQuery<string[]>({
    queryKey: ["/api/artworks/locations"],
    queryFn: async () => { const res = await fetch("/api/artworks/locations"); return res.json(); },
  });

  // Artists list — filtered by category and group
  const { data: artists, isLoading: artistsLoading } = useQuery<ArtistSummary[]>({
    queryKey: ["/api/artists", categoryParam, artistGroup],
    queryFn: async () => {
      const params = new URLSearchParams({ category: categoryParam, group: artistGroup });
      const res = await fetch(`/api/artists?${params}`);
      return res.json();
    },
    enabled: !selectedArtist,
  });

  // Artworks — only fetched when an artist is selected
  const { data: result, isLoading } = useQuery<PaginatedArtworks>({
    queryKey: ["/api/artworks", page, search, statusParam, categoryParam, locationParam, sortBy, selectedArtist],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page), pageSize: String(pageSize),
        search: selectedArtist || search,
        status: statusParam, category: categoryParam, location: locationParam,
        sort: sortBy,
      });
      const res = await fetch(`/api/artworks?${params}`);
      return res.json();
    },
    enabled: !!selectedArtist,
  });

  const artworksList = result?.data || [];
  const total = result?.total || 0;
  const totalPages = Math.ceil(total / pageSize);
  const selected = selectedId ? artworksList.find(a => a.id === selectedId) : null;

  // Filter artists by search
  const filteredArtists = (artists || []).filter(a =>
    !searchInput || a.artistName.toLowerCase().includes(searchInput.toLowerCase())
  );

  const groupMutation = useMutation({
    mutationFn: ({ artistName, group }: { artistName: string; group: string }) =>
      apiRequest("PUT", "/api/artists/group", { artistName, group }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artists"] });
      toast({ title: "Artist group updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/artworks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/artworks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setSelectedId(null);
      toast({ title: "Artwork deleted" });
    },
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && selectedArtist) { setSearch(searchInput); setPage(1); }
  };

  const handleBackToArtists = () => {
    setSelectedArtist(null);
    setSelectedId(null);
    setSearch("");
    setSearchInput("");
    setPage(1);
    setSelectedStatuses([]);
    setSelectedLocations([]);
    // Keep selectedCategories — they apply at artist level too
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-4">
          {selectedArtist ? (
            <>
              <Button variant="ghost" size="sm" className="text-[10px] uppercase tracking-widest h-7 px-2 font-semibold" onClick={handleBackToArtists}>
                <ChevronLeft className="h-3 w-3 mr-1" />Artists
              </Button>
              <h1 className="text-sm font-bold uppercase tracking-widest">{selectedArtist}</h1>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{total} works</span>
            </>
          ) : (
            <>
              <h1 className="text-sm font-bold uppercase tracking-widest">Artists</h1>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{filteredArtists.length} artists</span>
              <Button
                variant={artistGroup === "for_review" ? "secondary" : "ghost"}
                size="sm"
                className="text-[10px] uppercase tracking-widest h-7 px-3 font-semibold gap-1"
                onClick={() => setArtistGroup(g => g === "active" ? "for_review" : "active")}
              >
                {artistGroup === "for_review" ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                For Review
              </Button>
            </>
          )}
        </div>
        {selectedArtist && (
          <Select value={sortBy} onValueChange={v => { setSortBy(v); setPage(1); }}>
            <SelectTrigger className="h-7 text-[10px] uppercase tracking-widest w-auto gap-1 border-0 bg-transparent font-medium text-muted-foreground">
              <ArrowUpDown className="h-3 w-3" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="artist">Artist A\u2013Z</SelectItem>
              <SelectItem value="price">Highest Price</SelectItem>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="stock_number">Stock No.</SelectItem>
              <SelectItem value="year">Year</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 md:px-6 py-2 border-b shrink-0 flex-wrap">
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setFilterOpen(true)}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {filterCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-[20px] px-1.5 text-[10px] font-semibold">{filterCount}</Badge>
          )}
        </Button>
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={selectedArtist ? "Search works... (Enter)" : "Filter artists..."}
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => { if (selectedArtist && searchInput !== search) { setSearch(searchInput); setPage(1); } }}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Button size="sm" className="h-8 text-[10px] uppercase tracking-widest font-semibold ml-auto shrink-0" onClick={() => setDialogOpen(true)}>
          <Plus className="h-3 w-3 mr-1" />Add New
        </Button>
      </div>

      <ArtworkFilterSidebar
        open={filterOpen}
        onOpenChange={setFilterOpen}
        selectedCategories={selectedCategories}
        onCategoriesChange={v => { setSelectedCategories(v); setPage(1); }}
        selectedStatuses={selectedStatuses}
        onStatusesChange={v => { setSelectedStatuses(v); setPage(1); }}
        selectedLocations={selectedLocations}
        onLocationsChange={v => { setSelectedLocations(v); setPage(1); }}
        locations={locations}
        showStatusFilter={!!selectedArtist}
        showLocationFilter={!!selectedArtist}
      />

      {/* ─── Artists Grid (no artist selected) ─── */}
      {!selectedArtist && (
        <ScrollArea className="flex-1">
          {artistsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-[2px] p-[2px]">
              {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-sm" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-[2px] p-[2px]">
              {filteredArtists.map(artist => (
                <div key={artist.artistName} className="group relative text-left">
                  <button
                    onClick={() => { setSelectedArtist(artist.artistName); setSearchInput(""); setPage(1); setSelectedStatuses(["available", "on_consignment"]); setSelectedLocations([]); }}
                    className="w-full text-left focus:outline-none"
                  >
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                      {artist.imageUrl ? (
                        <img src={artist.imageUrl} alt={artist.artistName} className="object-contain w-full h-full" loading="lazy" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground/25"><ImageIcon className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="px-2 py-2 bg-background">
                      <p className="text-[11px] font-bold uppercase tracking-wider leading-tight truncate">{artist.artistName}</p>
                      <p className="text-[10px] text-muted-foreground">{artist.count} {artist.count === 1 ? "work" : "works"}</p>
                    </div>
                  </button>
                  <Button
                    variant="ghost" size="icon"
                    className="absolute top-1.5 right-1.5 h-7 w-7 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                    title={artistGroup === "active" ? "Move to For Review" : "Move to Active"}
                    onClick={(e) => { e.stopPropagation(); groupMutation.mutate({ artistName: artist.artistName, group: artistGroup === "active" ? "for_review" : "active" }); }}
                  >
                    {artistGroup === "active" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      )}

      {/* ─── Artworks Grid (artist selected) ─── */}
      {selectedArtist && (
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <ScrollArea className={`${selected ? "w-[58%]" : "w-full"} transition-all duration-200`}>
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1 p-3">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-sm" />)}
            </div>
          ) : artworksList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-30" /><p className="text-sm">No artworks found</p>
            </div>
          ) : (
            <>
              <div className={`grid ${selected ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"} gap-[2px] p-[2px]`}>
                {artworksList.map(artwork => (
                  <button key={artwork.id} onClick={() => setSelectedId(artwork.id === selectedId ? null : artwork.id)}
                    className={`group relative text-left focus:outline-none transition-all ${artwork.id === selectedId ? "ring-2 ring-primary ring-inset" : ""}`}>
                    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
                      {artwork.imageUrl ? (
                        <img src={artwork.imageUrl} alt={artwork.title} className="object-contain w-full h-full" loading="lazy" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground/25"><ImageIcon className="h-6 w-6" /></div>
                      )}
                      <div className={`absolute bottom-2 left-2 h-2.5 w-2.5 rounded-full ${statusDot[artwork.status]} ring-2 ring-white dark:ring-black/50`} />
                      {(artwork.importance ?? 0) >= 4 && <div className="absolute top-1.5 right-1.5"><Star className="h-3 w-3 fill-amber-400 text-amber-400 drop-shadow" /></div>}
                    </div>
                    <div className="px-2 py-1.5 bg-background">
                      <p className="text-[10px] font-bold uppercase tracking-wider leading-tight truncate">{artwork.artistName}</p>
                      <p className="text-[10px] text-muted-foreground truncate italic leading-tight">{artwork.title}{artwork.year ? `, ${artwork.year}` : ""}</p>
                      {artwork.retailPrice && <p className="text-[10px] font-semibold tabular-nums mt-0.5">{formatCurrency(artwork.retailPrice, artwork.retailCurrency || "USD")}</p>}
                    </div>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3">
                  <p className="text-xs text-muted-foreground">{((page - 1) * pageSize) + 1}\u2013{Math.min(page * pageSize, total)} of {total.toLocaleString()}</p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-xs px-2">{page} / {totalPages}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </>
          )}
        </ScrollArea>

        {selected && (
          <div className="w-[42%] border-l bg-card flex flex-col shrink-0">
            <DetailPanel artwork={selected} onClose={() => setSelectedId(null)} onEdit={() => setEditArtwork(selected)} onDelete={() => deleteMutation.mutate(selected.id)} />
          </div>
        )}
      </div>

      )}

      <Dialog open={dialogOpen || !!editArtwork} onOpenChange={(open) => { if (!open) { setDialogOpen(false); setEditArtwork(null); } }}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle>{editArtwork ? "Edit Artwork" : "New Artwork"}</DialogTitle>
          </DialogHeader>
          <ArtworkForm
            key={editArtwork ? editArtwork.id : "new"}
            initial={editArtwork || undefined}
            onSuccess={() => { setDialogOpen(false); setEditArtwork(null); }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
