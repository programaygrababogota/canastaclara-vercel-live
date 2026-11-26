/* Plain-HTML Speed Insights bootstrap; external file preserves script-src 'self'. */
"use strict";
window.si = window.si || function () {
  (window.siq = window.siq || []).push(arguments);
};
window.si('beforeSend', function (event) {
  try {
    const url = new URL(event.url, location.origin);
    // Hash routes can contain search terms and report text. Do not send either.
    url.search = '';
    url.hash = '';
    return { ...event, url: url.toString() };
  } catch {
    return null;
  }
});
