"use client";

import * as React from "react";
import { AlertTriangle, Check, Info, Plus, TriangleAlert, X } from "lucide-react";
import { createCustomer } from "@/app/(app)/chat/actions";
import { cn } from "@/src/lib/utils";
import { Button } from "@/src/components/ui/button";
import { confirmAliasInBackground } from "@/src/components/chat/preview-card/alias-client";
import {
  formatVietnameseMoney,
  parseVietnameseNumber,
} from "@/src/components/chat/preview-card/number-utils";
import {
  getPatchedPreviewState,
  updateCustomerPatch,
  updateAmountPatch,
  updateItemProductPatch,
  updateItemPricePatch,
  updateItemQuantityPatch,
  updateSupplierPatch,
  type VisibleIssue,
} from "@/src/components/chat/preview-card/preview-state";
import type {
  PreviewCardPatch,
  PreviewResolvedEntityPatch,
} from "@/src/components/chat/preview-card/types";
import type {
  EntityCandidate,
  ResolvedEntity,
} from "@/src/lib/ai/resolve-schema";
import type { ValidatedIntent } from "@/src/lib/ai/validate-schema";

type PreviewCardProps = Readonly<{
  validated: ValidatedIntent;
  patched: PreviewCardPatch;
  isLive: boolean;
  onPatchChange: (patch: PreviewCardPatch) => void;
}>;

type DraftInputs = {
  prices: Record<number, string>;
  quantities: Record<number, string>;
  amount: string;
};

type EntityTarget =
  | { type: "customer"; entity: ResolvedEntity }
  | { type: "supplier"; entity: ResolvedEntity }
  | { type: "product"; entity: ResolvedEntity; itemIndex: number };

const TITLE_BY_INTENT: Record<string, string> = {
  create_order: "Đơn bán hàng",
  create_purchase: "Đơn nhập hàng",
  record_payment: "Thu / trả nợ",
};

const BUTTON_BY_INTENT: Record<string, string> = {
  create_order: "Ghi đơn",
  create_purchase: "Ghi nhập hàng",
  record_payment: "Ghi thu nợ",
};

function compactFeatureText(intent: ValidatedIntent["intent"]) {
  if (intent === "edit_order" || intent === "undo") {
    return "Tính năng này sẽ có ở bước sau ạ.";
  }

  return "Phần trả lời sẽ có ở bước sau ạ.";
}

function friendlyNoneMessage(intent: ValidatedIntent["intent"]) {
  return intent === "small_talk" ? "Dạ, em nghe ạ." : "Em chưa rõ ý câu này ạ.";
}

function counterpartyLabel(validated: ValidatedIntent) {
  return validated.intent === "create_purchase" ? "Nhà cung cấp" : "Khách";
}

function unresolvedCounterpartyText(validated: ValidatedIntent) {
  if (validated.intent === "create_purchase") {
    return "Chưa rõ nhập từ ai";
  }

  return validated.intent === "record_payment"
    ? "Chưa rõ khách nào"
    : "Chưa rõ bán cho ai";
}

function counterpartyEntity(
  validated: ValidatedIntent,
  state: ReturnType<typeof getPatchedPreviewState>,
) {
  return validated.intent === "create_purchase" ? state.supplier : state.customer;
}

function counterpartyName(entity: ResolvedEntity | null) {
  if (entity?.status === "resolved" && entity.resolved_name) {
    return entity.resolved_name;
  }

  return null;
}

function entityPatchFromCandidate(
  entity: ResolvedEntity,
  candidate: EntityCandidate,
): PreviewResolvedEntityPatch {
  return {
    entity_type: entity.entity_type,
    raw: entity.raw,
    resolved_id: candidate.id,
    resolved_name: candidate.name,
  };
}

function entityPatchFromCreatedCustomer(
  raw: string,
  customer: { id: string; name: string },
): PreviewResolvedEntityPatch {
  return {
    entity_type: "customer",
    raw,
    resolved_id: customer.id,
    resolved_name: customer.name,
  };
}

