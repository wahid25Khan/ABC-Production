import { createElement } from "lwc";
import AccountLoginFormPopup from "c/accountLoginFormPopup";

describe("c-account-login-form-popup", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  it("renders the child flow component", () => {
    const element = createElement("c-account-login-form-popup", {
      is: AccountLoginFormPopup
    });
    document.body.appendChild(element);

    const child = element.shadowRoot.querySelector(
      "c-account-login-form-popup-flow"
    );
    expect(child).not.toBeNull();
  });

  it("forwards api properties to the child", () => {
    const element = createElement("c-account-login-form-popup", {
      is: AccountLoginFormPopup
    });
    element.forgotPasswordLabel = "Reset?";
    element.selfRegisterUrl = "/register";
    document.body.appendChild(element);

    const child = element.shadowRoot.querySelector(
      "c-account-login-form-popup-flow"
    );
    expect(child.forgotPasswordLabel).toBe("Reset?");
    expect(child.selfRegisterUrl).toBe("/register");
  });
});
