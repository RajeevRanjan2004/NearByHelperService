import crypto from "crypto";
import env from "../config/env.js";

const razorpayBaseUrl = "https://api.razorpay.com/v1";

function isRazorpayConfigured() {
  return Boolean(env.razorpayKeyId && env.razorpayKeySecret);
}

function isRazorpayWebhookConfigured() {
  return Boolean(env.razorpayWebhookSecret);
}

function createAuthHeader() {
  const token = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString("base64");
  return `Basic ${token}`;
}

async function razorpayRequest(path, options = {}) {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay is not configured on the server");
  }

  const response = await fetch(`${razorpayBaseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: createAuthHeader(),
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.description || "Razorpay request failed");
  }

  return payload;
}

async function createRazorpayOrder({ amount, currency, receipt, notes }) {
  return razorpayRequest("/orders", {
    method: "POST",
    body: JSON.stringify({
      amount,
      currency,
      receipt,
      notes,
    }),
  });
}

async function fetchRazorpayPayment(paymentId) {
  return razorpayRequest(`/payments/${paymentId}`, {
    method: "GET",
  });
}

async function fetchRazorpayOrderPayments(orderId) {
  return razorpayRequest(`/orders/${orderId}/payments`, {
    method: "GET",
  });
}

async function captureRazorpayPayment(paymentId, { amount, currency = "INR" } = {}) {
  const captureAmount = Number(amount || 0);

  if (!paymentId) {
    throw new Error("Razorpay payment id is required for capture");
  }

  if (!Number.isFinite(captureAmount) || captureAmount <= 0) {
    throw new Error("A valid capture amount is required for Razorpay payments");
  }

  return razorpayRequest(`/payments/${paymentId}/capture`, {
    method: "POST",
    body: JSON.stringify({
      amount: captureAmount,
      currency,
    }),
  });
}

function isCapturedRazorpayPayment(paymentEntity) {
  return paymentEntity?.captured === true || paymentEntity?.status === "captured";
}

async function captureAuthorizedRazorpayPayment(paymentEntity, { amount, currency = "INR" } = {}) {
  if (!paymentEntity?.id) {
    return paymentEntity;
  }

  if (isCapturedRazorpayPayment(paymentEntity) || paymentEntity.status !== "authorized") {
    return paymentEntity;
  }

  try {
    return await captureRazorpayPayment(paymentEntity.id, {
      amount: paymentEntity.amount || amount,
      currency: paymentEntity.currency || currency,
    });
  } catch (error) {
    const latestPayment = await fetchRazorpayPayment(paymentEntity.id).catch(() => null);

    if (isCapturedRazorpayPayment(latestPayment)) {
      return latestPayment;
    }

    throw error;
  }
}

async function createRazorpayRefund(paymentId, { amount, speed = "normal", notes, receipt } = {}) {
  return razorpayRequest(`/payments/${paymentId}/refund`, {
    method: "POST",
    body: JSON.stringify({
      ...(amount ? { amount } : {}),
      speed,
      ...(notes ? { notes } : {}),
      ...(receipt ? { receipt } : {}),
    }),
  });
}

function verifyRazorpayWebhookSignature({ payload, signature }) {
  if (!env.razorpayWebhookSecret) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac("sha256", env.razorpayWebhookSecret)
    .update(String(payload || ""))
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature);
  const signatureBuffer = Buffer.from(String(signature || ""));

  if (generatedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const generatedSignature = crypto
    .createHmac("sha256", env.razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const generatedBuffer = Buffer.from(generatedSignature);
  const signatureBuffer = Buffer.from(String(signature || ""));

  if (generatedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(generatedBuffer, signatureBuffer);
}

export {
  captureAuthorizedRazorpayPayment,
  captureRazorpayPayment,
  createRazorpayOrder,
  createRazorpayRefund,
  fetchRazorpayOrderPayments,
  fetchRazorpayPayment,
  isRazorpayConfigured,
  isCapturedRazorpayPayment,
  isRazorpayWebhookConfigured,
  verifyRazorpayWebhookSignature,
  verifyRazorpaySignature,
};
