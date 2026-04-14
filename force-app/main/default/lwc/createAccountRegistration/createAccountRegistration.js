import { LightningElement, api } from "lwc";
import registerBuyerFromJson from "@salesforce/apex/BuyerSelfRegistrationService.registerBuyerFromJson";
import { resolveAbsoluteUrl, appendHiddenInput } from "c/utils";

const DEFAULT_GOOGLE_AUTH_URL = "/services/auth/sso/Google_Login";
const DEFAULT_MICROSOFT_AUTH_URL = "/services/auth/sso/Microsoft_Login";
const DEFAULT_LOGIN_ACTION_URL = "/AmericanBookCompany/login";
const DEFAULT_START_URL = "/myprofile";
const DEFAULT_SOCIAL_AUTH_SITE_URL =
  "https://americanbookcompany.my.site.com/AmericanBookCompanyvforcesite";

export default class CreateAccountRegistration extends LightningElement {
  @api googleAuthUrl = DEFAULT_GOOGLE_AUTH_URL;
  @api microsoftAuthUrl = DEFAULT_MICROSOFT_AUTH_URL;
  @api loginActionUrl = DEFAULT_LOGIN_ACTION_URL;
  @api defaultStartUrl = DEFAULT_START_URL;
  @api socialAuthSiteUrl = DEFAULT_SOCIAL_AUTH_SITE_URL;

  firstName = "";
  lastName = "";
  email = "";
  errorMessage = "";
  isSubmitting = false;
  get submitButtonLabel() {
    return this.isSubmitting ? "Creating Account\u2026" : "Create Account";
  }

  handleGoogleClick() {
    this.redirectToSocialAuth(this.googleAuthUrl);
  }

  handleMicrosoftClick() {
    this.redirectToSocialAuth(this.microsoftAuthUrl);
  }

  async handleFormSubmit(event) {
    event.preventDefault();
    if (this.isSubmitting) {
      return;
    }

    this.errorMessage = "";
    const nativeForm = event.target;
    const fd = new FormData(nativeForm);

    const formData = {
      firstName: (fd.get("firstName") || "").trim(),
      lastName: (fd.get("lastName") || "").trim(),
      email: (fd.get("email") || "").trim(),
      confirmEmail: (fd.get("confirmEmail") || "").trim(),
      organizationName: (fd.get("organizationName") || "").trim(),
      password: fd.get("password") || "",
      confirmPassword: fd.get("confirmPassword") || "",
      marketingConsent: fd.has("marketingConsent")
    };

    const validationError = this.validateFormData(formData);
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    this.isSubmitting = true;
    let registrationSucceeded = false;

    try {
      const result = await registerBuyerFromJson({
        reqJson: JSON.stringify(formData)
      });

      if (!result?.success) {
        throw new Error(
          result?.message ||
            "We could not create your account right now. Please try again."
        );
      }

      registrationSucceeded = true;
      this.submitLoginForm(
        formData.email,
        formData.password,
        result.redirectUrl || this.defaultStartUrl
      );
    } catch (error) {
      this.errorMessage = registrationSucceeded
        ? "Your account was created, but we could not sign you in automatically. Please use the login form."
        : error?.body?.message ||
          error?.message ||
          "We could not submit your registration right now. Please try again.";
    } finally {
      this.isSubmitting = false;
    }
  }

  validateFormData(data) {
    if (!data.firstName) {
      return "Please enter your first name.";
    }

    if (!data.lastName) {
      return "Please enter your last name.";
    }

    if (!data.email) {
      return "Please enter your email address.";
    }

    if (!this.isValidEmail(data.email)) {
      return "Please enter a valid email address.";
    }

    if (!data.confirmEmail) {
      return "Please confirm your email address.";
    }

    if (data.email.toLowerCase() !== data.confirmEmail.toLowerCase()) {
      return "Email and Confirm Email must match.";
    }

    if (!data.organizationName) {
      return "Please enter your organization name.";
    }

    if (!data.password) {
      return "Please enter a password.";
    }

    if (!this.isValidPassword(data.password)) {
      return "Please use a password that meets all listed requirements.";
    }

    if (!data.confirmPassword) {
      return "Please confirm your password.";
    }

    if (data.password !== data.confirmPassword) {
      return "Password and Confirm Password must match.";
    }

    return "";
  }

  isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  isValidPassword(value) {
    return (
      value.length >= 8 &&
      /[A-Z]/.test(value) &&
      /[a-z]/.test(value) &&
      /\d/.test(value) &&
      /[^A-Za-z0-9]/.test(value)
    );
  }

  submitLoginForm(email, password, startUrl) {
    const ownerDocument = this.template.host.ownerDocument;
    const form = ownerDocument.createElement("form");
    form.method = "POST";
    form.action = (this.socialAuthSiteUrl || DEFAULT_SOCIAL_AUTH_SITE_URL) + "/login";

    const resolvedUsername = email.trim().toLowerCase();
    appendHiddenInput(ownerDocument, form, "username", resolvedUsername);
    appendHiddenInput(ownerDocument, form, "un", resolvedUsername);
    appendHiddenInput(ownerDocument, form, "pw", password);
    appendHiddenInput(
      ownerDocument,
      form,
      "startURL",
      this.resolveRelativeUrl(startUrl, this.defaultStartUrl)
    );
    appendHiddenInput(ownerDocument, form, "loginType", "standard");
    appendHiddenInput(ownerDocument, form, "lt", "standard");
    appendHiddenInput(ownerDocument, form, "useSecure", "true");

    ownerDocument.body.appendChild(form);
    form.submit();
  }

  getResolvedLoginActionUrl() {
    return this.resolveRelativeUrl(
      this.loginActionUrl,
      DEFAULT_LOGIN_ACTION_URL
    );
  }

  resolveRelativeUrl(url, fallback) {
    if (!url) {
      return this.normalizeExperienceUrl(fallback);
    }

    return (
      this.normalizeExperienceUrl(url) ||
      this.normalizeExperienceUrl(fallback) ||
      fallback
    );
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
      const loginUrl = new URL(
        resolveAbsoluteUrl(this.loginActionUrl || DEFAULT_LOGIN_ACTION_URL)
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
    const decodedUrl = this.decodeUrl(this.socialAuthSiteUrl);
    if (!decodedUrl) {
      return "";
    }

    try {
      return new URL(decodedUrl, globalThis.location.origin).toString();
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
      authUrl.searchParams.set(
        "startURL",
        this.resolveRelativeUrl(this.defaultStartUrl, DEFAULT_START_URL)
      );
      return authUrl.toString();
    } catch {
      return resolvedUrl;
    }
  }

  redirectToSocialAuth(rawUrl) {
    const authUrl = this.buildSocialAuthUrl(rawUrl);
    if (!authUrl) {
      this.errorMessage =
        "Social sign-in is unavailable right now. Please try again later or use the form below.";
      return;
    }

    this.errorMessage = "";
    globalThis.location.assign(authUrl);
  }
}