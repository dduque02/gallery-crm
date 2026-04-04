import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Deal, InsertDeal, Contact, Artwork } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, DollarSign, ArrowRight, Pencil, Trash2, CalendarPlus,
} from "lucide-react";

const stages = [
  { key: "new_inquiry", label: "New Inquiry", color: "border-t-sky-500" },
  { key: "qualified", label: "Qualified", color: "border-t-blue-500" },
  { key: "artwork_presented", label: "Artwork Presented", color: "border-t-indigo-500" },
  { key: "collector_engaged", label: "Collector Engaged", color: "border-t-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "border-t-purple-500" },
  { key: "closed_won", label: "Won", color: "border-t-emerald-500" },
  { key: "closed_lost", label: "Lost", color: "border-t-red-500" },
];

const sourceChannels = ["Artsy", "Website", "WhatsApp", "Instagram", "Email", "Referral"];

const lostReasons = [
  "Price too high",
  "Lost interest",
  "Bought elsewhere",
  "Budget constraints",
  "No response",
  "Other",
];

const advisors = [
  "Miguel Duque", "Santiago Duque", "Federico Duque", "Sebastián Duque",
  "David Duque", "Germán Duque", "Sergio Arango", "Nora Acosta",
];

const priorityColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const sourceColors: Record<string, string> = {
  Artsy: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Website: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WhatsApp: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  Email: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  Referral: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

function formatCurrency(val: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

// Follow-up scheduling dialog
function ScheduleFollowupDialog({ deal, open, onOpenChange }: { deal: Deal; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    type: "call",
    description: "",
    dueDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
    dueTime: "10:00",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/followups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Follow-up scheduled" });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Schedule Follow-up</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">Deal: <strong>{deal.title}</strong></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g., Follow up on pricing" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <Button className="w-full" disabled={mutation.isPending || !form.description} onClick={() => mutation.mutate({
            dealId: deal.id,
            contactId: deal.contactId,
            type: form.type,
            description: form.description,
            dueDate: form.dueDate,
            dueTime: form.dueTime,
            notes: form.notes,
            status: "pending",
            createdAt: new Date().toISOString(),
            contactName: deal.contactName,
            dealTitle: deal.title,
            advisorName: deal.advisorName,
          })}>
            {mutation.isPending ? "Scheduling..." : "Schedule Follow-up"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Lost reason dialog
function LostReasonDialog({ open, onConfirm, onCancel }: { open: boolean; onConfirm: (reason: string) => void; onCancel: () => void }) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Why was this deal lost?</DialogTitle></DialogHeader>
        <Select value={reason} onValueChange={setReason}>
          <SelectTrigger><SelectValue placeholder="Select a reason" /></SelectTrigger>
          <SelectContent>
            {lostReasons.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={!reason} onClick={() => { onConfirm(reason); setReason(""); }}>Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DealForm({ onSuccess, contacts, artworks, initial }: { onSuccess: () => void; contacts: Contact[]; artworks: Artwork[]; initial?: Deal }) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Partial<InsertDeal>>({
    title: initial?.title || "", stage: initial?.stage || "new_inquiry",
    priority: initial?.priority || "medium", value: initial?.value || 0,
    notes: initial?.notes || "", contactId: initial?.contactId || undefined,
    artworkId: initial?.artworkId || undefined,
    contactName: initial?.contactName || "", artworkTitle: initial?.artworkTitle || "",
    currency: initial?.currency || "USD",
    sourceChannel: initial?.sourceChannel || undefined,
    advisorName: initial?.advisorName || undefined,
  });

  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", email: "", phone: "", type: "collector", city: "", country: "" });

  const createContactMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contacts", data).then(r => r.json()),
    onSuccess: (contact: Contact) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setForm({ ...form, contactId: contact.id, contactName: contact.name });
      setShowNewContact(false);
      setNewContact({ name: "", email: "", phone: "", type: "collector", city: "", country: "" });
      toast({ title: `Contact "${contact.name}" created` });
    },
  });

  const mutation = useMutation({
    mutationFn: (data: InsertDeal) =>
      isEdit
        ? apiRequest("PATCH", `/api/deals/${initial!.id}`, data)
        : apiRequest("POST", "/api/deals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: isEdit ? "Deal updated" : "Deal created" });
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Title</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-deal-title" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <Label className="text-xs">Contact</Label>
            <Button type="button" variant="ghost" size="sm" className="h-5 text-[11px] px-1.5 text-primary" onClick={() => setShowNewContact(!showNewContact)}>
              {showNewContact ? "Cancel" : "+ New"}
            </Button>
          </div>
          {showNewContact ? (
            <div className="space-y-2 border rounded-md p-2.5 bg-muted/30">
              <Input placeholder="Name *" value={newContact.name} onChange={e => setNewContact({ ...newContact, name: e.target.value })} className="h-8 text-xs" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Email" value={newContact.email} onChange={e => setNewContact({ ...newContact, email: e.target.value })} className="h-8 text-xs" />
                <Input placeholder="Phone" value={newContact.phone} onChange={e => setNewContact({ ...newContact, phone: e.target.value })} className="h-8 text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="City" value={newContact.city} onChange={e => setNewContact({ ...newContact, city: e.target.value })} className="h-8 text-xs" />
                <Input placeholder="Country" value={newContact.country} onChange={e => setNewContact({ ...newContact, country: e.target.value })} className="h-8 text-xs" />
              </div>
              <Select value={newContact.type} onValueChange={v => setNewContact({ ...newContact, type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="collector">Collector</SelectItem>
                  <SelectItem value="artist">Artist</SelectItem>
                  <SelectItem value="gallery">Gallery</SelectItem>
                  <SelectItem value="institution">Institution</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full h-7 text-xs" disabled={!newContact.name || createContactMutation.isPending} onClick={() => createContactMutation.mutate(newContact)}>
                {createContactMutation.isPending ? "Creating..." : "Create & Select Contact"}
              </Button>
            </div>
          ) : form.contactId && form.contactName && !contacts.find(c => c.id === form.contactId) ? (
            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30">
              <span className="text-sm flex-1 truncate">{form.contactName}</span>
              <Button type="button" variant="ghost" size="sm" className="h-5 text-[10px] px-1.5 shrink-0" onClick={() => setForm({ ...form, contactId: undefined, contactName: "" })}>Change</Button>
            </div>
          ) : (
            <Select value={form.contactId ? String(form.contactId) : ""} onValueChange={v => {
              const c = contacts.find(c => c.id === Number(v));
              setForm({ ...form, contactId: Number(v), contactName: c?.name || "" });
            }}>
              <SelectTrigger><SelectValue placeholder="Select contact" /></SelectTrigger>
              <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs">Artwork</Label>
          <Select value={form.artworkId ? String(form.artworkId) : ""} onValueChange={v => {
            const a = artworks.find(a => a.id === Number(v));
            setForm({ ...form, artworkId: Number(v), artworkTitle: a?.title || "", value: a?.retailPrice || form.value });
          }}>
            <SelectTrigger><SelectValue placeholder="Select artwork" /></SelectTrigger>
            <SelectContent>{artworks.filter(a => a.status !== "sold").map(a => <SelectItem key={a.id} value={String(a.id)}>{a.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div><Label className="text-xs">Value</Label><Input type="number" value={form.value || ""} onChange={e => setForm({ ...form, value: Number(e.target.value) })} /></div>
        <div>
          <Label className="text-xs">Currency</Label>
          <Select value={form.currency || "USD"} onValueChange={v => setForm({ ...form, currency: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="COP">COP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Stage</Label>
          <Select value={form.stage || "new_inquiry"} onValueChange={v => setForm({ ...form, stage: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{stages.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Priority</Label>
          <Select value={form.priority || "medium"} onValueChange={v => setForm({ ...form, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Source Channel</Label>
          <Select value={form.sourceChannel || ""} onValueChange={v => setForm({ ...form, sourceChannel: v })}>
            <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>{sourceChannels.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Advisor</Label>
          <Select value={form.advisorName || ""} onValueChange={v => setForm({ ...form, advisorName: v })}>
            <SelectTrigger><SelectValue placeholder="Select advisor" /></SelectTrigger>
            <SelectContent>{advisors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Notes</Label><Textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <Button className="w-full" onClick={() => mutation.mutate({ ...form, createdDate: isEdit ? initial!.createdDate : new Date().toISOString().split("T")[0] } as InsertDeal)} disabled={mutation.isPending || !form.title} data-testid="button-save-deal">
        {mutation.isPending ? (isEdit ? "Saving..." : "Creating...") : isEdit ? "Save Changes" : "Create Deal"}
      </Button>
    </div>
  );
}

function DealCard({ deal, onMove, onEdit, onDelete, onScheduleFollowup }: { deal: Deal; onMove: (id: number, stage: string) => void; onEdit: () => void; onDelete: () => void; onScheduleFollowup: () => void }) {
  const stageIdx = stages.findIndex(s => s.key === deal.stage);
  const nextStage = stageIdx < stages.length - 2 ? stages[stageIdx + 1] : null;

  return (
    <Card className="hover-elevate cursor-pointer group" data-testid={`card-deal-${deal.id}`}>
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{deal.title}</p>
          <div className="flex items-center gap-1 shrink-0">
            <div className={`h-2 w-2 rounded-full ${priorityColors[deal.priority || "medium"]}`} />
          </div>
        </div>
        {deal.contactName && <p className="text-xs text-muted-foreground">{deal.contactName}</p>}
        {deal.value ? (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(deal.value, deal.currency || "USD")}</span>
            {deal.currency && deal.currency !== "USD" && <span className="text-[10px] text-muted-foreground">{deal.currency}</span>}
          </div>
        ) : null}
        {deal.artworkTitle && <p className="text-[11px] text-muted-foreground italic">"{deal.artworkTitle}"</p>}
        <div className="flex items-center gap-1.5 flex-wrap">
          {deal.sourceChannel && (
            <Badge variant="secondary" className={`text-[10px] ${sourceColors[deal.sourceChannel] || ""}`}>
              {deal.sourceChannel}
            </Badge>
          )}
          {deal.advisorName && (
            <span className="text-[10px] text-muted-foreground">{deal.advisorName}</span>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {nextStage && !deal.stage.startsWith("closed") && (
            <Button
              variant="ghost" size="sm"
              className="h-7 text-xs flex-1"
              onClick={(e) => { e.stopPropagation(); onMove(deal.id, nextStage.key); }}
              data-testid={`button-move-deal-${deal.id}`}
            >
              <ArrowRight className="h-3 w-3 mr-1" />{nextStage.label}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onScheduleFollowup(); }} title="Schedule follow-up">
            <CalendarPlus className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3 w-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete deal?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{deal.title}".</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

function getDateRange(period: string): string | null {
  const now = new Date();
  switch (period) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay()); // start of week (Sunday)
      return d.toISOString().split("T")[0];
    }
    case "month": {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    case "quarter": {
      const qMonth = Math.floor(now.getMonth() / 3) * 3;
      return `${now.getFullYear()}-${String(qMonth + 1).padStart(2, "0")}-01`;
    }
    case "year": {
      return `${now.getFullYear()}-01-01`;
    }
    default: return null;
  }
}

export default function Pipeline() {
  const { data: deals, isLoading } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const { data: contactsResult } = useQuery<{ data: Contact[] }>({ queryKey: ["/api/contacts"] });
  const { data: artworksResult } = useQuery<{ data: Artwork[] }>({ queryKey: ["/api/artworks"] });
  const contacts = contactsResult?.data || [];
  const artworks = artworksResult?.data || [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDeal, setEditDeal] = useState<Deal | null>(null);
  const [followupDeal, setFollowupDeal] = useState<Deal | null>(null);
  const [lostDialog, setLostDialog] = useState<{ dealId: number } | null>(null);
  const [period, setPeriod] = useState("all");
  const { toast } = useToast();

  const minDate = getDateRange(period);
  const filteredDeals = deals ? (minDate ? deals.filter(d => (d.createdDate || "") >= minDate) : deals) : [];

  const moveDeal = useMutation({
    mutationFn: ({ id, stage, lostReason }: { id: number; stage: string; lostReason?: string }) =>
      apiRequest("PATCH", `/api/deals/${id}`, { stage, ...(lostReason ? { lostReason } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Deal updated" });
    },
  });

  const deleteDeal = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/deals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Deal deleted" });
    },
  });

  const handleMove = (id: number, stage: string) => {
    if (stage === "closed_lost") {
      setLostDialog({ dealId: id });
    } else {
      moveDeal.mutate({ id, stage });
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap shrink-0">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredDeals ? `${filteredDeals.filter(d => !d.stage.startsWith("closed")).length} active deals` : "Loading..."}
            {filteredDeals && ` · ${formatCurrency(filteredDeals.filter(d => !d.stage.startsWith("closed")).reduce((s, d) => s + (d.value || 0), 0))} total value`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-deal"><Plus className="h-4 w-4 mr-1" />New Deal</Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Deal</DialogTitle></DialogHeader>
            <DealForm onSuccess={() => setDialogOpen(false)} contacts={contacts || []} artworks={artworks || []} />
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-3 flex-1">
          {stages.map(s => <Skeleton key={s.key} className="h-64 rounded-md" />)}
        </div>
      ) : (
        <div className="flex gap-3 flex-1 overflow-x-auto pb-4">
          {stages.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stage === stage.key);
            const stageValue = stageDeals.reduce((s, d) => s + (d.value || 0), 0);
            return (
              <div key={stage.key} className="flex flex-col min-w-[170px] flex-shrink-0" data-testid={`column-${stage.key}`}>
                <div className={`border-t-2 ${stage.color} bg-muted/30 rounded-t-md p-3 mb-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider">{stage.label}</p>
                    <Badge variant="secondary" className="text-[10px] h-5 tabular-nums">{stageDeals.length}</Badge>
                  </div>
                  {stageValue > 0 && <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">{formatCurrency(stageValue)}</p>}
                </div>
                <div className="space-y-2 flex-1">
                  {stageDeals.map(deal => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      onMove={handleMove}
                      onEdit={() => setEditDeal(deal)}
                      onDelete={() => deleteDeal.mutate(deal.id)}
                      onScheduleFollowup={() => setFollowupDeal(deal)}
                    />
                  ))}
                  {stageDeals.length === 0 && (
                    <div className="border border-dashed rounded-md p-4 text-center text-xs text-muted-foreground">
                      No deals
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Deal Dialog */}
      <Dialog open={!!editDeal} onOpenChange={(open) => { if (!open) setEditDeal(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Deal</DialogTitle></DialogHeader>
          {editDeal && <DealForm initial={editDeal} onSuccess={() => setEditDeal(null)} contacts={contacts || []} artworks={artworks || []} />}
        </DialogContent>
      </Dialog>

      {/* Lost Reason Dialog */}
      <LostReasonDialog
        open={!!lostDialog}
        onConfirm={(reason) => {
          if (lostDialog) {
            moveDeal.mutate({ id: lostDialog.dealId, stage: "closed_lost", lostReason: reason });
          }
          setLostDialog(null);
        }}
        onCancel={() => setLostDialog(null)}
      />

      {/* Schedule Follow-up Dialog */}
      {followupDeal && (
        <ScheduleFollowupDialog
          deal={followupDeal}
          open={!!followupDeal}
          onOpenChange={(open) => { if (!open) setFollowupDeal(null); }}
        />
      )}
    </div>
  );
}
