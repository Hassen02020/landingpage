import { Badge } from "@/components/ui/Badge"

const VARIANTS: Record<string, "forest" | "coral" | "gold" | "sand" | "outline"> = {
  pending: "sand",
  paid: "forest",
  processing: "gold",
  shipped: "forest",
  delivered: "forest",
  cancelled: "outline",
  refunded: "coral",
}

const LABELS: Record<string, string> = {
  pending: "Pending",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? "sand"}>{LABELS[status] ?? status}</Badge>
}
