export const stages = [
  { key: "new_inquiry", label: "New Inquiry", color: "border-t-sky-500" },
  { key: "qualified", label: "Qualified", color: "border-t-blue-500" },
  { key: "artwork_presented", label: "Artwork Presented", color: "border-t-indigo-500" },
  { key: "collector_engaged", label: "Collector Engaged", color: "border-t-amber-500" },
  { key: "negotiation", label: "Negotiation", color: "border-t-purple-500" },
  { key: "closed_won", label: "Won", color: "border-t-emerald-500" },
  { key: "closed_lost", label: "Lost", color: "border-t-red-500" },
];

export const sourceChannels = ["Artsy", "Website", "WhatsApp", "Instagram", "Email", "Referral"];

export const lostReasons = [
  "Price too high",
  "Lost interest",
  "Bought elsewhere",
  "Budget constraints",
  "No response",
  "Other",
];

export const advisors = [
  "Miguel Duque", "Santiago Duque", "Federico Duque", "Sebastián Duque",
  "David Duque", "Germán Duque", "Sergio Arango", "Nora Acosta",
];

export const priorityColors: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

export const sourceColors: Record<string, string> = {
  Artsy: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  Website: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  WhatsApp: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  Instagram: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  Email: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300",
  Referral: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

export const stageBadgeColors: Record<string, string> = {
  new_inquiry: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  qualified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  artwork_presented: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  collector_engaged: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  negotiation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  closed_won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed_lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export function formatCurrency(val: number, currency: string = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(val);
}

export function relativeDate(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}
