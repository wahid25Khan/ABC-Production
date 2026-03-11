@IsTest
private class ProductRecommendationsControllerTest {
    private static String lastEndpoint;
    private static String lastCookie;
    private static String lastAuthorization;
    private static String lastMethod;

    private class RecommendationsMock implements HttpCalloutMock {
        private String responseBody;

        RecommendationsMock(String responseBody) {
            this.responseBody = responseBody;
        }

        public HTTPResponse respond(HTTPRequest req) {
            lastEndpoint = req.getEndpoint();
            lastCookie = req.getHeader('Cookie');
            lastAuthorization = req.getHeader('Authorization');
            lastMethod = req.getMethod();

            HTTPResponse res = new HTTPResponse();
            res.setStatusCode(200);
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
            'isbn:12345',
            'GuestCartSessionId=xyz'
        );
        Test.stopTest();

        System.assertEquals(expectedBody, actualBody);
        System.assert(lastEndpoint.contains('/ai/recommendations'));
        System.assert(lastEndpoint.contains('recommender=trending'));
        System.assert(lastEndpoint.contains('anchorValues=isbn:12345'));
        System.assertEquals('GuestCartSessionId=xyz', lastCookie);
        System.assertEquals('GET', lastMethod);
        System.assert(lastAuthorization != null && lastAuthorization.startsWith('OAuth '));
    }

    @IsTest
    static void getRecs_withoutAnchorValues_doesNotAppendAnchor() {
        String expectedBody = '{"recommendations":[]}';
        Test.setMock(HttpCalloutMock.class, new RecommendationsMock(expectedBody));

        Test.startTest();
        String actualBody = ProductRecommendationsController.getRecs(
            'homePage',
            '',
            'GuestCartSessionId=abc'
        );
        Test.stopTest();

        System.assertEquals(expectedBody, actualBody);
        System.assert(lastEndpoint.contains('recommender=homePage'));
        System.assert(!lastEndpoint.contains('anchorValues='));
        System.assertEquals('GuestCartSessionId=abc', lastCookie);
        System.assertEquals('GET', lastMethod);
    }
}