import { createElement } from "lwc";
import AccountLoginForm from "c/accountLoginForm";

describe("c-account-login-form", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.firstChild.remove();
    }
  });

  it("renders the child flow component", () => {
    const element = createElement("c-account-login-form", {
      is: AccountLoginForm
    });
    document.body.appendChild(element);

    const child = element.shadowRoot.querySelector(
      "c-account-login-form-popup-flow"
    );
    expect(child).not.toBeNull();
  });

  it("forwards api properties to the child", () => {
    const element = createElement("c-account-login-form", {
      is: AccountLoginForm
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
