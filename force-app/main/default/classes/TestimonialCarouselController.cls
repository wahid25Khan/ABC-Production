public without sharing class TestimonialCarouselController {
  @AuraEnabled(cacheable=true)
  public static List<Carousel_Content__c> getCarouselData(String stateCode) {
    if (String.isBlank(stateCode)) {
      return new List<Carousel_Content__c>();
    }

    return [
      SELECT
        Id,
        Author_Name__c,
        Designation__c,
        Media_Type__c,
        Red_Display_Text__c,
        School_Name__c,
        Sort_Order__c,
        State__c,
        Testimonial_Text__c,
        Video_URL__c
      FROM Carousel_Content__c
      WHERE State__c = :stateCode AND Active__c = TRUE
      ORDER BY Sort_Order__c ASC
      LIMIT 200
    ];
  }
}

// public with sharing class StateTestimonialsController {
//     public class Card {
//         @AuraEnabled public String id;
//         @AuraEnabled public String type;
//         @AuraEnabled public String title;
//         @AuraEnabled public String mediaUrl;
//         @AuraEnabled public String thumbUrl;
//         @AuraEnabled public String state;
//         @AuraEnabled public Integer sortOrder;
//     }

//     private class StateCollections {
//         public String imageKey;
//         public String videoKey;

//         public StateCollections(String imageKey, String videoKey) {
//             this.imageKey = imageKey;
//             this.videoKey = videoKey;
//         }
//     }

//     private static final Map<String, StateCollections> STATE_COLLECTIONS = new Map<String, StateCollections>{
//         'Alabama' => new StateCollections(
//             'MCN765O7CTVVAWLM2YADH7CZ5Z2Q',
//             'MCC34UAEQIVRBP7NWSC4SAU2P7C4'
//         ),
//         'Georgia' => new StateCollections(
//             'MCVZXCTOVX4BCCJKSQOFKFOBQBPE',
//             'MCQZALDZMDLZFYVIY6VG25FOJDNM'
//         ),
//         'Alaska' => new StateCollections('', ''),
//         'Arizona' => new StateCollections('', ''),
//         'Arkansas' => new StateCollections('', ''),
//         'California' => new StateCollections('', ''),
//         'Colorado' => new StateCollections('', ''),
//         'Connecticut' => new StateCollections('', ''),
//         'Delaware' => new StateCollections('', ''),
//         'District of Columbia' => new StateCollections('', ''),
//         'Florida' => new StateCollections('', ''),
//         'Hawaii' => new StateCollections('', ''),
//         'Idaho' => new StateCollections('', ''),
//         'Illinois' => new StateCollections('', ''),
//         'Indiana' => new StateCollections('', ''),
//         'Iowa' => new StateCollections('', ''),
//         'Kansas' => new StateCollections('', ''),
//         'Kentucky' => new StateCollections('', ''),
//         'Louisiana' => new StateCollections('', ''),
//         'Maine' => new StateCollections('', ''),
//         'Maryland' => new StateCollections('', ''),
//         'Massachusetts' => new StateCollections('', ''),
//         'Michigan' => new StateCollections('', ''),
//         'Minnesota' => new StateCollections('', ''),
//         'Mississippi' => new StateCollections('', ''),
//         'Missouri' => new StateCollections('', ''),
//         'Montana' => new StateCollections('', ''),
//         'Nebraska' => new StateCollections('', ''),
//         'Nevada' => new StateCollections('', ''),
//         'New Hampshire' => new StateCollections('', ''),
//         'New Jersey' => new StateCollections('', ''),
//         'New Mexico' => new StateCollections('', ''),
//         'New York' => new StateCollections('', ''),
//         'North Carolina' => new StateCollections('', ''),
//         'North Dakota' => new StateCollections('', ''),
//         'Ohio' => new StateCollections('', ''),
//         'Oklahoma' => new StateCollections('', ''),
//         'Oregon' => new StateCollections('', ''),
//         'Pennsylvania' => new StateCollections('', ''),
//         'Rhode Island' => new StateCollections('', ''),
//         'South Carolina' => new StateCollections('', ''),
//         'South Dakota' => new StateCollections('', ''),
//         'Tennessee' => new StateCollections('', ''),
//         'Texas' => new StateCollections('', ''),
//         'Utah' => new StateCollections('', ''),
//         'Vermont' => new StateCollections('', ''),
//         'Virginia' => new StateCollections('', ''),
//         'Washington' => new StateCollections('', ''),
//         'West Virginia' => new StateCollections('', ''),
//         'Wisconsin' => new StateCollections('', ''),
//         'Wyoming' => new StateCollections('', '')
//     };

