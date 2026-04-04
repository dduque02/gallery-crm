import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Followup, InsertFollowup } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Check, Pencil, Trash2, Phone, Mail, MessageSquare, Calendar, Clock, AlertTriangle,
} from "lucide-react";

const advisors = [
  "Miguel Duque", "Santiago Duque", "Federico Duque", "Sebastián Duque",
  "David Duque", "Germán Duque", "Sergio Arango", "Nora Acosta",
];

const typeIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: MessageSquare,
  whatsapp: MessageSquare,
  other: Calendar,
};

const typeColors: Record<string, string> = {
  call: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  email: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  meeting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  whatsapp: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  other: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

function FollowupForm({ onSuccess, initial }: { onSuccess: () => void; initial?: Followup }) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState({
    type: initial?.type || "call",
    description: initial?.description || "",
    dueDate: initial?.dueDate || new Date(Date.now() + 86400000).toISOString().split("T")[0],
    dueTime: initial?.dueTime || "10:00",
    notes: initial?.notes || "",
    contactName: initial?.contactName || "",
    dealTitle: initial?.dealTitle || "",
    advisorName: initial?.advisorName || "",
  });

  const mutation = useMutation({
    mutationFn: (data: any) =>
      isEdit
        ? apiRequest("PATCH", `/api/followups/${initial!.id}`, data)
        : apiRequest("POST", "/api/followups", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: isEdit ? "Follow-up updated" : "Follow-up created" });
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
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
      <div><Label className="text-xs">Description</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="e.g., Follow up on pricing" /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label className="text-xs">Contact Name</Label><Input value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} /></div>
        <div><Label className="text-xs">Deal Title</Label><Input value={form.dealTitle} onChange={e => setForm({ ...form, dealTitle: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Advisor</Label>
          <Select value={form.advisorName || ""} onValueChange={v => setForm({ ...form, advisorName: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{advisors.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Notes</Label><Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
      <Button className="w-full" disabled={mutation.isPending || !form.description} onClick={() => mutation.mutate({
        ...form,
        status: isEdit ? initial!.status : "pending",
        createdAt: isEdit ? initial!.createdAt : new Date().toISOString(),
      })}>
        {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Follow-up"}
      </Button>
    </div>
  );
}

function FollowupCard({ followup }: { followup: Followup }) {
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const Icon = typeIcons[followup.type] || Calendar;

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/followups/${followup.id}`, { status: "completed", completedAt: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Follow-up completed" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/followups/${followup.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/followups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Follow-up deleted" });
    },
  });

  const isOverdue = followup.status === "pending" && followup.dueDate < new Date().toISOString().split("T")[0];

  return (
    <Card className={`${isOverdue ? "border-red-200 dark:border-red-900/50" : ""}`}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${typeColors[followup.type] || typeColors.other}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{followup.description}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {followup.contactName && <span>{followup.contactName}</span>}
              {followup.dealTitle && <span>· {followup.dealTitle}</span>}
              {followup.advisorName && <span>· {followup.advisorName}</span>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-600 dark:text-red-400 font-medium" : "text-muted-foreground"}`}>
                <Clock className="h-3 w-3" />{followup.dueDate}{followup.dueTime ? ` ${followup.dueTime}` : ""}
              </span>
              <Badge variant="secondary" className={`text-[10px] capitalize ${typeColors[followup.type] || ""}`}>{followup.type}</Badge>
            </div>
            {followup.notes && <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{followup.notes}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {followup.status === "pending" && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:text-emerald-700" onClick={() => completeMutation.mutate()} title="Complete">
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3 w-3" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete follow-up?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently delete this follow-up.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Follow-up</DialogTitle></DialogHeader>
          <FollowupForm initial={followup} onSuccess={() => setEditOpen(false)} />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function Followups() {
  const { data: followups, isLoading } = useQuery<Followup[]>({ queryKey: ["/api/followups"] });
  const [dialogOpen, setDialogOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];
  const pending = (followups || []).filter(f => f.status === "pending");
  const overdue = pending.filter(f => f.dueDate < today);
  const dueToday = pending.filter(f => f.dueDate === today);
  const upcoming = pending.filter(f => f.dueDate > today);
  const completed = (followups || []).filter(f => f.status === "completed").slice(0, 10);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1000px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Follow-ups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pending.length} pending · {overdue.length} overdue
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Follow-up</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>New Follow-up</DialogTitle></DialogHeader>
            <FollowupForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-md" />)}</div>
      ) : (
        <>
          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-3">
                <AlertTriangle className="h-4 w-4" /> Overdue ({overdue.length})
              </h2>
              <div className="space-y-2">
                {overdue.map(f => <FollowupCard key={f.id} followup={f} />)}
              </div>
            </div>
          )}

          {/* Today */}
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
              <Calendar className="h-4 w-4" /> Today ({dueToday.length})
            </h2>
            {dueToday.length > 0 ? (
              <div className="space-y-2">
                {dueToday.map(f => <FollowupCard key={f.id} followup={f} />)}
              </div>
            ) : (
              <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No follow-ups due today</CardContent></Card>
            )}
          </div>

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <Clock className="h-4 w-4" /> Upcoming ({upcoming.length})
              </h2>
              <div className="space-y-2">
                {upcoming.map(f => <FollowupCard key={f.id} followup={f} />)}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5 mb-3">
                <Check className="h-4 w-4" /> Recently Completed
              </h2>
              <div className="space-y-2 opacity-60">
                {completed.map(f => <FollowupCard key={f.id} followup={f} />)}
              </div>
            </div>
          )}

          {pending.length === 0 && completed.length === 0 && (
            <Card><CardContent className="p-12 text-center text-sm text-muted-foreground">No follow-ups yet. Create one from here or from the Pipeline.</CardContent></Card>
          )}
        </>
      )}
    </div>
  );
}
