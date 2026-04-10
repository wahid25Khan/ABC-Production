import { createElement } from "lwc";
import CreateAccountRegistration from "c/createAccountRegistration";
import registerBuyerFromJson from "@salesforce/apex/BuyerSelfRegistrationService.registerBuyerFromJson";
import { openAuthPopup, isPopupLoginErrorUrl } from "c/utils";

jest.mock(
  "c/utils",
  () => ({
    openAuthPopup: jest.fn((host, url, popupName, { buildAuthUrl }) => {
      const resolvedUrl = buildAuthUrl(url);
      globalThis.open?.(resolvedUrl, popupName, "popup=yes");
    }),
    stopAuthPopupMonitor: jest.fn(),
    resolveAbsoluteUrl: jest.fn((value) =>
      new URL(value || "", globalThis.location.origin).toString()
    ),
    appendHiddenInput: jest.fn((ownerDocument, form, name, value) => {
      const input = ownerDocument.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    }),
    isPopupLoginErrorUrl: jest.fn(() => false)
  }),
  { virtual: true }
);

jest.mock(
  "@salesforce/apex/BuyerSelfRegistrationService.registerBuyerFromJson",
  () => ({ default: jest.fn() }),
  { virtual: true }
);

const TEST_PASSWORD = "Password1!"; // NOSONAR -- test-only password fixture
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

function populateField(element, fieldName, value) {
  const input = element.shadowRoot.querySelector(`[name="${fieldName}"]`);
  input.value = value;
}

