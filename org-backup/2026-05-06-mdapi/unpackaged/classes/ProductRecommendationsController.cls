/**
 * Fetches AI product recommendations from the Commerce API.
 *
 * Security fixes applied:
 *  - Removed client-supplied cookie header injection (C2).
 *  - Uses UserInfo.getSessionId() for authentication instead.
 *  - Url.getOrgDomainUrl() replaces hardcoded org domain.
 *  - anchorValues/recommender are URL-encoded to prevent injection.
 *  - Null-safe anchorValues handling (no NPE).
 *  - HTTP status validation + try/catch error handling.
 *  - API version updated to v66.0.
 */
public with sharing class ProductRecommendationsController {

    private static final String WEBSTORE_ID = '0ZEam000004dJDNGA2';
    private static final String API_VERSION = 'v66.0';

    @AuraEnabled
    public static String getRecs(String recommender, String anchorValues) {
        try {
            if (String.isBlank(recommender)) {
                AuraHandledException ex = new AuraHandledException('recommender is required');
                ex.setMessage('recommender is required');
                throw ex;
            }

            String sessionId = UserInfo.getSessionId();
            String baseUrl = Url.getOrgDomainUrl().toExternalForm();

            String endpoint = baseUrl
                + '/services/data/' + API_VERSION
                + '/commerce/webstores/' + WEBSTORE_ID
                + '/ai/recommendations?language=en-US&asGuest=true&recommender='
                + EncodingUtil.urlEncode(recommender, 'UTF-8');

            if (String.isNotBlank(anchorValues)) {
                endpoint += '&anchorValues=' + EncodingUtil.urlEncode(anchorValues, 'UTF-8');
            }

            HttpRequest req = new HttpRequest();
            req.setEndpoint(endpoint);
            req.setMethod('GET');
            req.setHeader('Authorization', 'OAuth ' + sessionId);
            req.setHeader('Content-Type', 'application/json');

            HttpResponse res = new Http().send(req);

            if (res.getStatusCode() < 200 || res.getStatusCode() >= 300) {
                AuraHandledException ex = new AuraHandledException('Recommendations API error: HTTP ' + res.getStatusCode());
                ex.setMessage('Recommendations API error: HTTP ' + res.getStatusCode());
                throw ex;
            }

            return res.getBody();
        } catch (AuraHandledException e) {
            throw e;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'ProductRecommendationsController error: ' + e.getMessage());
            AuraHandledException ex = new AuraHandledException('Recommendations unavailable. Please try again.');
            ex.setMessage('Recommendations unavailable. Please try again.');
            throw ex;
        }
    }
}