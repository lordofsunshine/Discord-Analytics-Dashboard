async function checkAuthentication() {
    if (sessionStorage.getItem('authChecked')) {
        return;
    }

    try {
        const response = await fetch("/api/user");
        if (response.ok) {
            const userData = await response.json();
            if (userData && userData.id) {
                sessionStorage.setItem('authChecked', 'true');
                window.location.href = "/servers";
            }
        }
    } catch (error) {
        console.error("Пользователь не авторизован:", error);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    checkAuthentication();
});

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