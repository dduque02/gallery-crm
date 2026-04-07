import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Deal, Contact, Artwork, Activity, Followup } from "@shared/schema";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  stages, priorityColors, sourceColors, stageBadgeColors,
  formatCurrency, relativeDate,
} from "@/lib/pipeline-constants";
import {
  DollarSign, ArrowRight, Pencil, Trash2, CalendarPlus,
  Clock, User, TrendingUp, CheckCircle2, Circle,
  Phone, Mail, MessageSquare, Globe,
} from "lucide-react";

interface DealDetailSheetProps {
  deal: Deal | null;
  contact: Contact | undefined;
  artwork: Artwork | undefined;
  onClose: () => void;
  onEdit: (deal: Deal) => void;
  onMove: (id: number, stage: string) => void;
  onDelete: (id: number) => void;
  onScheduleFollowup: (deal: Deal) => void;
}

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageSquare,
  meeting: User,
  website: Globe,
};

const relationshipColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  developing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  strong: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  VIP: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

export function DealDetailSheet({ deal, contact, artwork, onClose, onEdit, onMove, onDelete, onScheduleFollowup }: DealDetailSheetProps) {
  const [, navigate] = useLocation();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");
  const [activeImageIdx, setActiveImageIdx] = useState(0);

  const { data: dealActivities } = useQuery<Activity[]>({
    queryKey: [`/api/deals/${deal?.id}/activities`],
    enabled: !!deal,
  });

  const { data: dealFollowups } = useQuery<Followup[]>({
    queryKey: [`/api/deals/${deal?.id}/followups`],
    enabled: !!deal,
  });

  const updateNotes = useMutation({
    mutationFn: (notes: string) => apiRequest("PATCH", `/api/deals/${deal!.id}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deals"] });
      setEditingNotes(false);
    },
  });

  if (!deal) return null;

  const stageInfo = stages.find(s => s.key === deal.stage);
  const stageIdx = stages.findIndex(s => s.key === deal.stage);
  const nextStage = stageIdx < stages.length - 2 ? stages[stageIdx + 1] : null;

  const daysInPipeline = deal.createdDate
    ? Math.floor((Date.now() - new Date(deal.createdDate).getTime()) / 86400000)
    : null;

  const allImages = artwork ? [
    ...(artwork.imageUrl ? [artwork.imageUrl] : []),
    ...(artwork.secondaryImages || []),
  ] : [];

  // Merge activities + followups into timeline
  type TimelineEntry =
    | { kind: "activity"; data: Activity; date: string }
    | { kind: "followup"; data: Followup; date: string };

  const timeline: TimelineEntry[] = [
    ...(dealActivities || []).map(a => ({ kind: "activity" as const, data: a, date: a.date })),
    ...(dealFollowups || []).map(f => ({ kind: "followup" as const, data: f, date: f.createdAt })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const hasCollectorIntel = contact && (
    contact.relationshipLevel || contact.budgetLow || contact.budgetHigh ||
    contact.preferredMedium || contact.preferredScale ||
    (contact.artistsOfInterest && contact.artistsOfInterest.length > 0)
  );

  return (
    <Sheet open={!!deal} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col gap-0" side="right">
        {/* Header */}
        <div className="px-5 py-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <SheetTitle className="text-lg font-semibold leading-tight">{deal.title}</SheetTitle>
              <SheetDescription className="sr-only">Deal details for {deal.title}</SheetDescription>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={stageBadgeColors[deal.stage] || ""}>
                  {stageInfo?.label || deal.stage}
                </Badge>
                <div className={`h-2.5 w-2.5 rounded-full ${priorityColors[deal.priority || "medium"]}`} />
                <span className="text-xs text-muted-foreground capitalize">{deal.priority}</span>
              </div>
              {deal.contactName && (
                <button
                  className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                  onClick={() => {
                    onClose();
                    navigate(`/contacts?contactId=${deal.contactId}`);
                  }}
                >
                  <User className="h-3.5 w-3.5" />{deal.contactName}
                  <ArrowRight className="h-3 w-3 opacity-50" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <ScrollArea className="flex-1">
          <div className="space-y-0">

            {/* Artwork image */}
            {artwork && allImages.length > 0 && (
              <div>
                <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                  <img src={allImages[activeImageIdx] || allImages[0]} alt={artwork.title} className="object-contain w-full h-full" />
                </div>
                {allImages.length > 1 && (
                  <div className="flex gap-1 px-4 py-2 overflow-x-auto">
                    {allImages.map((url, i) => (
                      <button key={i} type="button" onClick={() => setActiveImageIdx(i)}
                        className={`h-9 w-9 shrink-0 rounded overflow-hidden border-2 transition-colors ${i === activeImageIdx ? "border-primary" : "border-transparent hover:border-muted-foreground/30"}`}>
                        <img src={url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="px-5 py-2 border-b">
                  <p className="text-xs font-bold uppercase tracking-wide">{artwork.artistName}</p>
                  <p className="text-sm"><span className="italic">{artwork.title}</span>{artwork.year && <span className="text-muted-foreground">, {artwork.year}</span>}</p>
                  {artwork.medium && <p className="text-xs text-muted-foreground">{artwork.medium}</p>}
                  {artwork.dimensions && <p className="text-xs text-muted-foreground">{artwork.dimensions}</p>}
                </div>
              </div>
            )}

            {/* Deal signals */}
            <div className="px-5 py-4 border-b">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Deal Signals</p>
              <div className="grid grid-cols-2 gap-3">
                {deal.value && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Value</p>
                    <p className="text-sm font-semibold flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" />
                      {formatCurrency(deal.value, deal.currency || "USD")}
                    </p>
                  </div>
                )}
                {deal.intentScore != null && deal.intentScore > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Intent Score</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <Badge variant="secondary" className={
                        deal.intentScore >= 67 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                        deal.intentScore >= 34 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }>{deal.intentScore}/100</Badge>
                    </div>
                  </div>
                )}
                {deal.firstResponseTime != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">First Response</p>
                    <p className="text-sm flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {deal.firstResponseTime >= 60 ? `${Math.floor(deal.firstResponseTime / 60)}h ${deal.firstResponseTime % 60}m` : `${deal.firstResponseTime} min`}
                    </p>
                  </div>
                )}
                {daysInPipeline != null && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Days in Pipeline</p>
                    <p className="text-sm">{daysInPipeline}d</p>
                  </div>
                )}
                {deal.sourceChannel && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Source</p>
                    <Badge variant="secondary" className={sourceColors[deal.sourceChannel] || ""}>{deal.sourceChannel}</Badge>
                  </div>
                )}
                {deal.advisorName && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Advisor</p>
                    <p className="text-sm">{deal.advisorName}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Collector intel */}
            {hasCollectorIntel && (
              <div className="px-5 py-4 border-b">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Collector Intelligence</p>
                <div className="space-y-2.5">
                  {contact.relationshipLevel && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Relationship</span>
                      <Badge className={relationshipColors[contact.relationshipLevel] || ""}>{contact.relationshipLevel}</Badge>
                    </div>
                  )}
                  {(contact.budgetLow || contact.budgetHigh) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Budget Range</span>
                      <span className="text-sm">{contact.budgetLow ? formatCurrency(contact.budgetLow) : "?"} – {contact.budgetHigh ? formatCurrency(contact.budgetHigh) : "?"}</span>
                    </div>
                  )}
                  {contact.preferredMedium && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Preferred Medium</span>
                      <span className="text-sm capitalize">{contact.preferredMedium}</span>
                    </div>
                  )}
                  {contact.preferredScale && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Preferred Scale</span>
                      <span className="text-sm capitalize">{contact.preferredScale}</span>
                    </div>
                  )}
                  {contact.artistsOfInterest && contact.artistsOfInterest.length > 0 && (
                    <div>
                      <span className="text-xs text-muted-foreground">Artists of Interest</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.artistsOfInterest.map(a => (
                          <Badge key={a} variant="outline" className="text-[10px]">{a}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {(contact.totalPurchases || contact.totalSpent) && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Purchase History</span>
                      <span className="text-sm">{contact.totalPurchases || 0} purchases · {contact.totalSpent ? formatCurrency(contact.totalSpent) : "$0"}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="px-5 py-4 border-b">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">Timeline</p>
              {timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((entry, i) => {
                    if (entry.kind === "activity") {
                      const Icon = activityIcons[entry.data.type] || MessageSquare;
                      return (
                        <div key={`a-${entry.data.id}`} className="flex gap-3 items-start">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm leading-snug">{entry.data.description}</p>
                            <p className="text-[10px] text-muted-foreground">{relativeDate(entry.data.date)}</p>
                          </div>
                        </div>
                      );
                    } else {
                      const isDone = entry.data.status === "completed";
                      return (
                        <div key={`f-${entry.data.id}`} className="flex gap-3 items-start">
                          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-amber-500" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm leading-snug">{entry.data.description}</p>
                              <Badge variant="outline" className="text-[9px] shrink-0">{entry.data.type}</Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {isDone ? "completed" : `due ${entry.data.dueDate}`}
                            </p>
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Notes</p>
                {!editingNotes && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setNotesValue(deal.notes || ""); setEditingNotes(true); }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {editingNotes ? (
                <div className="space-y-2">
                  <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4} autoFocus />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => updateNotes.mutate(notesValue)} disabled={updateNotes.isPending}>
                      {updateNotes.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {deal.notes || "No notes"}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Action bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-t shrink-0 bg-background">
          <Button variant="outline" size="sm" onClick={() => onEdit(deal)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
          </Button>
          {nextStage && !deal.stage.startsWith("closed") && (
            <Button variant="outline" size="sm" onClick={() => onMove(deal.id, nextStage.key)}>
              <ArrowRight className="h-3.5 w-3.5 mr-1.5" />{nextStage.label}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => onScheduleFollowup(deal)}>
            <CalendarPlus className="h-3.5 w-3.5 mr-1.5" />Follow-up
          </Button>
          <div className="flex-1" />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete deal?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete "{deal.title}".</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(deal.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
