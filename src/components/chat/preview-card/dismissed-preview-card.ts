import type { ChatMessageView } from "@/src/components/chat/types";
import type { PatchedPreviewState } from "@/src/components/chat/preview-card/preview-state";
import type {
  HistoryCommitCard,
  HistoryCommitCardItem,
} from "@/src/lib/chat/history-card";

export type DismissedPreviewCardKind =
  | "create_order"
  | "record_payment"
  | "create_purchase";

export type DismissedPreviewPayload = Readonly<{
  content: string;
  card: HistoryCommitCard | null;
}>;

export function claimDismissPreview(ref: { current: boolean }) {
  if (ref.current) {
    return false;
  }

  ref.current = true;
  return true;
}

function finiteNumberOrNull(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildDismissedPreviewCardFromState(
  state: PatchedPreviewState,
  kind: DismissedPreviewCardKind,
  businessDate: string | null,
): HistoryCommitCard {
  const entity = kind === "create_purchase" ? state.supplier : state.customer;
  const entityName =
    entity?.status === "resolved" && entity.resolved_name?.trim()
      ? entity.resolved_name.trim()
      : null;

  if (kind === "record_payment") {
    return {
      v: 1,
      kind,
      entity_name: entityName,
      business_date: null,
      total_amount: null,
      debt_amount: null,
      amount: finiteNumberOrNull(state.amount),
      items: null,
      source_id: null,
      scope_label: null,
    };
  }

  const items: HistoryCommitCardItem[] = [];

  for (const item of state.items) {
    items.push({
      name: item.name,
      quantity: finiteNumberOrNull(item.quantity),
      unit: item.unit ?? "",
      unit_price: finiteNumberOrNull(item.unitPrice),
      line_total: finiteNumberOrNull(item.lineTotal),
    });
  }

  return {
    v: 1,
    kind,
    entity_name: entityName,
    business_date: businessDate,
    total_amount: finiteNumberOrNull(state.total),
    debt_amount: null,
    amount: null,
    items,
    source_id: null,
    scope_label: null,
  };
}

export function isDuplicateDismissedPreviewMessage(
  messages: ChatMessageView[],
  payload: DismissedPreviewPayload,
) {
  const lastMessage = messages.at(-1);
  const metadata =
    lastMessage?.metadata && typeof lastMessage.metadata === "object"
      ? (lastMessage.metadata as Record<string, unknown>)
      : null;

  return (
    lastMessage?.role === "assistant" &&
    lastMessage.ephemeral === true &&
    lastMessage.content === payload.content &&
    metadata?.source === "tip_22_dismiss"
  );
}
