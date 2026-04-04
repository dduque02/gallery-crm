import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contact, InsertContact } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Plus, Search, Mail, Phone, MapPin, Building, DollarSign, Calendar, Pencil, Trash2,
  ChevronLeft, ChevronRight, Heart, Star,
} from "lucide-react";

const typeColors: Record<string, string> = {
  collector: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  artist: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  gallery: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  institution: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  other: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
};

const levelColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  developing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  VIP: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

interface PaginatedContacts {
  data: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

function ContactForm({ onSuccess, initial }: { onSuccess: () => void; initial?: Contact }) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Partial<InsertContact>>({
    name: initial?.name || "", email: initial?.email || "", phone: initial?.phone || "",
    type: initial?.type || "collector", company: initial?.company || "", notes: initial?.notes || "",
    city: initial?.city || "", country: initial?.country || "",
    preferredChannel: initial?.preferredChannel || undefined,
    budgetLow: initial?.budgetLow || undefined,
    budgetHigh: initial?.budgetHigh || undefined,
    preferredMedium: initial?.preferredMedium || undefined,
    preferredScale: initial?.preferredScale || undefined,
    artistsOfInterest: initial?.artistsOfInterest || [],
    relationshipLevel: initial?.relationshipLevel || "new",
    leadSource: initial?.leadSource || undefined,
    firstContactDate: initial?.firstContactDate || undefined,
  });

  const [artistInput, setArtistInput] = useState("");

  const mutation = useMutation({
    mutationFn: (data: InsertContact) =>
      isEdit
        ? apiRequest("PATCH", `/api/contacts/${initial!.id}`, data)
        : apiRequest("POST", "/api/contacts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: isEdit ? "Contact updated" : "Contact added" });
      onSuccess();
    },
  });

  const addArtist = () => {
    if (artistInput.trim()) {
      setForm({ ...form, artistsOfInterest: [...(form.artistsOfInterest || []), artistInput.trim()] });
      setArtistInput("");
    }
  };

  const removeArtist = (idx: number) => {
    setForm({ ...form, artistsOfInterest: (form.artistsOfInterest || []).filter((_, i) => i !== idx) });
  };

