@SuppressWarnings('PMD.ApexDoc')
public with sharing class GoogleSocialLoginRedirectController {
    private static final String DEFAULT_START_URL = '/AmericanBookCompany/myprofile';

    public PageReference forward() {
        String startUrl = ApexPages.currentPage().getParameters().get('startURL');
        if (String.isBlank(startUrl)) {
            startUrl = ApexPages.currentPage().getParameters().get('startUrl');
        }
        if (String.isBlank(startUrl)) {
            startUrl = DEFAULT_START_URL;
        }

        if (Test.isRunningTest()) {
            return new PageReference(startUrl);
        }

        return Network.forwardToAuthPage(startUrl, null);
    }
}