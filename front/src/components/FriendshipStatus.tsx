import { Check, Clock, X } from "lucide-react";

export function FriendshipStatus({ status }: { status: string }) {
  const accepted = status === "accepted";
  const label = accepted ? "Amigo" : status === "pending" ? "Pendente" : "Pedido recusado";
  return (
    <span
      title={label}
      className={`inline-flex items-center gap-1.5 text-xs ${accepted ? "text-emerald-500" : status === "pending" ? "text-yellow-500" : "text-muted-foreground"}`}
    >
      {accepted ? (
        <Check className="size-4" />
      ) : status === "pending" ? (
        <Clock className="size-4" />
      ) : (
        <X className="size-4" />
      )}
      {label}
    </span>
  );
}