  return (
    <Tabs defaultValue="basic" className="w-full">
      <TabsList className="w-full">
        <TabsTrigger value="basic" className="flex-1">Basic</TabsTrigger>
        <TabsTrigger value="intelligence" className="flex-1">Intelligence</TabsTrigger>
      </TabsList>
      <TabsContent value="basic" className="space-y-3 mt-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={form.type || "collector"} onValueChange={v => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collector">Collector</SelectItem>
                <SelectItem value="artist">Artist</SelectItem>
                <SelectItem value="gallery">Gallery</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Email</Label><Input type="email" value={form.email || ""} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label className="text-xs">Phone</Label><Input value={form.phone || ""} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label className="text-xs">Company</Label><Input value={form.company || ""} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
          <div><Label className="text-xs">City</Label><Input value={form.city || ""} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
          <div><Label className="text-xs">Country</Label><Input value={form.country || ""} onChange={e => setForm({ ...form, country: e.target.value })} /></div>
        </div>
        <div><Label className="text-xs">Notes</Label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      </TabsContent>
      <TabsContent value="intelligence" className="space-y-3 mt-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preferred Channel</Label>
            <Select value={form.preferredChannel || ""} onValueChange={v => setForm({ ...form, preferredChannel: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Relationship Level</Label>
            <Select value={form.relationshipLevel || "new"} onValueChange={v => setForm({ ...form, relationshipLevel: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="developing">Developing</SelectItem>
                <SelectItem value="strong">Strong</SelectItem>
                <SelectItem value="VIP">VIP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Budget Low (USD)</Label><Input type="number" value={form.budgetLow || ""} onChange={e => setForm({ ...form, budgetLow: Number(e.target.value) || undefined })} /></div>
          <div><Label className="text-xs">Budget High (USD)</Label><Input type="number" value={form.budgetHigh || ""} onChange={e => setForm({ ...form, budgetHigh: Number(e.target.value) || undefined })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Preferred Medium</Label>
            <Select value={form.preferredMedium || ""} onValueChange={v => setForm({ ...form, preferredMedium: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="painting">Painting</SelectItem>
                <SelectItem value="sculpture">Sculpture</SelectItem>
                <SelectItem value="photography">Photography</SelectItem>
                <SelectItem value="prints">Prints</SelectItem>
                <SelectItem value="mixed_media">Mixed Media</SelectItem>
                <SelectItem value="drawing">Drawing</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Preferred Scale</Label>
            <Select value={form.preferredScale || ""} onValueChange={v => setForm({ ...form, preferredScale: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="monumental">Monumental</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Artists of Interest</Label>
          <div className="flex gap-2">
            <Input value={artistInput} onChange={e => setArtistInput(e.target.value)} placeholder="Artist name" onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addArtist(); } }} />
            <Button type="button" variant="outline" size="sm" onClick={addArtist}>Add</Button>
          </div>
          {(form.artistsOfInterest || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(form.artistsOfInterest || []).map((a, i) => (
                <Badge key={i} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeArtist(i)}>{a} x</Badge>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Lead Source</Label>
            <Select value={form.leadSource || ""} onValueChange={v => setForm({ ...form, leadSource: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="artsy">Artsy</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="fair">Art Fair</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">First Contact Date</Label>
            <Input type="date" value={form.firstContactDate || ""} onChange={e => setForm({ ...form, firstContactDate: e.target.value })} />
          </div>
        </div>
      </TabsContent>
      <Button className="w-full mt-4" onClick={() => mutation.mutate(form as InsertContact)} disabled={mutation.isPending || !form.name}>
        {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Add Contact"}
      </Button>
    </Tabs>
  );
}

export default function Contacts() {
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const { toast } = useToast();

  const queryKey = ["/api/contacts", `?page=${page}&pageSize=${pageSize}&search=${search}&type=${typeFilter}`];
  const { data: result, isLoading } = useQuery<PaginatedContacts>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/contacts?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(search)}&type=${typeFilter}`);
      return res.json();
    },
  });

  // Client-side filter for relationship level (until backend supports it)
  const allContacts = result?.data || [];
  const contacts = levelFilter === "all" ? allContacts : allContacts.filter(c => c.relationshipLevel === levelFilter);
  const total = result?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contacts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setSelectedContact(null);
      toast({ title: "Contact deleted" });
    },
  });

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { setSearch(searchInput); setPage(1); }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total.toLocaleString()} contacts</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Contact</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Contact</DialogTitle></DialogHeader>
            <ContactForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts... (Enter)"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onBlur={() => { if (searchInput !== search) { setSearch(searchInput); setPage(1); } }}
            className="pl-9 h-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="collector">Collector</SelectItem>
            <SelectItem value="artist">Artist</SelectItem>
            <SelectItem value="gallery">Gallery</SelectItem>
            <SelectItem value="institution">Institution</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={v => setLevelFilter(v)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Level" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="developing">Developing</SelectItem>
            <SelectItem value="strong">Strong</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-md" />)}</div>
      ) : (
        <>
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Contact</th>
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Level</th>
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Company</th>
                  <th className="text-left p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Location</th>
                  <th className="text-right p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground hidden md:table-cell">Purchases</th>
                  <th className="text-right p-3 font-medium text-xs uppercase tracking-wider text-muted-foreground">Total Spent</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map(contact => (
                  <tr key={contact.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedContact(contact)}>
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8 text-[11px]">
                          <AvatarFallback className="bg-primary/10 text-primary font-medium">{getInitials(contact.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{contact.name}</p>
                          {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary" className={`text-[10px] capitalize ${typeColors[contact.type]}`}>{contact.type}</Badge>
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <Badge variant="secondary" className={`text-[10px] capitalize ${levelColors[contact.relationshipLevel || "new"]}`}>
                        {contact.relationshipLevel || "new"}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground hidden md:table-cell">{contact.company || "\u2014"}</td>
                    <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {contact.city && contact.country ? `${contact.city}, ${contact.country}` : contact.city || contact.country || "\u2014"}
                    </td>
                    <td className="p-3 text-right tabular-nums hidden md:table-cell">{contact.totalPurchases || 0}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">
                      {(contact.totalSpent || 0) > 0 ? formatCurrency(contact.totalSpent || 0) : "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {((page - 1) * pageSize) + 1}\u2013{Math.min(page * pageSize, total)} of {total.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs px-2">{page} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Contact Detail Sheet */}
      <Sheet open={!!selectedContact} onOpenChange={() => setSelectedContact(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedContact && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold text-lg">{getInitials(selectedContact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <SheetTitle>{selectedContact.name}</SheetTitle>
                    <div className="flex gap-1.5 mt-1">
                      <Badge variant="secondary" className={`text-[10px] capitalize ${typeColors[selectedContact.type]}`}>{selectedContact.type}</Badge>
                      <Badge variant="secondary" className={`text-[10px] capitalize ${levelColors[selectedContact.relationshipLevel || "new"]}`}>
                        {selectedContact.relationshipLevel || "new"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditContact(selectedContact); setSelectedContact(null); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete {selectedContact.name}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(selectedContact.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {selectedContact.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{selectedContact.email}</div>}
                {selectedContact.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{selectedContact.phone}</div>}
                {selectedContact.company && <div className="flex items-center gap-2 text-sm"><Building className="h-4 w-4 text-muted-foreground" />{selectedContact.company}</div>}
                {(selectedContact.city || selectedContact.country) && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{[selectedContact.city, selectedContact.country].filter(Boolean).join(", ")}</div>}
                {selectedContact.lastContactDate && <div className="flex items-center gap-2 text-sm"><Calendar className="h-4 w-4 text-muted-foreground" />Last contact: {selectedContact.lastContactDate}</div>}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-3">
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold tabular-nums">{selectedContact.totalPurchases || 0}</p><p className="text-xs text-muted-foreground">Purchases</p></CardContent></Card>
                    <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold tabular-nums">{(selectedContact.totalSpent || 0) > 0 ? formatCurrency(selectedContact.totalSpent || 0) : "$0"}</p><p className="text-xs text-muted-foreground">Total Spent</p></CardContent></Card>
                  </div>
                </div>

                {/* Collector Intelligence */}
                {(selectedContact.preferredChannel || selectedContact.budgetLow || selectedContact.preferredMedium || selectedContact.preferredScale || (selectedContact.artistsOfInterest && selectedContact.artistsOfInterest.length > 0) || selectedContact.leadSource) && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5" /> Collector Intelligence
                    </p>
                    <div className="space-y-2.5">
                      {selectedContact.preferredChannel && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Channel</span>
                          <Badge variant="outline" className="text-xs capitalize">{selectedContact.preferredChannel}</Badge>
                        </div>
                      )}
                      {(selectedContact.budgetLow || selectedContact.budgetHigh) && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Budget</span>
                          <span>{selectedContact.budgetLow ? formatCurrency(selectedContact.budgetLow) : "?"} - {selectedContact.budgetHigh ? formatCurrency(selectedContact.budgetHigh) : "?"}</span>
                        </div>
                      )}
                      {selectedContact.preferredMedium && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Medium</span>
                          <Badge variant="outline" className="text-xs capitalize">{selectedContact.preferredMedium.replace("_", " ")}</Badge>
                        </div>
                      )}
                      {selectedContact.preferredScale && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Scale</span>
                          <Badge variant="outline" className="text-xs capitalize">{selectedContact.preferredScale}</Badge>
                        </div>
                      )}
                      {selectedContact.leadSource && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Source</span>
                          <Badge variant="outline" className="text-xs capitalize">{selectedContact.leadSource.replace("_", " ")}</Badge>
                        </div>
                      )}
                      {selectedContact.artistsOfInterest && selectedContact.artistsOfInterest.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1.5">Artists of Interest</p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedContact.artistsOfInterest.map((a, i) => (
                              <Badge key={i} variant="secondary" className="text-xs"><Heart className="h-3 w-3 mr-1" />{a}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedContact.tags && selectedContact.tags.length > 0 && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tags</p>
                    <div className="flex flex-wrap gap-1.5">{selectedContact.tags.map(tag => <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>)}</div>
                  </div>
                )}
                {selectedContact.notes && (
                  <div className="border-t pt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Notes</p>
                    <p className="text-sm leading-relaxed whitespace-pre-line">{selectedContact.notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          {editContact && <ContactForm initial={editContact} onSuccess={() => setEditContact(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