//     @AuraEnabled(cacheable=true)
//     public static List<Card> getStateTestimonials(String state, String siteId) {
//         List<Card> result = new List<Card>();

//         System.debug(LoggingLevel.ERROR, '=== StateTestimonialsController.getStateTestimonials START ===');
//         System.debug(LoggingLevel.ERROR, 'Input state = ' + state);
//         System.debug(LoggingLevel.ERROR, 'Input siteId = ' + siteId);
//         System.debug(LoggingLevel.ERROR, 'Network.getNetworkId() = ' + Network.getNetworkId());

//         if (String.isBlank(state) || !STATE_COLLECTIONS.containsKey(state)) {
//             System.debug(LoggingLevel.ERROR, 'Invalid or blank state. Returning empty list.');
//             return result;
//         }

//         String resolvedSiteId = firstNonBlank(new List<String>{
//             siteId,
//             Network.getNetworkId()
//         });

//         System.debug(LoggingLevel.ERROR, 'Resolved siteId = ' + resolvedSiteId);

//         if (String.isBlank(resolvedSiteId)) {
//             System.debug(LoggingLevel.ERROR, 'Resolved siteId is blank. Returning empty list.');
//             return result;
//         }

//         StateCollections cfg = STATE_COLLECTIONS.get(state);
//         System.debug(LoggingLevel.ERROR, 'State config found. imageKey=' + cfg.imageKey + ', videoKey=' + cfg.videoKey);

//         Integer sortSeed = 0;

//         if (!String.isBlank(cfg.videoKey)) {
//             List<Card> videoCards = fetchCollection(resolvedSiteId, cfg.videoKey, 'video', state, sortSeed);
//             System.debug(LoggingLevel.ERROR, 'Video cards fetched = ' + videoCards.size());
//             result.addAll(videoCards);
//             sortSeed += 1000;
//         } else {
//             System.debug(LoggingLevel.ERROR, 'No videoKey configured for state ' + state);
//         }

//         if (!String.isBlank(cfg.imageKey)) {
//             List<Card> imageCards = fetchCollection(resolvedSiteId, cfg.imageKey, 'image', state, sortSeed);
//             System.debug(LoggingLevel.ERROR, 'Image cards fetched = ' + imageCards.size());
//             result.addAll(imageCards);
//         } else {
//             System.debug(LoggingLevel.ERROR, 'No imageKey configured for state ' + state);
//         }

//         result.sort(new CardComparator());
//         System.debug(LoggingLevel.ERROR, 'Final result size = ' + result.size());
//         System.debug(LoggingLevel.ERROR, '=== StateTestimonialsController.getStateTestimonials END ===');

//         return result;
//     }

//     private static List<Card> fetchCollection(
//         String siteId,
//         String collectionKey,
//         String type,
//         String state,
//         Integer baseSort
//     ) {
//         List<Card> cards = new List<Card>();

//         System.debug(LoggingLevel.ERROR,
//             'fetchCollection called. siteId=' + siteId +
//             ', collectionKey=' + collectionKey +
//             ', type=' + type +
//             ', state=' + state +
//             ', baseSort=' + baseSort
//         );

//         if (String.isBlank(siteId) || String.isBlank(collectionKey)) {
//             System.debug(LoggingLevel.ERROR, 'siteId or collectionKey blank. Returning empty cards.');
//             return cards;
//         }

//         ConnectApi.ManagedContentCollectionItems resp = fetchCollectionItems(siteId, collectionKey);

//         if (resp == null) {
//             System.debug(LoggingLevel.ERROR, 'fetchCollectionItems returned null.');
//             return cards;
//         }

//         if (resp.items == null) {
//             System.debug(LoggingLevel.ERROR, 'fetchCollectionItems returned resp with null items.');
//             return cards;
//         }

//         System.debug(LoggingLevel.ERROR, 'Collection item count = ' + resp.items.size());

