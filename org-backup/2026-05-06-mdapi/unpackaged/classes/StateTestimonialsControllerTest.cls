@IsTest
private class StateTestimonialsControllerTest {

    @IsTest
    static void testGetStateTestimonialsReturnsEmptyForInvalidInputs() {
        Test.startTest();
        List<StateTestimonialsController.Card> r1 = StateTestimonialsController.getStateTestimonials(null, null);
        List<StateTestimonialsController.Card> r2 = StateTestimonialsController.getStateTestimonials('', null);
        List<StateTestimonialsController.Card> r3 = StateTestimonialsController.getStateTestimonials('InvalidState', '0DB000000000001');
        List<StateTestimonialsController.Card> r4 = StateTestimonialsController.getStateTestimonials('Georgia', null);
        Test.stopTest();

        System.assertEquals(0, r1.size());
        System.assertEquals(0, r2.size());
        System.assertEquals(0, r3.size());
        System.assertEquals(0, r4.size());
    }

    @IsTest
    static void testConfiguredStatesWithFakeSiteIdDoNotThrow() {
        Test.startTest();
        List<StateTestimonialsController.Card> georgia =
            StateTestimonialsController.getStateTestimonials('Georgia', '0DB000000000001');
        List<StateTestimonialsController.Card> alabama =
            StateTestimonialsController.getStateTestimonials('Alabama', '0DB000000000001');
        Test.stopTest();

        System.assertNotEquals(null, georgia);
        System.assertNotEquals(null, alabama);
    }

    @IsTest
    static void testCleanupTitle() {
        System.assertEquals('Login Test', StateTestimonialsController.cleanupTitle('Home-Login_Test'));
        System.assertEquals('abc', StateTestimonialsController.cleanupTitle('abc'));
        System.assertEquals('Testimonial', StateTestimonialsController.cleanupTitle(null));
        System.assertEquals('Testimonial', StateTestimonialsController.cleanupTitle(''));
    }

    @IsTest
    static void testFirstNonBlank() {
        System.assertEquals(
            'abc',
            StateTestimonialsController.firstNonBlank(new List<String>{ null, '', '   ', 'abc', 'xyz' })
        );

        System.assertEquals(
            null,
            StateTestimonialsController.firstNonBlank(new List<String>{ null, '', '   ' })
        );

        System.assertEquals(
            'first',
            StateTestimonialsController.firstNonBlank(new List<String>{ 'first', 'second' })
        );
    }

    @IsTest
    static void testAsString() {
        System.assertEquals('123', StateTestimonialsController.asString(123));
        System.assertEquals('true', StateTestimonialsController.asString(true));
        System.assertEquals(null, StateTestimonialsController.asString(null));
    }

    @IsTest
    static void testGetByPath() {
        Map<String, Object> raw = new Map<String, Object>{
            'managedContent' => new Map<String, Object>{
                'title' => 'My Title',
                'contentKey' => 'CK1',
                'nested' => new Map<String, Object>{
                    'value' => 'Hello'
                }
            }
        };

        System.assertEquals('My Title', (String) StateTestimonialsController.getByPath(raw, 'managedContent.title'));
        System.assertEquals('CK1', (String) StateTestimonialsController.getByPath(raw, 'managedContent.contentKey'));
        System.assertEquals('Hello', (String) StateTestimonialsController.getByPath(raw, 'managedContent.nested.value'));
        System.assertEquals(null, StateTestimonialsController.getByPath(raw, 'managedContent.bad.value'));
        System.assertEquals(null, StateTestimonialsController.getByPath(null, 'managedContent.title'));
        System.assertEquals(null, StateTestimonialsController.getByPath(raw, null));
    }

    @IsTest
    static void testCollectStrings() {
        Map<String, Object> raw = new Map<String, Object>{
            'a' => 'one',
            'b' => new Map<String, Object>{ 'c' => 'two' },
            'd' => new List<Object>{ 'three', 'four' }
        };

        List<String> bag = new List<String>();
        StateTestimonialsController.collectStrings(raw, bag);

        System.assertEquals(4, bag.size());
        System.assert(bag.contains('one'));
        System.assert(bag.contains('two'));
        System.assert(bag.contains('three'));
        System.assert(bag.contains('four'));
    }

    @IsTest
    static void testFindImageUrl() {
        List<String> vals1 = new List<String>{ 'hello', 'https://site.com/file.jpg', 'https://site.com/file.png' };
        System.assertEquals('https://site.com/file.jpg', StateTestimonialsController.findImageUrl(vals1));

        List<String> vals2 = new List<String>{ 'abc', 'https://site.com/cms/rendition' };
        System.assertEquals('https://site.com/cms/rendition', StateTestimonialsController.findImageUrl(vals2));

        List<String> vals3 = new List<String>{ 'abc', 'def' };
        System.assertEquals(null, StateTestimonialsController.findImageUrl(vals3));

        List<String> vals4 = new List<String>{ '', 'https://site.com/media/asset123' };
        System.assertEquals('https://site.com/media/asset123', StateTestimonialsController.findImageUrl(vals4));

        List<String> vals5 = new List<String>{ 'abc', 'https://cdn.site.com/imageAsset' };
        System.assertEquals('https://cdn.site.com/imageAsset', StateTestimonialsController.findImageUrl(vals5));
    }

