document.getElementById("login-button").addEventListener("click", async () => {
    try {
        const response = await fetch("/api/login");
        const data = await response.json();
        window.location.href = data.url;
    } catch (error) {
        console.error("Ошибка при входе в систему:", error);
        alert(
            "Не удалось произвести вход в систему. Пожалуйста, попробуйте снова.",
        );
    }
});
