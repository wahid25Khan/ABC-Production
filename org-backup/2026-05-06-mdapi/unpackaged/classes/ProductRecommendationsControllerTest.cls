@IsTest
private class ProductRecommendationsControllerTest {
    private static String lastEndpoint;
    private static String lastAuthorization;
    private static String lastMethod;

    private class RecommendationsMock implements HttpCalloutMock {
        private String responseBody;
        private Integer statusCode;

        RecommendationsMock(String responseBody) {
            this.responseBody = responseBody;
            this.statusCode = 200;
        }

        RecommendationsMock(String responseBody, Integer statusCode) {
            this.responseBody = responseBody;
            this.statusCode = statusCode;
        }

        public HTTPResponse respond(HTTPRequest req) {
            lastEndpoint = req.getEndpoint();
            lastAuthorization = req.getHeader('Authorization');
            lastMethod = req.getMethod();

            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(this.statusCode);
            res.setBody(responseBody);
            return res;
        }
    }

    @IsTest
    static void getRecs_withAnchorValues_appendsAnchorAndReturnsBody() {
        String expectedBody = '{"recommendations":[{"id":"abc"}]}';
        Test.setMock(HttpCalloutMock.class, new RecommendationsMock(expectedBody));

        Test.startTest();
        String actualBody = ProductRecommendationsController.getRecs(
            'trending',
            'isbn:12345'
        );
        Test.stopTest();

        System.assertEquals(expectedBody, actualBody);
        System.assert(lastEndpoint.contains('/ai/recommendations'), 'Endpoint should contain AI recommendations path');
        System.assert(lastEndpoint.contains('recommender=trending'), 'Endpoint should contain recommender param');
        System.assert(lastEndpoint.contains('anchorValues='), 'Endpoint should contain anchorValues param');
        System.assertEquals('GET', lastMethod, 'Should use GET method');
        System.assert(lastAuthorization != null && lastAuthorization.startsWith('OAuth '), 'Should use OAuth auth header');
        // Cookie header should NOT be set — removed for security (C2)
    }

    @IsTest
    static void getRecs_withoutAnchorValues_doesNotAppendAnchor() {
        String expectedBody = '{"recommendations":[]}';
        Test.setMock(HttpCalloutMock.class, new RecommendationsMock(expectedBody));

        Test.startTest();
        String actualBody = ProductRecommendationsController.getRecs(
            'homePage',
            ''
        );
        Test.stopTest();

        System.assertEquals(expectedBody, actualBody);
        System.assert(lastEndpoint.contains('recommender=homePage'), 'Endpoint should contain recommender param');
        System.assert(!lastEndpoint.contains('anchorValues='), 'Endpoint should not contain anchorValues when blank');
        System.assertEquals('GET', lastMethod, 'Should use GET method');
    }

    @IsTest
    static void getRecs_nullAnchorValues_doesNotThrowNpe() {
        String expectedBody = '{"recommendations":[]}';
        Test.setMock(HttpCalloutMock.class, new RecommendationsMock(expectedBody));

        Test.startTest();
        String actualBody = ProductRecommendationsController.getRecs(
            'homePage',
            null
        );
        Test.stopTest();

        System.assertEquals(expectedBody, actualBody);
        System.assert(!lastEndpoint.contains('anchorValues='), 'Endpoint should not contain anchorValues when null');
    }

    @IsTest
    static void getRecs_blankRecommender_throwsAuraException() {
        Test.startTest();
        try {
            ProductRecommendationsController.getRecs('', 'someAnchor');
            System.assert(false, 'Should have thrown AuraHandledException');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('recommender is required'), 'Error should mention recommender');
        }
        Test.stopTest();
    }

    @IsTest
    static void getRecs_httpError_throwsAuraException() {
        Test.setMock(HttpCalloutMock.class, new RecommendationsMock('{"error":"not found"}', 404));

        Test.startTest();
        try {
            ProductRecommendationsController.getRecs('trending', '');
            System.assert(false, 'Should have thrown AuraHandledException for HTTP error');
        } catch (AuraHandledException e) {
            System.assert(e.getMessage().contains('HTTP 404') || e.getMessage().contains('Recommendations'), 'Error should indicate HTTP failure');
        }
        Test.stopTest();
    }
}