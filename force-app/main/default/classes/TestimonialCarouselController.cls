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

