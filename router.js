async function navigateTo(page) {
    try {
        const response = await fetch(`components/${page}.html`);
        if (!response.ok) throw new Error("Страница не найдена");

        const html = await response.text();
        const app = document.getElementById("app");
        app.innerHTML = html;

        // Выполняем скрипты внутри компонента
        const scripts = app.querySelectorAll("script");
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

    } catch (e) {
        document.getElementById("app").innerHTML = "<p>Ошибка загрузки</p>";
        console.error(e);
    }
}

// При первом запуске — открываем Базу товаров
navigateTo("MainMenu");

