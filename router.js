let currentScreen = null;
let isTransitioning = false;

// Глобальный destroy, который компонент будет устанавливать сам
window.currentDestroy = null;

function navigateTo(screenName, addToHistory = true) {
  if (isTransitioning) return;
  isTransitioning = true;

  const app = document.getElementById("app");
  const oldView = app.querySelector(".view-screen");

  // Если предыдущий экран имеет destroy() — вызываем
  if (window.currentDestroy) {
    try { window.currentDestroy(); } catch (e) {
      console.warn("Ошибка в destroy():", e);
    }
    window.currentDestroy = null;
  }

  // Анимация выхода старого экрана
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

      // Выполняем скрипты компонента
      const scripts = wrapper.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");

        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }

        document.body.appendChild(newScript);
        oldScript.remove();
      });

      // Добавляем запись в историю
      if (addToHistory) {
        history.pushState({ screen: screenName }, "", `?screen=${screenName}`);
      }

      currentScreen = screenName;
    })
    .catch(err => {
      console.error("Ошибка загрузки компонента:", err);
    })
    .finally(() => {
      setTimeout(() => {
        isTransitioning = false;
      }, 250);
    });
}

// Кнопка "Назад"
window.onpopstate = (event) => {
  if (event.state && event.state.screen) {
    navigateTo(event.state.screen, false);
  } else {
    navigateTo("MainMenu", false);
  }
};

// Автозагрузка экрана при открытии
window.addEventListener("load", () => {
  const params = new URLSearchParams(location.search);
  const screen = params.get("screen");

  if (screen) {
    navigateTo(screen, false);
  } else {
    navigateTo("MainMenu", false);
  }
});


