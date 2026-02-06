const noticeEl = document.getElementById("checkout-notice");
const checkoutBtn = document.getElementById("checkout-btn");
const priceLabelEl = document.getElementById("price-label");
const priceBadgeEl = document.getElementById("price-badge");
const priceAmountEl = document.getElementById("price-amount");
const priceSubEl = document.getElementById("price-sub");
const priceMetaEl = document.getElementById("price-meta");

function showNotice(message, type = "success") {
  if (!noticeEl) return;
  noticeEl.textContent = message;
  noticeEl.className = `notice ${type}`;
  noticeEl.style.display = "block";
}

function formatPrice(amount, currency) {
  if (!amount || !currency) return "";
  try {
    return new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

async function ensureAuth() {
  const res = await fetch("/api/me");
  if (!res.ok) {
    const next = encodeURIComponent("/checkout.html" + window.location.search);
    window.location.href = `/login.html?next=${next}`;
    return false;
  }
  return true;
}

async function loadConfig() {
  const res = await fetch("/api/stripe/config");
  const data = await res.json();

  if (!data.enabled) {
    priceAmountEl.textContent = "Stripe ist aktuell nicht verfuegbar.";
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  if (priceLabelEl && data.priceLabel) priceLabelEl.textContent = data.priceLabel;

  if (priceBadgeEl && data.credits) {
    const label = data.credits === 1 ? "1 Song" : `${data.credits} Songs`;
    priceBadgeEl.textContent = label;
  }

  if (data.unitAmount && data.currency) {
    priceAmountEl.textContent = formatPrice(data.unitAmount, data.currency);
  } else {
    priceAmountEl.textContent = "Preis wird bei Stripe angezeigt";
  }

  if (priceSubEl) {
    priceSubEl.textContent = "Einmalige Zahlung";
  }

  if (priceMetaEl && data.credits) {
    priceMetaEl.textContent = `${data.credits} Songs werden nach Zahlung gutgeschrieben.`;
  }
}

async function startCheckout() {
  if (!checkoutBtn) return;
  checkoutBtn.disabled = true;
  checkoutBtn.textContent = "Weiter zu Stripe...";

  try {
    const res = await fetch("/api/stripe/create-checkout-session", { method: "POST" });
    const data = await res.json();
    if (!res.ok || !data.url) {
      showNotice(data.error || "Checkout konnte nicht gestartet werden.", "error");
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Mit Stripe bezahlen";
      return;
    }
    window.location.href = data.url;
  } catch {
    showNotice("Verbindungsfehler beim Starten der Zahlung.", "error");
    checkoutBtn.disabled = false;
    checkoutBtn.textContent = "Mit Stripe bezahlen";
  }
}

(async function init() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("success")) {
    showNotice("Zahlung erfolgreich! Credits werden in Kuerze gutgeschrieben.", "success");
  }
  if (params.get("canceled")) {
    showNotice("Zahlung abgebrochen. Du kannst es jederzeit erneut versuchen.", "error");
  }

  const ok = await ensureAuth();
  if (!ok) return;

  await loadConfig();
})();

if (checkoutBtn) {
  checkoutBtn.addEventListener("click", startCheckout);
}