function shouldLearnAlias(raw: string | null, resolvedName: string) {
  if (!raw) {
    return false;
  }

  return raw.trim().toLocaleLowerCase("vi-VN") !== resolvedName.trim().toLocaleLowerCase("vi-VN");
}

function issueGroups(issues: VisibleIssue[]) {
  return {
    blocking: issues.filter((issue) => issue.severity === "blocking"),
    warning: issues.filter((issue) => issue.severity === "warning"),
    info: issues.filter((issue) => issue.severity === "info"),
  };
}

function IssuePanel({
  title,
  tone,
  issues,
}: Readonly<{
  title: string;
  tone: "blocking" | "warning" | "info";
  issues: VisibleIssue[];
}>) {
  if (issues.length === 0) {
    return null;
  }

  const Icon = tone === "blocking" ? TriangleAlert : tone === "warning" ? AlertTriangle : Info;

  return (
    <div
      className={cn(
        "rounded border px-3 py-2 text-[15px] leading-6",
        tone === "blocking" && "border-debt/30 bg-red-50 text-debt",
        tone === "warning" && "border-stamp/25 bg-amber-50 text-stamp",
        tone === "info" && "border-ledgerBorder bg-paperWarm text-textMute",
      )}
      data-testid={`issue-panel-${tone}`}
    >
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {issues.map((issue, index) => (
              <li key={`${issue.code}-${issue.item_index ?? "order"}-${index}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function PatchInput({
  label,
  placeholder,
  value,
  onChange,
}: Readonly<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}>) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        className="h-11 w-full min-w-[120px] rounded border border-stamp/35 bg-paperNote px-3 text-[16px] leading-6 text-textMain shadow-inner outline-none placeholder:text-textFaint focus:border-ink"
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function EntityChoicePanel({
  entity,
  label,
  allowCreate,
  onSelect,
  onCreate,
}: Readonly<{
  entity: ResolvedEntity;
  label: string;
  allowCreate: boolean;
  onSelect: (candidate: EntityCandidate) => void;
  onCreate?: () => void;
}>) {
  const raw = entity.raw ?? "";
  const candidates = entity.candidates.slice(0, 3);

  if (candidates.length === 0 && !allowCreate) {
    return null;
  }

  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid={`${entity.entity_type}-confirm-panel`}
    >
      <p className="font-semibold text-inkDeep">
        {raw ? `${label} "${raw}" - có phải ý bác là...?` : "Bác chọn giúp em ạ."}
      </p>
      {candidates.length > 0 ? (
        <div className="mt-2 flex flex-col gap-2">
          {candidates.map((candidate) => (
            <Button
              key={candidate.id}
              type="button"
              variant="outline"
              className="h-auto min-h-11 justify-start rounded border-ledgerBorder bg-surface px-3 py-2 text-left text-[16px] font-semibold text-inkDeep hover:bg-paperWarm"
              onClick={() => onSelect(candidate)}
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              {candidate.name}
            </Button>
          ))}
        </div>
      ) : null}
      {allowCreate && raw ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-2 h-auto min-h-10 justify-start px-0 text-[15px] font-semibold text-stamp hover:bg-transparent hover:text-ink"
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Không phải, thêm khách mới: &quot;{raw}&quot;
        </Button>
      ) : null}
    </div>
  );
}

function CustomerCreatePanel({
  raw,
  isSaving,
  error,
  onCreate,
  onDismiss,
}: Readonly<{
  raw: string;
  isSaving: boolean;
  error: string | null;
  onCreate: () => void;
  onDismiss: () => void;
}>) {
  return (
    <div
      className="mt-2 rounded border border-stamp/25 bg-paperNote px-3 py-3 text-[15px] leading-6"
      data-testid="customer-create-panel"
    >
      <p className="font-semibold text-inkDeep">
        Chưa có khách &quot;{raw}&quot;. Thêm mới nhé?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-11 rounded bg-ink px-3 text-[16px] font-semibold text-paper hover:bg-inkDeep"
          disabled={isSaving}
          onClick={onCreate}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {isSaving ? "Đang thêm..." : `Thêm ${raw}`}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 rounded border-ledgerBorder bg-surface px-3 text-[16px] font-semibold text-textMute hover:bg-paperWarm"
          onClick={onDismiss}
        >
          <X className="h-4 w-4" aria-hidden="true" />
          Để sau
        </Button>
      </div>
      {error ? <p className="mt-2 text-[15px] text-debt">{error}</p> : null}
    </div>
  );
}

function ProductMissingNotice({ raw }: Readonly<{ raw: string }>) {
  return (
    <div
      className="mt-2 rounded border border-debt/25 bg-red-50 px-3 py-2 text-[15px] leading-6 text-debt"
      data-testid="product-not-found"
    >
      Chưa có hàng &quot;{raw}&quot; trong sổ. Bác vào mục Sản phẩm thêm hàng này sau ạ.
    </div>
  );
}

export function PreviewCard({
  validated,
  patched,
  isLive,
  onPatchChange,
}: PreviewCardProps) {
  const [notice, setNotice] = React.useState<string | null>(null);
  const [forceCreateCustomer, setForceCreateCustomer] = React.useState(false);
  const [dismissedCustomerCreate, setDismissedCustomerCreate] = React.useState(false);
  const [isCreatingCustomer, setIsCreatingCustomer] = React.useState(false);
  const [createCustomerError, setCreateCustomerError] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<DraftInputs>({
    prices: {},
    quantities: {},
    amount: "",
  });
  const latestPatchRef = React.useRef(patched);
  const state = getPatchedPreviewState(validated, patched);

  React.useEffect(() => {
    latestPatchRef.current = patched;
  }, [patched]);

  if (validated.kind === "none") {
    return (
      <div
        className={cn("flex w-full justify-start", !isLive && "opacity-70")}
        data-testid="preview-none"
      >
        <div className="max-w-[86%] rounded border border-dashed border-ledgerBorder bg-paperWarm px-4 py-3 text-[16px] leading-7 text-textMute shadow-none sm:max-w-[78%]">
          {friendlyNoneMessage(validated.intent)}
        </div>
      </div>
    );
  }

  if (validated.kind === "query" || validated.kind === "edit" || validated.kind === "undo") {
    return (
      <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
        <article
          className="w-full max-w-[92%] rounded border border-ledgerBorder bg-surface px-4 py-4 text-[16px] leading-7 text-textMain shadow-[var(--shadow-card)] sm:max-w-[84%]"
          data-testid={`preview-${validated.kind}`}
        >
          {validated.kind === "query" ? (
            <>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Câu hỏi
              </p>
              <p className="mt-2 font-semibold text-inkDeep">{validated.raw_text}</p>
              <p className="mt-2 text-textMute">{compactFeatureText(validated.intent)}</p>
            </>
          ) : (
            <p className="font-semibold text-inkDeep">
              {compactFeatureText(validated.intent)}
            </p>
          )}
        </article>
      </div>
    );
  }

  const title = TITLE_BY_INTENT[validated.intent] ?? "Thẻ đơn";
  const buttonLabel = BUTTON_BY_INTENT[validated.intent] ?? "Ghi đơn";
  const groups = issueGroups(state.issues);
  const counterparty = counterpartyEntity(validated, state);
  const entityName = counterpartyName(counterparty);
  const showAmountPatch =
    isLive &&
    validated.intent === "record_payment" &&
    validated.effective_amount === null &&
    validated.issues.some(
      (issue) => issue.code === "missing_amount" || issue.code === "invalid_amount",
    );

  function applyEntityPatch(target: EntityTarget, entity: PreviewResolvedEntityPatch) {
    const currentPatch = latestPatchRef.current;

    if (target.type === "customer") {
      onPatchChange(updateCustomerPatch(currentPatch, entity));
      return;
    }

    if (target.type === "supplier") {
      onPatchChange(updateSupplierPatch(currentPatch, entity));
      return;
    }

    onPatchChange(updateItemProductPatch(currentPatch, target.itemIndex, entity));
  }

  function handleSelectCandidate(target: EntityTarget, candidate: EntityCandidate) {
    const entityPatch = entityPatchFromCandidate(target.entity, candidate);

    applyEntityPatch(target, entityPatch);

    if (shouldLearnAlias(target.entity.raw, candidate.name)) {
      void confirmAliasInBackground(
        target.entity.entity_type,
        candidate.id,
        target.entity.raw,
      );
    }
  }

  async function handleCreateCustomer(rawName: string) {
    const name = rawName.trim();

    if (!name || isCreatingCustomer) {
      return;
    }

    setIsCreatingCustomer(true);
    setCreateCustomerError(null);

    try {
      const result = await createCustomer(name);

      if (!result.ok) {
        setCreateCustomerError(result.message);
        return;
      }

      onPatchChange(
        updateCustomerPatch(
          latestPatchRef.current,
          entityPatchFromCreatedCustomer(name, result.data),
        ),
      );
      setForceCreateCustomer(false);
      setDismissedCustomerCreate(false);
    } catch (error) {
      console.error("createCustomer failed", error);
      setCreateCustomerError("Chưa thêm được khách, bác thử lại ạ.");
    } finally {
      setIsCreatingCustomer(false);
    }
  }

  function handlePriceChange(itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      prices: {
        ...current.prices,
        [itemIndex]: value,
      },
    }));
    onPatchChange(updateItemPricePatch(patched, itemIndex, parseVietnameseNumber(value)));
  }

  function handleQuantityChange(itemIndex: number, value: string) {
    setDrafts((current) => ({
      ...current,
      quantities: {
        ...current.quantities,
        [itemIndex]: value,
      },
    }));
    onPatchChange(
      updateItemQuantityPatch(patched, itemIndex, parseVietnameseNumber(value)),
    );
  }

  function handleAmountChange(value: string) {
    setDrafts((current) => ({
      ...current,
      amount: value,
    }));
    onPatchChange(updateAmountPatch(patched, parseVietnameseNumber(value)));
  }

  function quantityInputValue(itemIndex: number, value: number | null) {
    return drafts.quantities[itemIndex] ?? (value === null ? "" : String(value));
  }

  function priceInputValue(itemIndex: number, value: number | null) {
    return drafts.prices[itemIndex] ?? (value === null ? "" : String(Math.round(value)));
  }

  return (
    <div className={cn("flex w-full justify-start", !isLive && "opacity-70")}>
      <article
        className={cn(
          "w-full max-w-[94%] rounded border px-4 py-4 text-textMain shadow-[var(--shadow-card)] sm:max-w-[88%]",
          isLive
            ? "border-ledgerBorder bg-surface"
            : "border-ledgerBorder bg-paperWarm shadow-none",
        )}
        data-testid={isLive ? "preview-card-live" : "preview-card-frozen"}
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ledgerBorder pb-3">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
              {validated.intent}
            </p>
            <h2 className="mt-1 font-display text-2xl font-semibold tracking-normal text-inkDeep">
              {title}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[14px] leading-5 text-textMute">Tổng tiền</p>
            <p className="font-display text-2xl font-semibold tracking-normal text-paid">
              {formatVietnameseMoney(state.total)}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
          <p className="font-semibold text-textMute">{counterpartyLabel(validated)}</p>
          <div>
            {entityName ? (
              <p className="font-semibold text-inkDeep">{entityName}</p>
            ) : (
              <p className="font-semibold text-debt">
                {unresolvedCounterpartyText(validated)}
              </p>
            )}
            {isLive &&
            counterparty?.entity_type === "customer" &&
            (counterparty.status === "needs_confirmation" ||
              counterparty.status === "ambiguous") &&
            !forceCreateCustomer ? (
              <EntityChoicePanel
                entity={counterparty}
                label="Khách"
                allowCreate
                onSelect={(candidate) =>
                  handleSelectCandidate({ type: "customer", entity: counterparty }, candidate)
                }
                onCreate={() => {
                  setCreateCustomerError(null);
                  setForceCreateCustomer(true);
                  setDismissedCustomerCreate(false);
                }}
              />
            ) : null}
            {isLive &&
            counterparty?.entity_type === "supplier" &&
            (counterparty.status === "needs_confirmation" ||
              counterparty.status === "ambiguous") ? (
              <EntityChoicePanel
                entity={counterparty}
                label="Nhà cung cấp"
                allowCreate={false}
                onSelect={(candidate) =>
                  handleSelectCandidate({ type: "supplier", entity: counterparty }, candidate)
                }
              />
            ) : null}
            {isLive &&
            counterparty?.entity_type === "customer" &&
            counterparty.raw &&
            !entityName &&
            !dismissedCustomerCreate &&
            (forceCreateCustomer || counterparty.status === "not_found") ? (
              <CustomerCreatePanel
                raw={counterparty.raw}
                isSaving={isCreatingCustomer}
                error={createCustomerError}
                onCreate={() => handleCreateCustomer(counterparty.raw ?? "")}
                onDismiss={() => {
                  setForceCreateCustomer(false);
                  setDismissedCustomerCreate(true);
                  setCreateCustomerError(null);
                }}
              />
            ) : null}
          </div>
        </div>

        {validated.intent === "record_payment" ? (
          <div className="mt-4 rounded border border-ledgerBorder bg-paper px-3 py-3">
            <div className="grid gap-2 text-[16px] leading-7 sm:grid-cols-[140px_1fr]">
              <p className="font-semibold text-textMute">Số tiền</p>
              {showAmountPatch ? (
                <PatchInput
                  label="Nhập số tiền"
                  placeholder="Nhập số tiền"
                  value={drafts.amount}
                  onChange={handleAmountChange}
                />
              ) : (
                <p className="font-semibold text-inkDeep">
                  {formatVietnameseMoney(state.amount)}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded border border-ledgerBorder">
            <div className="grid grid-cols-[1.4fr_1fr] gap-2 bg-paperWarm px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-stamp sm:grid-cols-[1.5fr_0.8fr_1fr_1fr]">
              <span>Mặt hàng</span>
              <span>Số lượng</span>
              <span className="hidden sm:block">Đơn giá</span>
              <span className="hidden sm:block">Thành tiền</span>
            </div>
            <div className="divide-y divide-ledgerBorder">
              {state.items.map((displayItem) => {
                const quantityDraft = quantityInputValue(
                  displayItem.index,
                  displayItem.quantity,
                );
                const priceDraft = priceInputValue(
                  displayItem.index,
                  displayItem.unitPrice,
                );
                const showQuantityInput = isLive;
                const showPriceInput = isLive;
                const productNeedsChoice =
                  isLive &&
                  (displayItem.resolution.status === "needs_confirmation" ||
                    displayItem.resolution.status === "ambiguous");
                const productNotFound =
                  isLive && displayItem.resolution.status === "not_found";

                return (
                  <div
                    key={`${displayItem.item.raw}-${displayItem.index}`}
                    className="grid grid-cols-[1.4fr_1fr] gap-2 px-3 py-3 text-[16px] leading-7 sm:grid-cols-[1.5fr_0.8fr_1fr_1fr]"
                  >
                    <div>
                      <p className="font-semibold text-inkDeep">{displayItem.name}</p>
                      {!showPriceInput ? (
                        <p className="text-[14px] leading-5 text-textMute sm:hidden">
                          Đơn giá: {formatVietnameseMoney(displayItem.unitPrice)}
                        </p>
                      ) : null}
                      <p className="text-[14px] leading-5 text-textMute sm:hidden">
                        Thành tiền: {formatVietnameseMoney(displayItem.lineTotal)}
                      </p>
                      {productNeedsChoice ? (
                        <EntityChoicePanel
                          entity={displayItem.resolution}
                          label="Hàng"
                          allowCreate={false}
                          onSelect={(candidate) =>
                            handleSelectCandidate(
                              {
                                type: "product",
                                entity: displayItem.resolution,
                                itemIndex: displayItem.index,
                              },
                              candidate,
                            )
                          }
                        />
                      ) : null}
                      {productNotFound ? (
                        <ProductMissingNotice
                          raw={
                            displayItem.resolution.raw ??
                            displayItem.item.product_name ??
                            displayItem.item.raw
                          }
                        />
                      ) : null}
                    </div>
                    <div>
                      {showQuantityInput ? (
                        <PatchInput
                          label={`Sửa số lượng ${displayItem.name}`}
                          placeholder="Nhập SL"
                          value={quantityDraft}
                          onChange={(value) =>
                            handleQuantityChange(displayItem.index, value)
                          }
                        />
                      ) : (
                        <p className="font-semibold">
                          {displayItem.quantity ?? "Chưa có"}{" "}
                          {displayItem.unit ?? ""}
                        </p>
                      )}
                    </div>
                    <div className="hidden sm:block">
                      {showPriceInput ? (
                        <PatchInput
                          label={`Sửa giá ${displayItem.name}`}
                          placeholder={`Nhập giá ${displayItem.unit ?? "1 đơn vị"}`}
                          value={priceDraft}
                          onChange={(value) =>
                            handlePriceChange(displayItem.index, value)
                          }
                        />
                      ) : (
                        <p className="font-semibold">
                          {formatVietnameseMoney(displayItem.unitPrice)}
                        </p>
                      )}
                    </div>
                    <p className="hidden font-semibold text-inkDeep sm:block">
                      {formatVietnameseMoney(displayItem.lineTotal)}
                    </p>
                    {showPriceInput ? (
                      <div className="col-span-2 sm:hidden">
                        <PatchInput
                          label={`Sửa giá ${displayItem.name}`}
                          placeholder={`Nhập giá ${displayItem.unit ?? "1 đơn vị"}`}
                          value={priceDraft}
                          onChange={(value) =>
                            handlePriceChange(displayItem.index, value)
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <IssuePanel title="Cần bổ sung" tone="blocking" issues={groups.blocking} />
          <IssuePanel title="Cần kiểm tra" tone="warning" issues={groups.warning} />
          <IssuePanel title="Ghi chú" tone="info" issues={groups.info} />
        </div>

        {isLive ? (
          <div className="mt-4 border-t border-ledgerBorder pt-3">
            <Button
              type="button"
              disabled={!state.canConfirm}
              title={
                state.canConfirm
                  ? "Phần ghi đơn thật sẽ có ở bước sau ạ."
                  : "Còn thiếu thông tin, bác bổ sung giúp em ạ."
              }
              className="h-12 rounded bg-ink px-5 text-[16px] font-semibold text-paper hover:bg-inkDeep disabled:cursor-not-allowed disabled:opacity-55"
              onClick={() => setNotice("Phần ghi đơn thật sẽ có ở bước sau ạ.")}
            >
              {buttonLabel}
            </Button>
            {!state.canConfirm ? (
              <p className="mt-2 text-[15px] leading-6 text-textMute">
                Còn thiếu thông tin, bác bổ sung giúp em ạ.
              </p>
            ) : null}
            {notice ? (
              <p className="mt-2 text-[15px] leading-6 text-stamp" role="status">
                {notice}
              </p>
            ) : null}
          </div>
        ) : null}
      </article>
    </div>
  );
}
