// Quote arithmetic, mirrored line-for-line from public.recalculate_quote_totals
// in supabase/migrations/20260806120000_quotations.sql. The database is the
// authority — this exists so the line-item editor can show the same numbers
// before anything is saved. Change one, change the other.

export type QuoteDiscountType = "none" | "percent" | "amount";

export interface QuoteLineInput {
  quantity: number;
  unit_price: number;
  discount_percent: number;
  tax_rate: number;
}

export interface QuoteLineTotals {
  line_gross: number;
  line_discount: number;
  line_net: number;
  line_tax: number;
  line_total: number;
}

export interface QuoteTotals {
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total: number;
  lines: QuoteLineTotals[];
}

/** Half-away-from-zero rounding to 2dp, matching Postgres ROUND(numeric, 2). */
export function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  // toPrecision sheds float representation error first: 1.005 * 100 is
  // 100.49999999999999 in binary floating point but must round to 1.01.
  const scaled = Number((Math.abs(value) * 100).toPrecision(12));
  return ((value < 0 ? -1 : 1) * Math.round(scaled)) / 100;
}

function num(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function calculateLineNet(line: QuoteLineInput) {
  const gross = round2(num(line.quantity) * num(line.unit_price));
  const discount = round2((gross * num(line.discount_percent)) / 100);
  return { gross, discount, net: gross - discount };
}

export function calculateQuoteTotals(
  lines: QuoteLineInput[],
  discountType: QuoteDiscountType,
  discountValue: number,
): QuoteTotals {
  const nets = lines.map(calculateLineNet);
  const subtotal = round2(nets.reduce((sum, line) => sum + line.net, 0));

  const discountAmount =
    discountType === "percent"
      ? round2((subtotal * Math.min(num(discountValue), 100)) / 100)
      : discountType === "amount"
        ? Math.min(num(discountValue), subtotal)
        : 0;

  let allocated = 0;
  let taxAmount = 0;

  const lineTotals = nets.map((net, index) => {
    const isLast = index === nets.length - 1;
    // The last line absorbs the rounding remainder so the shares sum exactly.
    const share =
      subtotal > 0
        ? isLast
          ? discountAmount - allocated
          : round2((discountAmount * net.net) / subtotal)
        : 0;
    allocated += share;

    const taxable = net.net - share;
    const tax = round2((taxable * num(lines[index].tax_rate)) / 100);
    taxAmount += tax;

    return {
      line_gross: net.gross,
      line_discount: net.discount,
      line_net: net.net,
      line_tax: tax,
      line_total: taxable + tax,
    };
  });

  taxAmount = round2(taxAmount);

  return {
    subtotal,
    discount_amount: discountAmount,
    tax_amount: taxAmount,
    total: round2(subtotal - discountAmount + taxAmount),
    lines: lineTotals,
  };
}

/**
 * A sent quote whose validity date has passed reads as expired even before
 * expire_stale_quotes() next runs.
 */
export function isEffectivelyExpired(status: string, validUntil: string | null): boolean {
  if (status === "expired") return true;
  if (status !== "sent" || !validUntil) return false;
  const today = new Date().toISOString().slice(0, 10);
  return validUntil < today;
}

export function effectiveQuoteStatus(status: string, validUntil: string | null): string {
  return isEffectivelyExpired(status, validUntil) ? "expired" : status;
}
