/**
 * @deprecated Use c-account-login-form-popup-flow instead.
 * This component wraps accountLoginFormPopupFlow to maintain backward compatibility.
 */
import { LightningElement, api } from "lwc";

export default class AccountLoginForm extends LightningElement {
  @api forgotPasswordLabel = "Forgot your password?";
  @api forgotPasswordUrl = "/ForgotPassword";
  @api googleAuthUrl;
  @api loginButtonLabel = "Sign In";
  @api loginActionUrl = "/AmericanBookCompany/login";
  @api microsoftAuthUrl;
  @api passwordLabel = "Password";
  @api selfRegisterLabel = "Not a member?";
  @api selfRegisterUrl = "/create-account";
  @api usernameLabel = "Username";
  @api defaultStartUrl = "/myprofile";
}