//         Integer i = 0;
//         for (ConnectApi.ManagedContentCollectionItem item : resp.items) {
//             Card c = toCard(item, type, state, baseSort + i);
//             if (c != null) {
//                 cards.add(c);
//                 System.debug(LoggingLevel.ERROR,
//                     'Card added => id=' + c.id +
//                     ', title=' + c.title +
//                     ', type=' + c.type +
//                     ', mediaUrl=' + c.mediaUrl +
//                     ', thumbUrl=' + c.thumbUrl
//                 );
//             } else {
//                 System.debug(LoggingLevel.ERROR, 'toCard returned null for item index ' + i);
//             }
//             i++;
//         }

//         return cards;
//     }

//     private static ConnectApi.ManagedContentCollectionItems fetchCollectionItems(
//         String siteId,
//         String collectionKey
//     ) {
//         List<String> locales = new List<String>{ 'en_US', 'en', '' };

//         for (String locale : locales) {
//             try {
//                 System.debug(LoggingLevel.ERROR,
//                     'Trying getCollectionItemsForSite with siteId=' + siteId +
//                     ', collectionKey=' + collectionKey +
//                     ', locale=' + locale
//                 );

//                 ConnectApi.ManagedContentCollectionItems resp =
//                     ConnectApi.ManagedContentDelivery.getCollectionItemsForSite(
//                         siteId,
//                         collectionKey,
//                         locale
//                     );

//                 Integer sizeVal = (resp != null && resp.items != null) ? resp.items.size() : null;
//                 System.debug(LoggingLevel.ERROR, 'Response received. items size=' + sizeVal);

//                 if (resp != null && resp.items != null && !resp.items.isEmpty()) {
//                     System.debug(LoggingLevel.ERROR, 'Returning response with populated items for locale=' + locale);
//                     return resp;
//                 }

//                 if (resp != null && resp.items != null) {
//                     System.debug(LoggingLevel.ERROR, 'Returning response with empty items list for locale=' + locale);
//                     return resp;
//                 }
//             } catch (Exception e) {
//                 System.debug(LoggingLevel.ERROR,
//                     'Exception in getCollectionItemsForSite. locale=' + locale +
//                     ', message=' + e.getMessage()
//                 );
//             }
//         }

//         System.debug(LoggingLevel.ERROR, 'All locale attempts failed or returned null.');
//         return null;
//     }

//     private static Card toCard(
//         ConnectApi.ManagedContentCollectionItem item,
//         String type,
//         String state,
//         Integer sortOrder
//     ) {
//         if (item == null) {
//             return null;
//         }

//         Map<String, Object> raw =
//             (Map<String, Object>) JSON.deserializeUntyped(JSON.serialize(item));

//         return toCardFromRaw(raw, type, state, sortOrder);
//     }

//     @TestVisible
//     static Card toCardFromRaw(
//         Map<String, Object> raw,
//         String type,
//         String state,
//         Integer sortOrder
//     ) {
//         if (raw == null) {
//             return null;
//         }

//         List<String> allStrings = new List<String>();
//         collectStrings(raw, allStrings);

//         Card c = new Card();
//         c.type = type;
//         c.state = state;
//         c.sortOrder = sortOrder;

//         c.id = firstNonBlank(new List<String>{
//             asString(getByPath(raw, 'managedContent.contentKey')),
//             asString(getByPath(raw, 'contentKey')),
//             asString(getByPath(raw, 'managedContent.id')),
//             String.valueOf(sortOrder)
//         });

//         c.title = cleanupTitle(firstNonBlank(new List<String>{
//             asString(getByPath(raw, 'managedContent.title')),
//             asString(getByPath(raw, 'managedContent.name')),
//             asString(getByPath(raw, 'title')),
//             'Testimonial'
//         }));

//         if (type == 'video') {
//             c.mediaUrl = firstNonBlank(new List<String>{
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.value')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.file.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.file.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.media.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.media.unauthenticatedUrl')),
//                 findVideoUrl(allStrings)
//             });