function submitForm(element) {
  const form = element.shadowRoot.querySelector("form");
  form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

describe("c-create-account-registration", () => {
  let originalCreateElement;
  let createdForm;
  let createdInputs;

  beforeEach(() => {
    registerBuyerFromJson.mockReset();
    createdForm = null;
    createdInputs = [];
    originalCreateElement = document.createElement.bind(document);
    globalThis.open = jest.fn(() => ({ focus: jest.fn() }));
    delete globalThis.location;
    globalThis.location = {
      assign: jest.fn(),
      origin: "https://americanbookcompany.my.site.com",
      pathname: "/AmericanBookCompany/create-account"
    };
    globalThis.screenLeft = 0;
    globalThis.screenTop = 0;
    globalThis.outerWidth = 1440;
    globalThis.outerHeight = 900;

    jest.spyOn(document, "createElement").mockImplementation((tagName) => {
      const element = originalCreateElement(tagName);
      if (tagName === "form") {
        element.submit = jest.fn();
        createdForm = element;
      }
      if (tagName === "input") {
        createdInputs.push(element);
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

  it("requires organization name before submitting", async () => {
    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    populateField(element, "firstName", "Pat");
    populateField(element, "lastName", "Buyer");
    populateField(element, "email", "pat@example.com");
    populateField(element, "confirmEmail", "pat@example.com");
    populateField(element, "password", TEST_PASSWORD);
    populateField(element, "confirmPassword", TEST_PASSWORD);

    submitForm(element);
    await flushPromises();

    expect(registerBuyerFromJson).not.toHaveBeenCalled();
    expect(
      element.shadowRoot.querySelector(".register-alert").textContent
    ).toContain("Please enter your organization name.");
  });

  it("submits the registration and posts credentials to login on success", async () => {
    registerBuyerFromJson.mockResolvedValue({
      success: true,
      redirectUrl: "/myprofile"
    });

    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    populateField(element, "firstName", "Pat");
    populateField(element, "lastName", "Buyer");
    populateField(element, "email", "pat@example.com");
    populateField(element, "confirmEmail", "pat@example.com");
    populateField(element, "organizationName", "Springfield Middle School");
    populateField(element, "password", TEST_PASSWORD);
    populateField(element, "confirmPassword", TEST_PASSWORD);

    submitForm(element);
    await flushPromises();

    expect(registerBuyerFromJson).toHaveBeenCalledTimes(1);
    const callArg = registerBuyerFromJson.mock.calls[0][0];
    const parsed = JSON.parse(callArg.reqJson);
    expect(parsed).toEqual({
      firstName: "Pat",
      lastName: "Buyer",
      email: "pat@example.com",
      confirmEmail: "pat@example.com",
      organizationName: "Springfield Middle School",
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      marketingConsent: false
    });
    expect(createdForm).not.toBeNull();
    expect(createdForm.action).toContain("/AmericanBookCompany/login");
    expect(createdForm.submit).toHaveBeenCalled();

    const usernameInput = createdInputs.find(
      (input) => input.name === "username"
    );
    const passwordInput = createdInputs.find(
      (input) => input.name === "password"
    );
    const startUrlInput = createdInputs.find(
      (input) => input.name === "startURL"
    );

    expect(usernameInput.value).toBe("pat@example.com");
    expect(passwordInput.value).toBe(TEST_PASSWORD);
    expect(startUrlInput.value).toBe("/AmericanBookCompany/myprofile");
  });

  it("submits successfully when the browser filled inputs without firing input events", async () => {
    registerBuyerFromJson.mockResolvedValue({
      success: true,
      redirectUrl: "/myprofile"
    });

    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    populateField(element, "firstName", "Pat");
    populateField(element, "lastName", "Buyer");
    populateField(element, "email", "pat@example.com");
    populateField(element, "confirmEmail", "pat@example.com");
    populateField(element, "organizationName", "Springfield Middle School");
    populateField(element, "password", TEST_PASSWORD);
    populateField(element, "confirmPassword", TEST_PASSWORD);

    submitForm(element);
    await flushPromises();

    expect(registerBuyerFromJson).toHaveBeenCalledTimes(1);
    const callArg = registerBuyerFromJson.mock.calls[0][0];
    const parsed = JSON.parse(callArg.reqJson);
    expect(parsed).toEqual({
      firstName: "Pat",
      lastName: "Buyer",
      email: "pat@example.com",
      confirmEmail: "pat@example.com",
      organizationName: "Springfield Middle School",
      password: TEST_PASSWORD,
      confirmPassword: TEST_PASSWORD,
      marketingConsent: false
    });
  });

  it("opens Google sign-in in a popup window", () => {
    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    element.shadowRoot.querySelector(".social-button").click();

    expect(globalThis.open).toHaveBeenCalledWith(
      "https://americanbookcompany.my.site.com/services/auth/sso/Google_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile",
      "google-sign-in",
      expect.stringContaining("popup=yes")
    );
    expect(globalThis.location.assign).not.toHaveBeenCalled();
  });

  it("opens Microsoft sign-in in a popup window", () => {
    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    const buttons = element.shadowRoot.querySelectorAll(".social-button");
    buttons[1].click();

    expect(globalThis.open).toHaveBeenCalledWith(
      "https://americanbookcompany.my.site.com/services/auth/sso/Microsoft_Login?site=https%3A%2F%2Famericanbookcompany.my.site.com%2FAmericanBookCompanyvforcesite&startURL=%2FAmericanBookCompany%2Fmyprofile",
      "microsoft-sign-in",
      expect.stringContaining("popup=yes")
    );
    expect(globalThis.location.assign).not.toHaveBeenCalled();
  });

  it("shows a friendly error when the popup returns a Salesforce authorization error", async () => {
    const element = createElement("c-create-account-registration", {
      is: CreateAccountRegistration
    });
    document.body.appendChild(element);

    element.shadowRoot.querySelector(".social-button").click();

    const popupOptions = openAuthPopup.mock.calls[0][3];
    isPopupLoginErrorUrl.mockReturnValue(true);
    popupOptions.onCompletion(
      "/AmericanBookCompanyvforcesite/_nc_external/identity/sso/ui/AuthorizationError?ErrorDescription=invalid_grant+Bad+Request&ProviderId=0SOWj0000000JHB&ErrorCode=No_Oauth_Token"
    );
    await flushPromises();
    await flushPromises();

    expect(isPopupLoginErrorUrl).toHaveBeenCalledTimes(1);
    expect(globalThis.location.assign).not.toHaveBeenCalled();
  });
});
