import { LightningElement, api } from "lwc";
import getHostedPaymentToken from "@salesforce/apex/AuthorizeNetAcceptHostedTokenService.getHostedPaymentToken";
import {
  applyStorefrontRequestParams
} from "c/utils";

const API_VERSION = "v66.0";

export default class AuthorizeNetCheckoutButton extends LightningElement {
  @api buttonLabel = "Checkout";
  @api webstoreId = "0ZEam000004dJDNGA2";
  @api cartIdOrActive = "current";
  @api paymentFormAction = "https://accept.authorize.net/payment/payment";
  @api transactionType = "authCaptureTransaction";
  @api returnUrl;
  @api cancelUrl;
  @api currencyIsoCode = "USD";
  @api showReceipt = false;

  isLoading = false;
  errorMessage = null;
  currentCartId;
  currentReferenceId;

  async handleCheckout() {
    if (this.isLoading) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    try {
      const webstoreId = this.webstoreId;
      const cartData = await this.fetchCartDetails(
        webstoreId,
        this.cartIdOrActive
      );
      this.currentCartId = cartData?.cartId || null;
      this.currentReferenceId = this.currentCartId || null;
      const amount = this.extractCartTotal(cartData);
      const currencyCode =
        cartData?.currencyIsoCode || this.currencyIsoCode || "USD";
      const siteHomeUrl = this.getSiteHomeUrl();

      if (!amount || Number(amount) <= 0) {
        throw new Error(
          "Could not determine cart total amount from checkout API."
        );
      }

      // If an active checkout already exists for this cart, delete it before creating
      // a new one. This prevents a stale checkout from permanently blocking the user.
      await this.clearActiveCheckoutIfPresent(webstoreId);

      const tokenRequest = {
        amount: Number(amount),
        currencyIsoCode: currencyCode,
        returnUrl: this.returnUrl || siteHomeUrl,
        cancelUrl: this.cancelUrl || siteHomeUrl,
        showReceipt: this.showReceipt,
        transactionType: this.transactionType,
        referenceId: this.currentReferenceId
      };

      const tokenResponse = await getHostedPaymentToken({ req: tokenRequest });

      if (!tokenResponse?.success || !tokenResponse?.token) {
        throw new Error(
          tokenResponse?.message || "Authorize.Net token generation failed."
        );
      }

      // DO NOT log the token — it is a sensitive payment credential.
      const checkoutStartResponse = await this.startCheckout(
        webstoreId,
        this.currentCartId
      );
      if (!checkoutStartResponse) {
        throw new Error("Failed to start checkout session.");
      }

      this.redirectToHostedPaymentForm(tokenResponse.token);
    } catch (error) {
      this.dispatchError(error);
    } finally {
      this.isLoading = false;
    }
  }

  async fetchCartDetails(webstoreId, cartIdOrActive) {
    const response = await fetch(
      this.buildStorefrontApiUrl(
        `/commerce/webstores/${webstoreId}/carts/${cartIdOrActive}`
      ),
      {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json"
        }
      }
    );

    return this.parseResponse(response, "Failed to fetch cart details.");
  }

  /**
   * Clears a stale active checkout if one exists so a new checkout can be started.
   * Silently swallows errors — a missing or already-cleared checkout is not a failure.
   */
  async clearActiveCheckoutIfPresent(webstoreId) {
    try {
      const response = await fetch(
        this.buildStorefrontApiUrl(
          `/commerce/webstores/${webstoreId}/checkouts/active`
        ),
        {
          method: "GET",
          credentials: "include",
          headers: { Accept: "application/json" }
        }
      );
      if (!response.ok) {
        // No active checkout exists — nothing to clear.
        return;
      }
      // An active checkout exists; delete it so we can create a fresh one.
      await fetch(
        this.buildStorefrontApiUrl(
          `/commerce/webstores/${webstoreId}/checkouts/active`
        ),
        {
          method: "DELETE",
          credentials: "include",
          headers: { Accept: "application/json" }
        }
      );
    } catch {
      // Non-fatal — proceed even if the pre-clear fails.
    }
  }

  async startCheckout(webstoreId, cartId) {
    const response = await fetch(
      this.buildStorefrontApiUrl(
        `/commerce/webstores/${webstoreId}/checkouts`
      ),
      {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cartId: cartId || "active"
        })
      }
    );

    return this.parseResponse(response, "Failed to start checkout.");
  }

  buildStorefrontApiUrl(path) {
    const params = applyStorefrontRequestParams(new URLSearchParams());
    const suffix = params.toString();

    return `/AmericanBookCompany/webruntime/api/services/data/${API_VERSION}${path}${
      suffix ? `?${suffix}` : ""
    }`;
  }

  async parseResponse(response, defaultMessage) {
    const rawText = await response.text();
    let parsed;

    try {
      parsed = rawText ? JSON.parse(rawText) : {};
    } catch {
      throw new Error(defaultMessage);
    }

    if (!response.ok) {
      const errorMsg =
        parsed?.message ||
        parsed?.error_description ||
        parsed?.[0]?.message ||
        `${defaultMessage} HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return parsed;
  }

  extractCartTotal(cartData) {
    const candidates = [
      cartData?.totalAmount,
      cartData?.grandTotalAmount,
      cartData?.amount,
      cartData?.cartSummary?.totalAmount,
      cartData?.cartSummary?.grandTotalAmount,
      cartData?.summary?.totalAmount,
      cartData?.summary?.grandTotalAmount
    ];

    for (const value of candidates) {
      const numeric = Number(value);
      if (!Number.isNaN(numeric) && numeric > 0) {
        return numeric;
      }
    }

    return null;
  }

  redirectToHostedPaymentForm(token) {
    if (!token) {
      throw new Error("Authorize.Net token is missing.");
    }

    const form = document.createElement("form");
    form.method = "POST";
    form.action = this.getPaymentFormAction();
    form.target = "_top";
    form.hidden = true;

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "token";
    input.value = token;

    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
  }

  getPaymentFormAction() {
    if (!this.paymentFormAction) {
      throw new Error("Authorize.Net payment form URL is not configured.");
    }

    const configured = this.paymentFormAction.trim();
    if (configured.endsWith("/payment/payment")) {
      return configured;
    }
    if (
      configured === "https://test.authorize.net" ||
      configured === "https://accept.authorize.net"
    ) {
      return `${configured}/payment/payment`;
    }

    return configured;
  }

  getSiteHomeUrl() {
    const origin = globalThis.location.origin;
    const pathParts = globalThis.location.pathname
      .split("/")
      .filter((part) => !!part);
    if (pathParts.length === 0) {
      return `${origin}/`;
    }
    return `${origin}/${pathParts[0]}/`;
  }

  dispatchError(error) {
    const message =
      error?.body?.message ||
      error?.message ||
      "Checkout initialization failed.";
    this.errorMessage = message;
    this.dispatchEvent(
      new CustomEvent("checkouterror", {
        detail: { message },
        bubbles: true,
        composed: true
      })
    );
  }
}