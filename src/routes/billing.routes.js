import { Router } from "express";
import Stripe from "stripe";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  addSongCredits,
  findUserById,
  getStripeCustomerId,
  setStripeCustomerId,
  isStripeEventProcessed,
  markStripeEventProcessed,
} from "../db.js";
import { broadcastToUser } from "../sse.js";

const router = Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" }) : null;

const PRICE_ID = process.env.STRIPE_PRICE_ID;
const CREDITS_PER_PURCHASE = Number.parseInt(process.env.STRIPE_CREDITS_PER_PURCHASE || "3", 10);
const PRICE_LABEL = process.env.STRIPE_PRICE_LABEL || `${CREDITS_PER_PURCHASE} Song-Credits`;
const CURRENCY = process.env.STRIPE_CURRENCY || "eur";
const UNIT_AMOUNT = Number.parseInt(process.env.STRIPE_UNIT_AMOUNT || "0", 10);

function getBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
}

router.get("/api/stripe/config", async (req, res) => {
  const enabled = !!stripe && !!PRICE_ID;
  const credits = Number.isFinite(CREDITS_PER_PURCHASE) ? CREDITS_PER_PURCHASE : 0;
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY || "";

  if (!enabled) {
    return res.json({
      enabled,
      priceLabel: PRICE_LABEL,
      credits,
      currency: CURRENCY,
      unitAmount: Number.isFinite(UNIT_AMOUNT) ? UNIT_AMOUNT : 0,
      publishableKey,
    });
  }

  try {
    const price = await stripe.prices.retrieve(PRICE_ID);
    const currency = price?.currency || CURRENCY;
    const unitAmount = price?.unit_amount ?? UNIT_AMOUNT;
    const productName = typeof price?.product === "string" ? null : price?.product?.name;

    return res.json({
      enabled,
      priceLabel: productName || PRICE_LABEL,
      credits,
      currency,
      unitAmount: Number.isFinite(unitAmount) ? unitAmount : 0,
      publishableKey,
    });
  } catch (err) {
    console.error("Stripe price fetch error:", err?.message || err);
    return res.json({
      enabled,
      priceLabel: PRICE_LABEL,
      credits,
      currency: CURRENCY,
      unitAmount: Number.isFinite(UNIT_AMOUNT) ? UNIT_AMOUNT : 0,
      publishableKey,
    });
  }
});

router.post("/api/stripe/create-checkout-session", requireAuth, async (req, res) => {
  if (!stripe || !PRICE_ID) {
    return res.status(503).json({ error: "Stripe ist nicht konfiguriert" });
  }

  try {
    const user = findUserById(req.session.userId);
    if (!user) return res.status(404).json({ error: "Nutzer nicht gefunden" });

    let customerId = getStripeCustomerId(user.id);
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.display_name || user.email.split("@")[0],
      });
      customerId = customer.id;
      setStripeCustomerId(user.id, customerId);
    }

    const baseUrl = getBaseUrl(req);
    const successUrl = process.env.STRIPE_SUCCESS_URL || `${baseUrl}/checkout.html?success=1`;
    const cancelUrl = process.env.STRIPE_CANCEL_URL || `${baseUrl}/checkout.html?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      client_reference_id: String(user.id),
      metadata: {
        userId: String(user.id),
        credits: String(CREDITS_PER_PURCHASE || 0),
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    res.status(500).json({ error: "Checkout konnte nicht gestartet werden" });
  }
});

router.post("/api/stripe/webhook", async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("Stripe webhook not configured");
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || !req.rawBody) {
    return res.status(400).send("Missing signature");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (isStripeEventProcessed(event.id)) {
    return res.json({ received: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        const userId = Number.parseInt(session.metadata?.userId, 10);
        const credits = Number.parseInt(session.metadata?.credits, 10);
        if (Number.isFinite(userId) && userId > 0 && Number.isFinite(credits) && credits > 0) {
          const total = addSongCredits(userId, credits);
          broadcastToUser(userId, "credits_update", { songCredits: total });
        }
      }
    }
  } catch (err) {
    console.error("Stripe webhook handling error:", err);
    return res.status(500).send("Webhook handler failed");
  } finally {
    markStripeEventProcessed(event.id);
  }

  res.json({ received: true });
});

export default router;