//             c.thumbUrl = firstNonBlank(new List<String>{
//                 asString(getByPath(raw, 'managedContent.contentNodes.thumbnail.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.thumbnail.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.poster.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.poster.unauthenticatedUrl')),
//                 findImageUrl(allStrings)
//             });
//         } else {
//             c.mediaUrl = firstNonBlank(new List<String>{
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.value')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.source.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.image.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.image.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.file.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.file.unauthenticatedUrl')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.media.url')),
//                 asString(getByPath(raw, 'managedContent.contentNodes.media.unauthenticatedUrl')),
//                 findImageUrl(allStrings)
//             });

//             c.thumbUrl = c.mediaUrl;
//         }

//         return c;
//     }

//     private class CardComparator implements System.Comparator<Card> {
//         public Integer compare(Card a, Card b) {
//             Integer aSort = a != null && a.sortOrder != null ? a.sortOrder : 999999;
//             Integer bSort = b != null && b.sortOrder != null ? b.sortOrder : 999999;

//             if (aSort == bSort) {
//                 return 0;
//             }
//             return aSort < bSort ? -1 : 1;
//         }
//     }

//     @TestVisible
//     static String cleanupTitle(String input) {
//         if (String.isBlank(input)) {
//             return 'Testimonial';
//         }
//         String s = input.trim();
//         s = s.replace('Home-', '');
//         s = s.replace('home-', '');
//         s = s.replace('testimonial-', '');
//         s = s.replace('testimonials-', '');
//         s = s.replace('-', ' ');
//         s = s.replace('_', ' ');
//         return s.trim();
//     }

//     @TestVisible
//     static String firstNonBlank(List<String> vals) {
//         for (String v : vals) {
//             if (!String.isBlank(v)) {
//                 return v;
//             }
//         }
//         return null;
//     }

//     @TestVisible
//     static String asString(Object val) {
//         return val == null ? null : String.valueOf(val);
//     }

//     @TestVisible
//     static Object getByPath(Object obj, String path) {
//         if (obj == null || String.isBlank(path)) {
//             return null;
//         }

//         Object current = obj;
//         for (String part : path.split('\\.')) {
//             if (current instanceof Map<String, Object>) {
//                 current = ((Map<String, Object>) current).get(part);
//             } else {
//                 return null;
//             }
//         }
//         return current;
//     }

//     @TestVisible
//     static void collectStrings(Object node, List<String> bag) {
//         if (node == null) {
//             return;
//         }

//         if (node instanceof String) {
//             bag.add((String) node);
//             return;
//         }

//         if (node instanceof Map<String, Object>) {
//             for (Object v : ((Map<String, Object>) node).values()) {
//                 collectStrings(v, bag);
//             }
//             return;
//         }

//         if (node instanceof List<Object>) {
//             for (Object v : (List<Object>) node) {
//                 collectStrings(v, bag);
//             }
//         }
//     }

//     @TestVisible
//     static String findImageUrl(List<String> vals) {
//         for (String s : vals) {
//             if (String.isBlank(s)) {
//                 continue;
//             }
//             String t = s.toLowerCase();

//             if (
//                 t.contains('.jpg') ||
//                 t.contains('.jpeg') ||
//                 t.contains('.png') ||
//                 t.contains('.webp') ||
//                 t.contains('.gif')
//             ) {
//                 return s;
//             }
//         }

//         for (String s : vals) {
//             if (String.isBlank(s)) {
//                 continue;
//             }
//             String t = s.toLowerCase();
//             if (
//                 t.contains('/cms/') ||
//                 t.contains('/media/') ||
//                 t.contains('rendition') ||
//                 t.contains('image')
//             ) {
//                 return s;
//             }
//         }

//         return null;
//     }

//     @TestVisible
//     static String findVideoUrl(List<String> vals) {
//         for (String s : vals) {
//             if (String.isBlank(s)) {
//                 continue;
//             }
//             String t = s.toLowerCase();

//             if (
//                 t.contains('youtube.com/watch') ||
//                 t.contains('youtu.be/') ||
//                 t.contains('vimeo.com/') ||
//                 t.contains('.mp4') ||
//                 t.contains('.mov') ||
//                 t.contains('.m3u8')
//             ) {
//                 return s;
//             }
//         }

//         for (String s : vals) {
//             if (String.isBlank(s)) {
//                 continue;
//             }
//             String t = s.toLowerCase();
//             if (
//                 t.contains('/media/') ||
//                 t.contains('video')
//             ) {
//                 return s;
//             }
//         }

//         return null;
//     }
// }
