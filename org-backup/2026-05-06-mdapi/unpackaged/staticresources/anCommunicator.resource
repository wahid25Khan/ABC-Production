<!DOCTYPE html>
<!--
  Authorize.Net Accept Hosted iFrame Communicator Page
  =====================================================
  This page MUST be hosted at a publicly accessible URL and passed as
  hostedPaymentIFrameCommunicatorUrl in the getHostedPaymentPageRequest.

  Authorize.Net loads this page inside a hidden iframe on their hosted
  payment form. It receives postMessage events from the AN payment iframe
  and relays them to our parent LWC page so the LWC can react (close the
  modal, trigger placeOrder, etc.) without a full-page redirect.

  Reference: https://developer.authorize.net/api/reference/features/accept-hosted.html
-->
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>AN Communicator</title>
</head>
<body>
<script>
  // Allowed Authorize.Net origins (sandbox + production)
  var ALLOWED_ORIGINS = [
    'https://test.authorize.net',
    'https://accept.authorize.net'
  ];

  function isAllowedOrigin(origin) {
    return ALLOWED_ORIGINS.indexOf(origin) !== -1;
  }

  // Relay messages from Authorize.Net → parent LWC window
  window.addEventListener('message', function(event) {
    if (!isAllowedOrigin(event.origin)) return;

    var msg;
    try {
      msg = (typeof event.data === 'string') ? JSON.parse(event.data) : event.data;
    } catch (e) {
      return; // ignore non-JSON messages
    }

    // The communicator iframe sits inside the AN payment iframe which sits
    // inside our LWC page.  We need to relay UP to the top-level window
    // (the Experience Cloud page hosting the LWC).
    // Use window.top so the message reaches the LWC's postMessage listener.
    var target = window.top || window.parent;
    if (target && target !== window) {
      target.postMessage(JSON.stringify(msg), '*');
    }
  }, false);
</script>
</body>
</html>
