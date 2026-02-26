let currentScreen = null;
let isTransitioning = false;

// destroy() текущего экрана
window.currentDestroy = null;

function navigateTo(screenName, addToHistory = true) {
  if (isTransitioning) return;
  isTransitioning = true;

  const app = document.getElementById("app");
  const oldView = app.querySelector(".view-screen");

  // 1) Уничтожаем предыдущий экран
  if (window.currentDestroy) {
    try { window.currentDestroy(); } catch (e) {}
    window.currentDestroy = null;
  }

  // 2) Анимация выхода
  if (oldView) {
    oldView.classList.add("view-screen-exit");
  }

  // 3) Загружаем HTML компонента
  fetch(`components/${screenName}.html`)
    .then(res => res.text())
    .then(html => {

      // 4) Создаём новый контейнер
      const wrapper = document.createElement("div");
      wrapper.className = "view-screen";
      wrapper.innerHTML = html;

      // 5) Очищаем старый экран
      app.innerHTML = "";
      app.appendChild(wrapper);

      // 6) Удаляем старые скрипты компонента
      document.querySelectorAll("script[data-component]").forEach(s => s.remove());

      // 7) Выполняем скрипты нового компонента
      const scripts = wrapper.querySelectorAll("script");
      scripts.forEach(oldScript => {
        const newScript = document.createElement("script");

        if (oldScript.src) {
          newScript.src = oldScript.src;
        } else {
          newScript.textContent = oldScript.textContent;
        }

        // помечаем, чтобы потом удалить
        newScript.setAttribute("data-component", screenName);

        document.body.appendChild(newScript);
        oldScript.remove();
      });

      // 8) Обновляем историю
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
  if (event.state?.screen) {
    navigateTo(event.state.screen, false);
  } else {
    navigateTo("MainMenu", false);
  }
};

// Автозагрузка первого экрана
window.addEventListener("load", () => {
  const screen = new URLSearchParams(location.search).get("screen");
  navigateTo(screen || "MainMenu", false);
});

