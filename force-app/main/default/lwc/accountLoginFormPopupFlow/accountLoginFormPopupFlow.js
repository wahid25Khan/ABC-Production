import { LightningElement, api } from "lwc";
import isGuest from "@salesforce/user/isGuest";
import {
  openAuthPopup,
  stopAuthPopupMonitor,
  resolveAbsoluteUrl,
  normalizeInternalUrl,
  appendHiddenInput
} from "c/utils";

const DEFAULT_GOOGLE_AUTH_URL =
  "https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile";
const DEFAULT_MICROSOFT_AUTH_URL =
  "https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile";
const SOCIAL_SIGN_IN_ERROR_MESSAGE =
  "Social sign-in could not be completed. Please try again. If this is your first time, contact support if the issue continues.";

export default class AccountLoginFormPopupFlow extends LightningElement {
  @api forgotPasswordLabel = "Forgot your password?";
  @api forgotPasswordUrl = "/ForgotPassword";
  @api googleAuthUrl = DEFAULT_GOOGLE_AUTH_URL;
  @api loginButtonLabel = "Sign In";
  @api loginActionUrl = "/AmericanBookCompany/login";
  @api microsoftAuthUrl = DEFAULT_MICROSOFT_AUTH_URL;
  @api passwordLabel = "Password";
  @api selfRegisterLabel = "Not a member?";
  @api selfRegisterUrl = "/create-account";
  @api usernameLabel = "Username";
  @api defaultStartUrl = "/myprofile";

  username = "";
  password = "";
  errorMessage = "";
  isSubmitting = false;
  hasClientHydrated = false;
  authPopup = null;
  authPopupMonitorId = null;

  connectedCallback() {
    this.hydrateErrorMessageFromUrl();

    if (!isGuest) {
      this.redirectToResolvedStartUrl();
    }
  }

  renderedCallback() {
    if (this.hasClientHydrated) {
      return;
    }

    this.hasClientHydrated = true;

    if (!this.hasLoginErrorParam()) {
      this.errorMessage = "";
    }
  }

  disconnectedCallback() {
    stopAuthPopupMonitor(this);
  }

  get buttonLabel() {
    return this.isSubmitting ? "Signing In..." : this.loginButtonLabel;
  }

  get hasSocialOptions() {
    return Boolean(this.googleAuthUrl || this.microsoftAuthUrl);
  }

  handleUsernameChange(event) {
    this.username = event.target.value;
    this.errorMessage = "";
  }

  handlePasswordChange(event) {
    this.password = event.target.value;
    this.errorMessage = "";
  }

  handlePasswordKeydown(event) {
    if (event.key === "Enter") {
      this.handleLogin();
    }
  }

  handleGoogleClick() {
    this.doOpenAuthPopup(this.googleAuthUrl, "google-sign-in");
  }

  handleMicrosoftClick() {
    this.doOpenAuthPopup(this.microsoftAuthUrl, "microsoft-sign-in");
  }

  handleLogin() {
    if (!this.username.trim()) {
      this.errorMessage = "Please enter your email address.";
      return;
    }

    if (!this.password) {
      this.errorMessage = "Please enter your password.";
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = "";

    try {
      const ownerDocument = this.template.host.ownerDocument;
      const form = ownerDocument.createElement("form");
      form.method = "POST";
      form.action = this.getResolvedLoginActionUrl();

      appendHiddenInput(ownerDocument, form, "username", this.username.trim());
      appendHiddenInput(ownerDocument, form, "password", this.password);
      appendHiddenInput(
        ownerDocument,
        form,
        "startURL",
        this.getLoginPostStartUrl()
      );

      ownerDocument.body.appendChild(form);
      form.submit();
    } catch {
      this.errorMessage = "Unable to sign in right now. Please try again.";
      this.isSubmitting = false;
    }
  }

  hydrateErrorMessageFromUrl() {
    if (this.hasLoginErrorParam()) {
      const params = new URLSearchParams(globalThis.location.search);
      const startUrl = params.get("startURL") || params.get("startUrl") || "";
      this.errorMessage = startUrl.includes("OauthFlowCallbackPage")
        ? SOCIAL_SIGN_IN_ERROR_MESSAGE
        : "Unable to sign in. Please check your credentials and try again.";
    }
  }

  hasLoginErrorParam() {
    const params = new URLSearchParams(globalThis.location.search);
    return params.has("error") || params.has("loginError") || params.has("ec");
  }

  getResolvedStartUrl() {
    const params = new URLSearchParams(globalThis.location.search);
    const startUrl =
      params.get("startURL") || params.get("startUrl") || this.defaultStartUrl;

    return (
      normalizeInternalUrl(startUrl) ||
      normalizeInternalUrl(this.defaultStartUrl) ||
      "/"
    );
  }

  getLoginPostStartUrl() {
    const resolved = this.getResolvedStartUrl();
    const currentPath = String(globalThis.location?.pathname || "").trim();
    const segments = currentPath.split("/").filter(Boolean);
    const basePath = segments.length ? `/${segments[0]}` : "";

    if (basePath && resolved.startsWith(`${basePath}/`)) {
      return resolved.slice(basePath.length);
    }
    if (basePath && resolved === basePath) {
      return "/";
    }
    return resolved;
  }

  getResolvedLoginActionUrl() {
    if (!this.loginActionUrl) {
      return "/";
    }

    if (this.loginActionUrl.startsWith("/")) {
      return this.loginActionUrl;
    }

    try {
      const parsed = new URL(this.loginActionUrl, globalThis.location.origin);
      return parsed.origin === globalThis.location.origin
        ? `${parsed.pathname}${parsed.search}${parsed.hash}`
        : "/";
    } catch {
      return "/";
    }
  }

  redirectToResolvedStartUrl() {
    globalThis.location.assign(this.getResolvedStartUrl());
  }

  doOpenAuthPopup(url, popupName) {
    openAuthPopup(this, url, popupName, {
      buildAuthUrl: (rawUrl) => {
        const resolvedUrl = resolveAbsoluteUrl(rawUrl);
        if (!resolvedUrl) return "";
        try {
          const authUrl = new URL(resolvedUrl);
          authUrl.searchParams.set("startURL", this.getResolvedStartUrl());
          return authUrl.toString();
        } catch {
          return resolvedUrl;
        }
      },
      onCompletion: (nextUrl) => {
        globalThis.location.assign(nextUrl);
      }
    });
  }
}
