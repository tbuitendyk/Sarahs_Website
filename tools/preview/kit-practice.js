// PREVIEW ONLY (copied in by tools/export-static.mjs; never used on the real site).
// Stands in for Kit's sign-up script so nothing is sent to Kit: shows the same
// "success" and "already subscribed" messages, using the settings in the form.
(function () {
  document.querySelectorAll("form[data-sv-form]").forEach(function (form) {
    var settings = {};
    try { settings = JSON.parse(form.getAttribute("data-options") || "{}").settings || {}; } catch (e) { /* ignore */ }
    var key = "cksubscribed-" + form.getAttribute("data-uid");
    var remembered = false;
    try { remembered = !!localStorage.getItem(key); } catch (e) { /* storage blocked */ }
    var rv = settings.return_visitor || {};
    if (remembered && rv.action === "custom_content") {
      while (form.firstChild) form.removeChild(form.firstChild);
      var note = document.createElement("div");
      note.className = "seva-custom-content";
      note.innerHTML = rv.custom_content;
      form.appendChild(note);
      return;
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = document.createElement("div");
      msg.className = "formkit-alert formkit-alert-success";
      msg.textContent = (settings.after_subscribe || {}).success_message || "Thank you for signing up.";
      var fields = form.querySelector("[data-element='fields']");
      if (fields) fields.parentNode.replaceChild(msg, fields);
      try { localStorage.setItem(key, "1"); } catch (err) { /* storage blocked */ }
      // Same announcement Kit's own script makes, so the "Already a subscriber?" box appears.
      form.dispatchEvent(new CustomEvent("ckjs:submission:complete", { bubbles: true, detail: { uid: form.getAttribute("data-uid") } }));
    });
  });
})();
