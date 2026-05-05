/**
 * An apex page controller that exposes the site login functionality
 */
global with sharing class SiteLoginController {
    private static final String DEFAULT_LOGIN_URL = '/AmericanBookCompany/login';
    private static final String DEFAULT_START_URL = '/myprofile';

    global String username {get; set;}
    global String password {get; set;}
    global String startUrl {get; set;}

    global PageReference login() {
        String resolvedUsername = String.isBlank(username)
            ? System.currentPageReference().getParameters().get('username')
            : username;
        String resolvedPassword = String.isBlank(password)
            ? System.currentPageReference().getParameters().get('password')
            : password;
        String resolvedStartUrl = String.isBlank(startUrl)
            ? System.currentPageReference().getParameters().get('startURL')
            : startUrl;

        if (String.isBlank(resolvedStartUrl)) {
            resolvedStartUrl = DEFAULT_START_URL;
        }

        PageReference result = Site.login(resolvedUsername, resolvedPassword, resolvedStartUrl);
        if (result != null) {
            return result;
        }

        PageReference fallback = new PageReference(DEFAULT_LOGIN_URL);
        fallback.getParameters().put('loginError', '1');
        if (!String.isBlank(resolvedStartUrl)) {
            fallback.getParameters().put('startURL', resolvedStartUrl);
        }
        fallback.setRedirect(true);
        return fallback;
    }
    
   	global SiteLoginController () {}
}