// Mobile menu toggle. The menu still works without JavaScript:
// the <html> element only gets the "js" class (which hides the menu on
// small screens) when scripts run.
(function () {
  var toggle = document.querySelector(".menu-toggle");
  var nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
