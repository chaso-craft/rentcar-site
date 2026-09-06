/**
 * 公開環境の設定（Netlify など）
 * メールAPIを別途デプロイしたときだけ URL を書き換えてください。
 */
(function () {
  const host = window.location.hostname;
  if (
    !window.RENTCAR_MAIL_API_URL &&
    host &&
    host !== "localhost" &&
    host !== "127.0.0.1"
  ) {
    window.RENTCAR_MAIL_API_URL = `http://${host}:3001`;
  }
})();
window.RENTCAR_MAIL_API_URL = window.RENTCAR_MAIL_API_URL || "";
window.RENTCAR_MAIL_API_SECRET = window.RENTCAR_MAIL_API_SECRET || "";