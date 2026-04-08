import { createElement } from "lwc";
import AccountLoginFormPopupFlow from "c/accountLoginFormPopupFlow";
import { resolveAbsoluteUrl } from "c/utils";

const flushPromises = () => Promise.resolve();

jest.mock("@salesforce/user/isGuest", () => ({ default: true }), {
  virtual: true
});

jest.mock(
  "c/utils",
  () => ({
    stopAuthPopupMonitor: jest.fn(),
    resolveAbsoluteUrl: jest.fn((value) => value || ""),
    normalizeInternalUrl: jest.fn((value) => value || ""),
    appendHiddenInput: jest.fn()
  }),
  { virtual: true }
);

describe("c-account-login-form-popup-flow", () => {
  beforeEach(() => {
    resolveAbsoluteUrl.mockClear();
    resolveAbsoluteUrl.mockImplementation((value) => value || "");

    delete globalThis.location;
    globalThis.location = {
      assign: jest.fn(),
      origin: "https://americanbookcompany.my.site.com",
      href: "https://americanbookcompany.my.site.com/AmericanBookCompany/login?startURL=%2FAmericanBookCompany%2Fmyprofile",
      pathname: "/AmericanBookCompany/login",
      search: "?startURL=%2FAmericanBookCompany%2Fmyprofile",
      hash: ""
    };
  });

  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
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