    @IsTest
    static void testFindVideoUrl() {
        List<String> vals1 = new List<String>{ 'abc', 'https://www.youtube.com/watch?v=12345' };
        System.assertEquals('https://www.youtube.com/watch?v=12345', StateTestimonialsController.findVideoUrl(vals1));

        List<String> vals2 = new List<String>{ 'abc', 'https://site.com/video.mp4' };
        System.assertEquals('https://site.com/video.mp4', StateTestimonialsController.findVideoUrl(vals2));

        List<String> vals3 = new List<String>{ 'abc', 'https://site.com/media/video' };
        System.assertEquals('https://site.com/media/video', StateTestimonialsController.findVideoUrl(vals3));

        List<String> vals4 = new List<String>{ 'abc', 'def' };
        System.assertEquals(null, StateTestimonialsController.findVideoUrl(vals4));

        List<String> vals5 = new List<String>{ 'abc', 'https://site.com/video.mov' };
        System.assertEquals('https://site.com/video.mov', StateTestimonialsController.findVideoUrl(vals5));

        List<String> vals6 = new List<String>{ 'abc', 'https://site.com/stream.m3u8' };
        System.assertEquals('https://site.com/stream.m3u8', StateTestimonialsController.findVideoUrl(vals6));

        List<String> vals7 = new List<String>{ '', 'https://cdn.site.com/videoAsset' };
        System.assertEquals('https://cdn.site.com/videoAsset', StateTestimonialsController.findVideoUrl(vals7));
    }

    @IsTest
    static void testToCardFromRawVideo() {
        Map<String, Object> raw = new Map<String, Object>{
            'managedContent' => new Map<String, Object>{
                'contentKey' => 'VID1',
                'title' => 'Home-testimonial-video-1'
            },
            'urls' => new List<Object>{
                'https://www.youtube.com/watch?v=abc123',
                'https://site.com/thumb.jpg'
            }
        };

        StateTestimonialsController.Card c =
            StateTestimonialsController.toCardFromRaw(raw, 'video', 'Georgia', 10);

        System.assertNotEquals(null, c);
        System.assertEquals('VID1', c.id);
        System.assertEquals('video', c.type);
        System.assertEquals('Georgia', c.state);
        System.assertEquals(10, c.sortOrder);
        System.assertEquals('https://www.youtube.com/watch?v=abc123', c.mediaUrl);
        System.assertEquals('https://site.com/thumb.jpg', c.thumbUrl);
        System.assertEquals('video 1', c.title);
    }

    @IsTest
    static void testToCardFromRawVideoContentNodes() {
        Map<String, Object> raw = new Map<String, Object>{
            'managedContent' => new Map<String, Object>{
                'id' => 'VID2',
                'name' => 'Home-testimonial-video-2',
                'contentNodes' => new Map<String, Object>{
                    'source' => new Map<String, Object>{
                        'url' => 'https://cdn.site.com/video.mp4'
                    },
                    'thumbnail' => new Map<String, Object>{
                        'url' => 'https://cdn.site.com/thumb.png'
                    }
                }
            }
        };

        StateTestimonialsController.Card c =
            StateTestimonialsController.toCardFromRaw(raw, 'video', 'Georgia', 11);

        System.assertNotEquals(null, c);
        System.assertEquals('VID2', c.id);
        System.assertEquals('https://cdn.site.com/video.mp4', c.mediaUrl);
        System.assertEquals('https://cdn.site.com/thumb.png', c.thumbUrl);
    }

    @IsTest
    static void testToCardFromRawImage() {
        Map<String, Object> raw = new Map<String, Object>{
            'contentKey' => 'IMG1',
            'title' => 'testimonial-image-1',
            'asset' => new Map<String, Object>{ 'src' => 'https://site.com/card.png' }
        };

        StateTestimonialsController.Card c =
            StateTestimonialsController.toCardFromRaw(raw, 'image', 'Alabama', 20);

        System.assertNotEquals(null, c);
        System.assertEquals('IMG1', c.id);
        System.assertEquals('image', c.type);
        System.assertEquals('Alabama', c.state);
        System.assertEquals(20, c.sortOrder);
        System.assertEquals('https://site.com/card.png', c.mediaUrl);
        System.assertEquals('https://site.com/card.png', c.thumbUrl);
        System.assertEquals('image 1', c.title);
    }

    @IsTest
    static void testToCardFromRawImageContentNodes() {
        Map<String, Object> raw = new Map<String, Object>{
            'managedContent' => new Map<String, Object>{
                'contentNodes' => new Map<String, Object>{
                    'image' => new Map<String, Object>{
                        'unauthenticatedUrl' => 'https://cdn.site.com/image.webp'
                    }
                }
            }
        };

        StateTestimonialsController.Card c =
            StateTestimonialsController.toCardFromRaw(raw, 'image', 'Alabama', 21);

        System.assertNotEquals(null, c);
        System.assertEquals('21', c.id);
        System.assertEquals('https://cdn.site.com/image.webp', c.mediaUrl);
        System.assertEquals('https://cdn.site.com/image.webp', c.thumbUrl);
    }

    @IsTest
    static void testToCardFromRawFallbacks() {
        Map<String, Object> raw = new Map<String, Object>{ 'other' => 'value' };

        StateTestimonialsController.Card c =
            StateTestimonialsController.toCardFromRaw(raw, 'image', 'Texas', 30);

        System.assertNotEquals(null, c);
        System.assertEquals('30', c.id);
        System.assertEquals('Testimonial', c.title);
        System.assertEquals(null, c.mediaUrl);
    }

    @IsTest
    static void testToCardFromRawNull() {
        System.assertEquals(
            null,
            StateTestimonialsController.toCardFromRaw(null, 'image', 'Texas', 1)
        );
    }
}