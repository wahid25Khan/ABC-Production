@IsTest
private class GoogleSocialLoginRedirectControllerTest {
    @IsTest
    static void forwardUsesExplicitStartUrl() {
        Test.setCurrentPage(Page.GoogleSocialLoginRedirect);
        ApexPages.currentPage().getParameters().put('startURL', '/AmericanBookCompany/myprofile');

        PageReference result = new GoogleSocialLoginRedirectController().forward();

        System.assertNotEquals(null, result);
        System.assertEquals('/AmericanBookCompany/myprofile', result.getUrl());
    }

    @IsTest
    static void forwardFallsBackToDefaultStartUrl() {
        Test.setCurrentPage(Page.GoogleSocialLoginRedirect);

        PageReference result = new GoogleSocialLoginRedirectController().forward();

        System.assertNotEquals(null, result);
        System.assertEquals('/AmericanBookCompany/myprofile', result.getUrl());
    }
}