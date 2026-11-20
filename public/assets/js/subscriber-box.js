// Shows the "Already a subscriber?" password box only to people who signed up on this device.
// Kit's sign-up script remembers a sign-up in this browser ("cksubscribed-..."), and announces
// a new sign-up with the "ckjs:submission:complete" event, so the box appears right away too.
(function () {
  var boxes = document.querySelectorAll("[data-subscriber-box]");
  if (!boxes.length) return;
  function show() {
    for (var i = 0; i < boxes.length; i++) boxes[i].hidden = false;
  }
  try {
    for (var k = 0; k < localStorage.length; k++) {
      if (/^cksubscribed-/.test(localStorage.key(k))) { show(); return; }
    }
  } catch (e) { /* this browser blocks storage */ }
  document.addEventListener("ckjs:submission:complete", show);
})();
