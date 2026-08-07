import assert from "node:assert/strict";
import { test } from "node:test";
import { deriveInvoicePaymentState } from "./invoice-payments";

test("unpaid sent invoice stays sent", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "sent",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 0,
    }),
    { amountPaid: 0, balance: 100, status: "sent" },
  );
});

test("partial receipt marks invoice partially paid", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "sent",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 40,
    }),
    { amountPaid: 40, balance: 60, status: "partially_paid" },
  );
});

test("full receipt marks invoice paid", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "partially_paid",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 100,
    }),
    { amountPaid: 100, balance: 0, status: "paid" },
  );
});

test("overpayment is clamped to invoice total", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "sent",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 125,
    }),
    { amountPaid: 100, balance: 0, status: "paid" },
  );
});

test("cancelled invoice status is preserved", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "cancelled",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 50,
    }),
    { amountPaid: 50, balance: 50, status: "cancelled" },
  );
});

test("voided final receipt returns paid invoice to sent or draft", () => {
  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "paid",
      sentAt: "2026-08-07T12:00:00.000Z",
      total: 100,
      receiptTotal: 0,
    }),
    { amountPaid: 0, balance: 100, status: "sent" },
  );

  assert.deepEqual(
    deriveInvoicePaymentState({
      currentStatus: "partially_paid",
      sentAt: null,
      total: 100,
      receiptTotal: 0,
    }),
    { amountPaid: 0, balance: 100, status: "draft" },
  );
});
