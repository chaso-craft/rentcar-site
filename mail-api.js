async function sendReservationConfirmationEmail(reservation, estimateDocument) {
  if (
    typeof window.isSupabaseConfigured === "function" &&
    window.isSupabaseConfigured() &&
    typeof window.sendReservationEmailViaSupabase === "function"
  ) {
    try {
      return await window.sendReservationEmailViaSupabase(reservation, estimateDocument);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/Failed to send|FunctionsFetchError|not found|404|Function not found/i.test(message)) {
        throw error;
      }
      console.warn("Supabase Edge Function 経由のメール送信に失敗したため、ローカルAPIへフォールバックします。", error);
    }
  }

  function resolveMailApiBaseUrl() {
    if (window.RENTCAR_MAIL_API_URL) return window.RENTCAR_MAIL_API_URL;
    const stored = localStorage.getItem("rentcar-mail-api-url");
    if (stored) return stored;
    const host = window.location.hostname;
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:3001`;
    }
    return "http://localhost:3001";
  }

  const MAIL_API_BASE_URL = resolveMailApiBaseUrl();
  const MAIL_API_SECRET =
    window.RENTCAR_MAIL_API_SECRET ||
    localStorage.getItem("rentcar-mail-api-secret") ||
    "rentcar-local-secret-2026";

  const headers = { "Content-Type": "application/json" };
  if (MAIL_API_SECRET) {
    headers["X-API-Key"] = MAIL_API_SECRET;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  let response;
  try {
    response = await fetch(`${MAIL_API_BASE_URL}/api/reservation/send-confirmation`, {
      method: "POST",
      headers,
      body: JSON.stringify({ reservation, estimateDocument }),
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("メールサーバーへの接続がタイムアウトしました。");
    }
    throw new Error(
      "メールを送信できませんでした。Supabase の Edge Function（send-confirmation）をデプロイするか、メール用サーバーを起動してください。"
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `メール送信に失敗しました（${response.status}）`);
  }
  return result;
}
