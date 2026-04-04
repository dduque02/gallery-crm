import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Exhibition, InsertExhibition } from "@shared/schema";
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
  Plus, MapPin, Calendar, DollarSign, Palette, Pencil, Trash2,
} from "lucide-react";

const statusColors: Record<string, string> = {
  planning: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  completed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

function formatCurrency(val: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function ExhibitionForm({ onSuccess, initial }: { onSuccess: () => void; initial?: Exhibition }) {
  const { toast } = useToast();
  const isEdit = !!initial;
  const [form, setForm] = useState<Partial<InsertExhibition>>({
    name: initial?.name || "", startDate: initial?.startDate || "",
    endDate: initial?.endDate || "", location: initial?.location || "",
    description: initial?.description || "", status: initial?.status || "planning",
    budget: initial?.budget || 0,
  });

  const mutation = useMutation({
    mutationFn: (data: InsertExhibition) =>
      isEdit
        ? apiRequest("PATCH", `/api/exhibitions/${initial!.id}`, data)
        : apiRequest("POST", "/api/exhibitions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibitions"] });
      toast({ title: isEdit ? "Exhibition updated" : "Exhibition created" });
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-exhibition-name" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Start Date</Label><Input type="date" value={form.startDate || ""} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
        <div><Label className="text-xs">End Date</Label><Input type="date" value={form.endDate || ""} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Location</Label><Input value={form.location || ""} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={form.status || "planning"} onValueChange={v => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Budget (USD)</Label><Input type="number" value={form.budget || ""} onChange={e => setForm({ ...form, budget: Number(e.target.value) })} /></div>
      <div><Label className="text-xs">Description</Label><Textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
      <Button className="w-full" onClick={() => mutation.mutate(form as InsertExhibition)} disabled={mutation.isPending || !form.name} data-testid="button-save-exhibition">
        {mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Exhibition"}
      </Button>
    </div>
  );
}

export default function Exhibitions() {
  const { data: exhibitions, isLoading } = useQuery<Exhibition[]>({ queryKey: ["/api/exhibitions"] });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editExhibition, setEditExhibition] = useState<Exhibition | null>(null);
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/exhibitions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/exhibitions"] });
      toast({ title: "Exhibition deleted" });
    },
  });

  const sorted = [...(exhibitions || [])].sort((a, b) => {
    const order = { active: 0, planning: 1, completed: 2, cancelled: 3 };
    return (order[a.status as keyof typeof order] ?? 4) - (order[b.status as keyof typeof order] ?? 4);
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" data-testid="text-page-title">Exhibitions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{sorted.length} exhibitions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-exhibition"><Plus className="h-4 w-4 mr-1" />New Exhibition</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Exhibition</DialogTitle></DialogHeader>
            <ExhibitionForm onSuccess={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-md" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(exhibition => (
            <Card key={exhibition.id} className="hover-elevate group" data-testid={`card-exhibition-${exhibition.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base font-semibold leading-tight">{exhibition.name}</CardTitle>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary" className={`text-[10px] capitalize ${statusColors[exhibition.status]}`}>
                      {exhibition.status}
                    </Badge>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditExhibition(exhibition)}>
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
                            <AlertDialogTitle>Delete exhibition?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete "{exhibition.name}".</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(exhibition.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {exhibition.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{exhibition.description}</p>
                )}
                <div className="space-y-1.5 pt-1">
                  {exhibition.location && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />{exhibition.location}
                    </div>
                  )}
                  {(exhibition.startDate || exhibition.endDate) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      {exhibition.startDate} {exhibition.endDate ? `\u2014 ${exhibition.endDate}` : ""}
                    </div>
                  )}
                  {exhibition.budget && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />Budget: {formatCurrency(exhibition.budget)}
                    </div>
                  )}
                  {exhibition.artworkIds && exhibition.artworkIds.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Palette className="h-3.5 w-3.5" />{exhibition.artworkIds.length} works assigned
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Exhibition Dialog */}
      <Dialog open={!!editExhibition} onOpenChange={(open) => { if (!open) setEditExhibition(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Exhibition</DialogTitle></DialogHeader>
          {editExhibition && <ExhibitionForm initial={editExhibition} onSuccess={() => setEditExhibition(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
