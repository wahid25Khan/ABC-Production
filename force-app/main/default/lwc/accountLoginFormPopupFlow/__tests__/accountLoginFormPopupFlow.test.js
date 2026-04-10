import { createElement } from "lwc";
import AccountLoginFormPopupFlow from "c/accountLoginFormPopupFlow";
import { resolveAbsoluteUrl } from "c/utils";

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

jest.mock("@salesforce/user/isGuest", () => ({ default: true }), {
  virtual: true
});

jest.mock(
  "c/utils",
  () => ({
    stopAuthPopupMonitor: jest.fn(),
    resolveAbsoluteUrl: jest.fn((value) => value || ""),
    normalizeInternalUrl: jest.fn((value = "") => {
      const nextValue = value;
      if (!nextValue) {
        return "";
      }

      if (nextValue.startsWith("/AmericanBookCompany")) {
        return nextValue;
      }

      if (nextValue.startsWith("/")) {
        return `/AmericanBookCompany${nextValue}`;
      }

      return nextValue;
    }),
    appendHiddenInput: jest.fn((ownerDocument, form, name, value) => {
      const input = ownerDocument.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    })
  }),
  { virtual: true }
);

describe("c-account-login-form-popup-flow", () => {
  let originalCreateElement;
  let createdForm;

  beforeEach(() => {
    resolveAbsoluteUrl.mockClear();
    resolveAbsoluteUrl.mockImplementation((value) => value || "");
    createdForm = null;
    originalCreateElement = document.createElement.bind(document);

    delete globalThis.location;
    globalThis.location = {
      assign: jest.fn(),
      origin: "https://americanbookcompany.my.site.com",
      href: "https://americanbookcompany.my.site.com/AmericanBookCompany/login?startURL=%2FAmericanBookCompany%2Fmyprofile",
      pathname: "/AmericanBookCompany/login",
      search: "?startURL=%2FAmericanBookCompany%2Fmyprofile",
      hash: ""
    };
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn()
      }
    });

    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "form") {
        element.submit = jest.fn();
        createdForm = element;
      }
      return element;
    });
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
    jest.restoreAllMocks();
  });

  it("posts to VForce login endpoint with pw and un fields", async () => {
    const element = createElement("c-account-login-form-popup-flow", {
      is: AccountLoginFormPopupFlow
    });
    document.body.appendChild(element);

    const usernameInput = element.shadowRoot.querySelector(
      'input[autocomplete="username"]'
    );
    const passwordInput = element.shadowRoot.querySelector(
      'input[autocomplete="current-password"]'
    );

    usernameInput.value = "buyer@example.com";
    usernameInput.dispatchEvent(new CustomEvent("input"));
    passwordInput.value = "Password1!";
    passwordInput.dispatchEvent(new CustomEvent("input"));

    element.shadowRoot.querySelector(".login-submit").click();
    await flushPromises();

    expect(createdForm).not.toBeNull();
    expect(createdForm.method).toBe("post");
    expect(createdForm.action).toContain(
      "/AmericanBookCompanyvforcesite/login"
    );
    expect(createdForm.submit).toHaveBeenCalledTimes(1);

    const submittedFields = Array.from(
      createdForm.querySelectorAll("input")
    ).reduce(
      (accumulator, input) => ({
        ...accumulator,
        [input.name]: input.value
      }),
      {}
    );

    expect(submittedFields.username).toBe("buyer@example.com");
    expect(submittedFields.un).toBe("buyer@example.com");
    expect(submittedFields.pw).toBe("Password1!");
    expect(submittedFields.loginType).toBe("standard");
  });

  it("normalizes forgot-password and create-account links to the Experience base path", async () => {
    const element = createElement("c-account-login-form-popup-flow", {
      is: AccountLoginFormPopupFlow
    });
    document.body.appendChild(element);
    await flushPromises();

    const forgotPasswordLink = element.shadowRoot.querySelector(
      ".login-password-row a"
    );
    const createAccountLink =
      element.shadowRoot.querySelector(".login-links-row a");

    expect(forgotPasswordLink.getAttribute("href")).toBe(
      "/AmericanBookCompany/ForgotPassword"
    );
    expect(createAccountLink.getAttribute("href")).toBe(
      "/AmericanBookCompany/create-account"
    );
  });

  it("redirects Google sign-in to the resolved auth URL", () => {
    const element = createElement("c-account-login-form-popup-flow", {
      is: AccountLoginFormPopupFlow
    });
    document.body.appendChild(element);

    element.shadowRoot.querySelector(".social-button").click();

    expect(resolveAbsoluteUrl).toHaveBeenCalledWith(
      expect.stringContaining("/services/auth/sso/Google_Login")
    );
    expect(globalThis.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("/services/auth/sso/Google_Login")
    );
    expect(globalThis.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("startURL=%2FAmericanBookCompany%2Fmyprofile")
    );
  });

  it("redirects Microsoft sign-in to the resolved auth URL", () => {
    const element = createElement("c-account-login-form-popup-flow", {
      is: AccountLoginFormPopupFlow
    });
    document.body.appendChild(element);

    const buttons = element.shadowRoot.querySelectorAll(".social-button");
    buttons[1].click();

    expect(resolveAbsoluteUrl).toHaveBeenCalledWith(
      expect.stringContaining("/services/auth/sso/Microsoft_Login")
    );
    expect(globalThis.location.assign).toHaveBeenCalledWith(
      expect.stringContaining("/services/auth/sso/Microsoft_Login")
    );
  });

  it("shows an error when social sign-in URL resolution fails", async () => {
    resolveAbsoluteUrl.mockReturnValue("");

    const element = createElement("c-account-login-form-popup-flow", {
      is: AccountLoginFormPopupFlow
    });
    document.body.appendChild(element);

    element.shadowRoot.querySelector(".social-button").click();
    await flushPromises();

    expect(globalThis.location.assign).not.toHaveBeenCalled();
    expect(
      element.shadowRoot.querySelector(".login-alert").textContent
    ).toContain("Social sign-in is unavailable right now.");
  });
});
