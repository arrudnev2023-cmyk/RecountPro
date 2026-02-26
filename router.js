let currentScreen = null;
let isTransitioning = false;

window.currentDestroy = null;

function navigateTo(screenName, addToHistory = true) {
  if (isTransitioning) return;
  isTransitioning = true;

  const app = document.getElementById("app");
  const oldView = app.querySelector(".view-screen");

  // ВАЖНО: вызываем destroy() предыдущего экрана
  if (window.currentDestroy) {
    try { window.currentDestroy(); } catch(e) {}
    window.currentDestroy = null;
  }

  if (oldView) {
    oldView.classList.add("view-screen-exit");
  }

  fetch(`components/${screenName}.html`)
    .then(res => res.text())
    .then(html => {
      const wrapper = document.createElement("div");
      wrapper.className = "view-screen";
      wrapper.innerHTML = html;

      app.innerHTML = "";
      app.appendChild(wrapper);

      const scripts = wrapper.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");
        if (oldScript.src) newScript.src = oldScript.src;
        else newScript.textContent = oldScript.textContent;
        document.body.appendChild(newScript);
        oldScript.remove();
      });

      if (addToHistory) {
        history.pushState({ screen: screenName }, "", `?screen=${screenName}`);
      }

      currentScreen = screenName;
    })
    .finally(() => {
      setTimeout(() => isTransitioning = false, 250);
    });
}

window.onpopstate = (event) => {
  if (event.state?.screen) navigateTo(event.state.screen, false);
  else navigateTo("MainMenu", false);
};

window.addEventListener("load", () => {
  const screen = new URLSearchParams(location.search).get("screen");
  navigateTo(screen || "MainMenu", false);
});


