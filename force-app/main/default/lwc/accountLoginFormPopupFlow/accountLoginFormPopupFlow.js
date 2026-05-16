import { LightningElement, api } from "lwc";
import isGuest from "@salesforce/user/isGuest";
import { resolveAbsoluteUrl, appendHiddenInput } from "c/utils";

const DEFAULT_GOOGLE_AUTH_URL =
  "/services/auth/sso/Google_Login";
const DEFAULT_MICROSOFT_AUTH_URL =
  "/services/auth/sso/Microsoft_Login";
const DEFAULT_SOCIAL_AUTH_SITE_URL =
  "https://americanbookcompany.my.site.com/AmericanBookCompanyvforcesite";
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
  @api socialAuthSiteUrl = DEFAULT_SOCIAL_AUTH_SITE_URL;

  username = "";
  password = "";
  // rememberMe = false;
  errorMessage = "";
  isSubmitting = false;
  isSocialRedirecting = false;
  hasClientHydrated = false;

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

  get buttonLabel() {
    return this.isSubmitting ? "Signing In..." : this.loginButtonLabel;
  }

  get hasSocialOptions() {
    return Boolean(this.googleAuthUrl || this.microsoftAuthUrl);
  }

  get socialButtonDisabled() {
    return this.isSubmitting || this.isSocialRedirecting;
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
    this.redirectToSocialAuth(this.googleAuthUrl);
  }

  handleMicrosoftClick() {
    this.redirectToSocialAuth(this.microsoftAuthUrl);
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
      form.action = (this.socialAuthSiteUrl || DEFAULT_SOCIAL_AUTH_SITE_URL) + "/login";

      const resolvedUsername = this.username.trim();
      appendHiddenInput(ownerDocument, form, "username", resolvedUsername);
      appendHiddenInput(ownerDocument, form, "un", resolvedUsername);
      appendHiddenInput(ownerDocument, form, "pw", this.password);
      appendHiddenInput(ownerDocument, form, "startURL", this.getResolvedStartUrl());
      appendHiddenInput(ownerDocument, form, "loginType", "standard");
      appendHiddenInput(ownerDocument, form, "lt", "standard");
      appendHiddenInput(ownerDocument, form, "useSecure", "true");
      // appendHiddenInput(ownerDocument, form, "rememberUn", this.rememberMe ? "true" : "false");


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
      this.normalizeExperienceUrl(startUrl) ||
      this.normalizeExperienceUrl(this.defaultStartUrl) ||
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

  get resolvedForgotPasswordUrl() {
    return (
      this.normalizeExperienceUrl(this.forgotPasswordUrl) ||
      this.normalizeExperienceUrl("/ForgotPassword") ||
      "/ForgotPassword"
    );
  }

  get resolvedSelfRegisterUrl() {
    return (
      this.normalizeExperienceUrl(this.selfRegisterUrl) ||
      this.normalizeExperienceUrl("/create-account") ||
      "/create-account"
    );
  }

  redirectToResolvedStartUrl() {
    globalThis.location.assign(this.getResolvedStartUrl());
  }

  normalizeExperienceUrl(url) {
    const decodedUrl = this.decodeUrl(url);
    if (!decodedUrl) {
      return "";
    }

    if (decodedUrl.startsWith("/")) {
      return this.applyExperienceBasePath(decodedUrl);
    }

    try {
      const parsed = new URL(decodedUrl, globalThis.location.origin);
      return parsed.origin === globalThis.location.origin
        ? this.applyExperienceBasePath(
          `${parsed.pathname}${parsed.search}${parsed.hash}`
        )
        : "";
    } catch {
      return "";
    }
  }

  decodeUrl(value) {
    if (!value) {
      return "";
    }

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  applyExperienceBasePath(path) {
    const experienceBasePath = this.getExperienceBasePath();
    if (
      !experienceBasePath ||
      path === experienceBasePath ||
      path.startsWith(`${experienceBasePath}/`)
    ) {
      return path;
    }

    return `${experienceBasePath}${path}`;
  }

  getExperienceBasePath() {
    try {
      const resolvedLoginUrl =
        resolveAbsoluteUrl(this.loginActionUrl || "/AmericanBookCompany/login") ||
        this.loginActionUrl ||
        "/AmericanBookCompany/login";
      const loginUrl = new URL(
        resolvedLoginUrl,
        globalThis.location.origin
      );
      const loginPath = loginUrl.pathname || "";
      return loginPath.endsWith("/login")
        ? loginPath.slice(0, -"/login".length)
        : "";
    } catch {
      return "";
    }
  }

  getResolvedSocialSiteUrl() {
    if (!this.socialAuthSiteUrl) {
      return "";
    }

    try {
      return new URL(this.socialAuthSiteUrl, globalThis.location.origin).toString();
    } catch {
      return "";
    }
  }

  buildSocialAuthUrl(rawUrl) {
    const resolvedUrl = resolveAbsoluteUrl(rawUrl);
    if (!resolvedUrl) {
      return "";
    }

    try {
      const authUrl = new URL(resolvedUrl, globalThis.location.origin);
      const socialSiteUrl = this.getResolvedSocialSiteUrl();
      if (socialSiteUrl && !authUrl.searchParams.has("site")) {
        authUrl.searchParams.set("site", socialSiteUrl);
      }
      authUrl.searchParams.set("startURL", this.getResolvedStartUrl());
      return authUrl.toString();
    } catch {
      return resolvedUrl;
    }
  }

  redirectToSocialAuth(rawUrl) {
    if (this.socialButtonDisabled) {
      return;
    }

    const authUrl = this.buildSocialAuthUrl(rawUrl);
    if (!authUrl) {
      this.errorMessage =
        "Social sign-in is unavailable right now. Please try again later or use your email and password.";
      return;
    }

    this.errorMessage = "";
    this.isSocialRedirecting = true;
    globalThis.location.assign(authUrl);
  }

  // handleRememberMeChange(event) {
  //   this.rememberMe = event.target.checked;
  // }

}