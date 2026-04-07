import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Activity, InsertActivity, Contact } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Phone, Mail, MessageSquare, FileText, ShoppingCart, Search,
} from "lucide-react";

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: MessageSquare,
  note: FileText,
  sale: ShoppingCart,
};

const typeColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  email: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  note: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  sale: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

function ActivityForm({ onSuccess, contacts }: { onSuccess: () => void; contacts: Contact[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Partial<InsertActivity>>({
    type: "note", description: "", contactId: undefined, date: new Date().toISOString().split("T")[0],
  });

  const mutation = useMutation({
    mutationFn: (data: InsertActivity) => apiRequest("POST", "/api/activities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({ title: "Activity logged" });
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Type</Label>
          <Select value={form.type || "note"} onValueChange={v => setForm({ ...form, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="call">Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="meeting">Meeting</SelectItem>
              <SelectItem value="note">Note</SelectItem>
              <SelectItem value="sale">Sale</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Contact</Label>
          <Select value={form.contactId ? String(form.contactId) : ""} onValueChange={v => {
            const c = contacts.find(c => c.id === Number(v));
            setForm({ ...form, contactId: Number(v), contactName: c?.name || "" });
          }}>
            <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
            <SelectContent>{contacts.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Date</Label><Input type="date" value={form.date || ""} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
      <div><Label className="text-xs">Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} data-testid="input-activity-description" /></div>
      <Button className="w-full" onClick={() => mutation.mutate(form as InsertActivity)} disabled={mutation.isPending || !form.description} data-testid="button-save-activity">
        {mutation.isPending ? "Saving..." : "Log Activity"}
      </Button>
    </div>
  );
}

export default function Activities() {
  const { data: activities, isLoading } = useQuery<Activity[]>({ queryKey: ["/api/activities"] });
  const { data: contactsData } = useQuery<{ data: Contact[] } | Contact[]>({ queryKey: ["/api/contacts"] });
  const contacts = Array.isArray(contactsData) ? contactsData : contactsData?.data || [];
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filtered = (activities || []).filter(a => {
    const matchSearch = !search || a.description.toLowerCase().includes(search.toLowerCase()) || (a.contactName && a.contactName.toLowerCase().includes(search.toLowerCase()));
    const matchType = typeFilter === "all" || a.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1000px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Activity Log</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} entries</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-activity"><Plus className="h-4 w-4 mr-1" />Log Activity</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
            <ActivityForm onSuccess={() => setDialogOpen(false)} contacts={contacts} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search activities..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-search-activities" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="call">Call</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="note">Note</SelectItem>
            <SelectItem value="sale">Sale</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : (
        <div className="space-y-1">
          {filtered.map((activity, idx) => {
            const ActIcon = typeIcons[activity.type] || FileText;
            const showDate = idx === 0 || filtered[idx - 1].date !== activity.date;
            return (
              <div key={activity.id}>
                {showDate && (
                  <div className="flex items-center gap-2 pt-4 pb-2">
                    <span className="text-xs font-semibold text-muted-foreground">{activity.date}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className="flex gap-3 p-3 rounded-md hover-elevate" data-testid={`activity-item-${activity.id}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${typeColors[activity.type]}`}>
                    <ActIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge variant="secondary" className={`text-[10px] capitalize ${typeColors[activity.type]}`}>{activity.type}</Badge>
                      {activity.contactName && (
                        <span className="text-xs text-muted-foreground">{activity.contactName}</span>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed">{activity.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">No activities found</div>
          )}
        </div>
      )}
    </div>
  );
}
