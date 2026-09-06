const MAIL_API_BASE_URL =
  window.RENTCAR_MAIL_API_URL || localStorage.getItem("rentcar-mail-api-url") || "http://localhost:3001";

const MAIL_API_SECRET =
  window.RENTCAR_MAIL_API_SECRET ||
  localStorage.getItem("rentcar-mail-api-secret") ||
  "rentcar-local-secret-2026";

async function sendReservationConfirmationEmail(reservation, estimateDocument) {
  const headers = { "Content-Type": "application/json" };
  if (MAIL_API_SECRET) {
    headers["X-API-Key"] = MAIL_API_SECRET;
  }

  const response = await fetch(`${MAIL_API_BASE_URL}/api/reservation/send-confirmation`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reservation, estimateDocument })
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `メール送信に失敗しました（${response.status}）`);
  }
  return result;
}
