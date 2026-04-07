import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, advisors } from "@/lib/pipeline-constants";
import type { Invoice } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Search, Filter, Download, Trash2,
  FileText, ChevronLeft, ChevronRight, X, Calendar,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PAGE_SIZE = 25;

const invoiceStatusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  sent: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
};

export default function SalesHistory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedAdvisors, setSelectedAdvisors] = useState<string[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Pagination
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (dateFrom) p.set("dateFrom", dateFrom);
    if (dateTo) p.set("dateTo", dateTo);
    if (selectedAdvisors.length === 1) p.set("advisorName", selectedAdvisors[0]);
    return p.toString();
  }, [search, dateFrom, dateTo, selectedAdvisors]);

  // Now fetches invoices directly
  const { data: allInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ["/api/sales-history", queryParams],
    queryFn: () => fetch(`/api/sales-history?${queryParams}`).then(r => r.json()),
  });

  // Client-side filter for multi-advisor
  const filteredInvoices = useMemo(() => {
    let result = allInvoices;
    if (selectedAdvisors.length > 1) {
      result = result.filter(inv => selectedAdvisors.includes(inv.advisorName || ""));
    }
    return result;
  }, [allInvoices, selectedAdvisors]);

  // Pagination
  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE);
  const pagedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Selected invoice for detail sheet
  const selectedInvoice = filteredInvoices.find(inv => inv.id === selectedInvoiceId);

  // Update invoice status
  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, any> }) =>
      apiRequest("PATCH", `/api/invoices/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-stats"] });
      toast({ title: "Invoice updated" });
    },
  });

  // Delete invoice
  const deleteInvoiceMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      setSelectedInvoiceId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sales-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sales-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({ title: "Invoice deleted" });
    },
  });

  function toggleAdvisor(a: string) {
    setSelectedAdvisors(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
    );
    setPage(1);
  }

  function handleDownloadPdf(invoiceId: number) {
    window.open(`/api/invoices/${invoiceId}/pdf`, "_blank");
  }

  const hasFilters = search || dateFrom || dateTo || selectedAdvisors.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sales History</h1>
        <p className="text-sm text-muted-foreground">Complete sales record and invoices</p>
      </div>


      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices, contacts, artworks..."
            className="pl-8 h-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          <Input type="date" className="h-9 w-36" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" className="h-9 w-36" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={selectedAdvisors.length > 0 ? "border-primary" : ""}>
              <Filter className="h-3.5 w-3.5 mr-1" />
              {selectedAdvisors.length === 0 ? "Advisors" : `${selectedAdvisors.length} advisor${selectedAdvisors.length > 1 ? "s" : ""}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-2" align="end">
            {advisors.map(a => (
              <label key={a} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm">
                <Checkbox checked={selectedAdvisors.includes(a)} onCheckedChange={() => toggleAdvisor(a)} />
                {a}
              </label>
            ))}
          </PopoverContent>
        </Popover>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setDateFrom(""); setDateTo(""); setSelectedAdvisors([]); setPage(1); }}>
            <X className="h-3.5 w-3.5 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 font-medium">Date</th>
                <th className="text-left px-4 py-2.5 font-medium">Invoice</th>
                <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">Artist / Artwork</th>
                <th className="text-right px-4 py-2.5 font-medium">Amount</th>
                <th className="text-center px-4 py-2.5 font-medium hidden lg:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">Advisor</th>
                <th className="text-center px-4 py-2.5 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pagedInvoices.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-muted-foreground">
                    {hasFilters ? "No sales match your filters" : "No sales recorded yet"}
                  </td>
                </tr>
              )}
              {pagedInvoices.map(inv => (
                <tr
                  key={inv.id}
                  className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedInvoiceId(inv.id)}
                >
                  <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                    {inv.issueDate ? new Date(inv.issueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-mono">{inv.invoiceNumber}</span>
                  </td>
                  <td className="px-4 py-2.5 font-medium">{inv.contactName || "—"}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-muted-foreground truncate max-w-[250px]">
                    {inv.artistName ? <span className="font-medium text-foreground">{inv.artistName}</span> : null}
                    {inv.artistName && inv.artworkTitle ? " — " : ""}
                    {inv.artworkTitle || (!inv.artistName ? "—" : "")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap">
                    {formatCurrency(inv.totalAmount, inv.currency || "USD")}
                  </td>
                  <td className="px-4 py-2.5 text-center hidden lg:table-cell">
                    <Badge variant="secondary" className={`text-[10px] ${invoiceStatusColors[inv.status] || ""}`}>
                      {inv.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-muted-foreground">{inv.advisorName || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7"
                      onClick={e => { e.stopPropagation(); handleDownloadPdf(inv.id); }}
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{filteredInvoices.length} sales</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedInvoice} onOpenChange={open => { if (!open) setSelectedInvoiceId(null); }}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Invoice {selectedInvoice?.invoiceNumber}</SheetTitle>
            <SheetDescription>Sale details</SheetDescription>
          </SheetHeader>

          {selectedInvoice && (
            <div className="mt-4 space-y-6">
              {/* Invoice Info */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Contact</span>
                  <p className="font-medium">{selectedInvoice.contactName || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Email</span>
                  <p className="font-medium">{selectedInvoice.contactEmail || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Artist</span>
                  <p className="font-medium">{selectedInvoice.artistName || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Artwork</span>
                  <p className="font-medium">{selectedInvoice.artworkTitle || "—"}</p>
                </div>
                {selectedInvoice.artworkDetails && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground text-xs">Details</span>
                    <p className="font-medium">{selectedInvoice.artworkDetails}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs">Amount</span>
                  <p className="font-medium">{formatCurrency(selectedInvoice.totalAmount, selectedInvoice.currency || "USD")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Issue Date</span>
                  <p className="font-medium">{selectedInvoice.issueDate}</p>
                </div>
                {selectedInvoice.paidDate && (
                  <div>
                    <span className="text-muted-foreground text-xs">Paid Date</span>
                    <p className="font-medium">{selectedInvoice.paidDate}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground text-xs">Advisor</span>
                  <p className="font-medium">{selectedInvoice.advisorName || "—"}</p>
                </div>
              </div>

              {selectedInvoice.notes && (
                <div>
                  <span className="text-muted-foreground text-xs">Notes</span>
                  <p className="text-sm mt-1">{selectedInvoice.notes}</p>
                </div>
              )}

              {/* Status & Actions */}
              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">Payment Status</span>
                  </div>
                  <Badge variant="secondary" className={invoiceStatusColors[selectedInvoice.status] || ""}>
                    {selectedInvoice.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  {selectedInvoice.status === "draft" && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => updateInvoiceMutation.mutate({ id: selectedInvoice.id, data: { status: "sent" } })}
                    >
                      Mark as Sent
                    </Button>
                  )}
                  {(selectedInvoice.status === "draft" || selectedInvoice.status === "sent") && (
                    <Button
                      size="sm" variant="default"
                      onClick={() => updateInvoiceMutation.mutate({
                        id: selectedInvoice.id,
                        data: { status: "paid", paidDate: new Date().toISOString().split("T")[0] },
                      })}
                    >
                      Mark as Paid
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(selectedInvoice.id)}>
                    <Download className="h-3.5 w-3.5 mr-1" /> PDF
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline" className="text-destructive hover:text-destructive ml-auto">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete invoice {selectedInvoice.invoiceNumber}. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => deleteInvoiceMutation.mutate(selectedInvoice.id)}
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
