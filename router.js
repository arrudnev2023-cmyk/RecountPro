let currentScreen = null;
let isTransitioning = false;

function navigateTo(screenName, addToHistory = true) {
  if (isTransitioning) return;
  isTransitioning = true;

  const app = document.getElementById("app");
  const oldView = app.querySelector(".view-screen");

  // анимация выхода старого экрана (если есть)
  if (oldView) {
    oldView.classList.add("view-screen-exit");
  }

  fetch(`components/${screenName}.html`)
    .then(res => res.text())
    .then(html => {
      // создаём новый контейнер для экрана
      const wrapper = document.createElement("div");
      wrapper.className = "view-screen";
      wrapper.innerHTML = html;

      // очищаем app и вставляем новый экран
      app.innerHTML = "";
      app.appendChild(wrapper);

      // выполняем скрипты компонента
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

      // обновляем history
      if (addToHistory) {
        history.pushState({ screen: screenName }, "", `?screen=${screenName}`);
      }

      currentScreen = screenName;
    })
    .catch(err => {
      console.error("Ошибка загрузки компонента:", err);
    })
    .finally(() => {
      // даём анимации выхода доиграть, если была
      setTimeout(() => {
        isTransitioning = false;
      }, 250);
    });
}

// обработка кнопки «Назад» в браузере
window.onpopstate = (event) => {
  if (event.state && event.state.screen) {
    navigateTo(event.state.screen, false);
  } else {
    navigateTo("MainMenu", false);
  }
};

// автозагрузка экрана при открытии страницы
window.addEventListener("load", () => {
  const params = new URLSearchParams(location.search);
  const screen = params.get("screen");

  if (screen) {
    navigateTo(screen, false);
  } else {
    navigateTo("MainMenu", false);
  }
});


