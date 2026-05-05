/**
 * An apex page controller that exposes the site login functionality
 */
@IsTest global with sharing class SiteLoginControllerTest {
    @IsTest(SeeAllData=true) global static void testSiteLoginController () {
        ApexPages.currentPage().getParameters().put('startURL', '/myprofile');

        SiteLoginController controller = new SiteLoginController ();
        controller.username = 'test@salesforce.com';
        controller.password = '123456'; 

        PageReference result = controller.login();

        System.assertNotEquals(null, result);
        System.assert(result.getUrl().contains('/AmericanBookCompany/login'));
        System.assert(result.getUrl().contains('loginError=1'));
        System.assert(result.getUrl().contains('startURL=%2Fmyprofile'));
    }

    @IsTest(SeeAllData=true) global static void testSiteLoginControllerReadsRequestParameters() {
        ApexPages.currentPage().getParameters().put('username', 'test@salesforce.com');
        ApexPages.currentPage().getParameters().put('password', '123456');
        ApexPages.currentPage().getParameters().put('startURL', '/myprofile');

        SiteLoginController controller = new SiteLoginController();

        PageReference result = controller.login();

        System.assertNotEquals(null, result);
        System.assert(result.getUrl().contains('/AmericanBookCompany/login'));
        System.assert(result.getUrl().contains('loginError=1'));
        System.assert(result.getUrl().contains('startURL=%2Fmyprofile'));
    }
}