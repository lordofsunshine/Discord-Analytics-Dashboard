async function fetchUserInfo() {
    try {
        const response = await fetch("/api/user");
        if (!response.ok) {
            throw new Error("Не удалось получить пользовательские данные");
        }
        const userData = await response.json();
        document.getElementById("user-avatar").src =
            userData.avatar ||
            "https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/636e0a6918e57475a843f59f_icon_clyde_black_RGB.svg";
        document.getElementById("user-nickname").textContent =
            userData.username;
    } catch (error) {
        console.error("Ошибка при получении информации о пользователе:", error);
        document.getElementById("user-nickname").textContent = "Ошибка...";
    }
}

const handleError = (error, message) => {
    console.error(message, error);
    alert(message);
};

const setLoading = (isLoading) => {
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.display = isLoading ? 'block' : 'none';
    }
};

async function fetchServers(попытки = 3) {
    setLoading(true);

    try {
        for (let i = 0; i < попытки; i++) {
            try {
                const response = await fetch("/api/servers");
                if (!response.ok) throw new Error(response.statusText);

                const servers = await response.json();
                renderServers(servers);
                break;
            } catch (error) {
                if (i === попытки - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    } catch (error) {
        handleError(error, "Не удалось загрузить серверы. Пожалуйста, попробуйте войти снова.");
    } finally {
        setLoading(false);
    }
}

const sanitizeHTML = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

function renderServers(servers) {
    const serverList = document.getElementById("server-list");
    if (!serverList) return;

    serverList.innerHTML = "";

    servers.forEach((server, index) => {
        const serverCard = document.createElement("div");
        serverCard.className = "server-card";
        serverCard.style.opacity = "0";
        serverCard.style.transform = "translateY(20px)";

        const serverName = sanitizeHTML(server.name);
        const memberCount = parseInt(server.memberCount) || 0;

        serverCard.innerHTML = `
            <div class="server-card-header ${index === 0 ? "primary" : "secondary"}">
                <div class="server-icon">
                    ${server.icon 
                        ? `<img loading="lazy" style="border-radius: 50%" src="https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png" alt="${serverName}" width="64" height="64">` 
                        : `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
                        <path fill="currentColor" d="M19.27 5.33C17.94 4.71 16.5 4.26 15 4a.1.1 0 0 0-.07.03c-.18.33-.39.76-.53 1.09a16.1 16.1 0 0 0-4.8 0c-.14-.34-.35-.76-.54-1.09c-.01-.02-.04-.03-.07-.03c-1.5.26-2.93.71-4.27 1.33c-.01 0-.02.01-.03.02c-2.72 4.07-3.47 8.03-3.1 11.95c0 .02.01.04.03.05c1.8 1.32 3.53 2.12 5.24 2.65c.03.01.06 0 .07-.02c.4-.55.76-1.13 1.07-1.74c.02-.04 0-.08-.04-.09c-.57-.22-1.11-.48-1.64-.78c-.04-.02-.04-.08-.01-.11c.11-.08.22-.17.33-.25c.02-.02.05-.02.07-.01c3.44 1.57 7.15 1.57 10.55 0c.02-.01.05-.01.07.01c.11.09.22.17.33.26c.04.03.04.09-.01.11c-.52.31-1.07.56-1.64.78c-.04.01-.05.06-.04.09c.32.61.68 1.19 1.07 1.74c.03.01.06.02.09.01c1.72-.53 3.45-1.33 5.25-2.65c.02-.01.03-.03.03-.05c.44-4.53-.73-8.46-3.1-11.95c-.01-.01-.02-.02-.04-.02M8.52 14.91c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.84 2.12-1.89 2.12m6.97 0c-1.03 0-1.89-.95-1.89-2.12s.84-2.12 1.89-2.12c1.06 0 1.9.96 1.89 2.12c0 1.17-.83 2.12-1.89 2.12" />
                    </svg>`
                    }
                </div>
            </div>
            <div class="server-info">
                <h3 class="server-name">${serverName}</h3>
                <p class="server-members">
                    ${server.hasBot ? `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    ${memberCount.toLocaleString()} участников
                    ` : `
                        <svg xmlns="http://www.w3.org/2000/svg" width="16px" height="16px" viewBox="0 0 32 32">
                            <rect width="32" height="32" fill="none" />
                            <path fill="currentColor" d="M18 10h2v2h-2zm-6 0h2v2h-2z" />
                            <path fill="currentColor" d="M26 20h-5v-2h1a2 2 0 0 0 2-2v-4h2v-2h-2V8a2 2 0 0 0-2-2h-2V2h-2v4h-4V2h-2v4h-2a2 2 0 0 0-2 2v2H6v2h2v4a2 2 0 0 0 2 2h1v2H6a2 2 0 0 0-2 2v8h2v-8h20v8h2v-8a2 2 0 0 0-2-2M10 8h12v8H10Zm3 10h6v2h-6Z" />
                        </svg>
                        Добавить бота
                    `}
                </p>
            </div>
        `;
        serverCard.addEventListener("click", () => {
            if (server.hasBot) {
                window.location.href = `/manage?id=${server.id}`;
            } else {
                inviteBot(server.id);
            }
        });
        serverList.appendChild(serverCard);

        setTimeout(() => {
            serverCard.style.transition =
                "opacity 0.5s ease, transform 0.5s ease";
            serverCard.style.opacity = "1";
            serverCard.style.transform = "translateY(0)";
        }, index * 100);
    });
}

async function inviteBot(serverId) {
    try {
        const response = await fetch("/api/bot-invite");
        if (!response.ok) {
            throw new Error("Не удалось получить URL-адрес приглашения бота");
        }
        const data = await response.json();
        const inviteUrl = `${data.url}&guild_id=${serverId}&disable_guild_select=true`;
        const inviteWindow = window.open(
            inviteUrl,
            "DiscordInvite",
            "width=500,height=700",
        );

        let checkCount = 0;
        const maxChecks = 60;

        const checkBotStatus = setInterval(async () => {
            checkCount++;

            if (inviteWindow.closed || checkCount >= maxChecks) {
                clearInterval(checkBotStatus);
                if (checkCount >= maxChecks) {
                    inviteWindow.close();
                }
            }

            try {
                const response = await fetch("/api/servers");
                if (response.ok) {
                    const servers = await response.json();
                    const server = servers.find(s => s.id === serverId);

                    if (server && server.hasBot) {
                        clearInterval(checkBotStatus);
                        inviteWindow.close();
                        window.location.href = `/manage?id=${serverId}`;
                    }
                }
            } catch (error) {
                console.error("Ошибка при проверке статуса бота:", error);
            }
        }, 2000);
    } catch (error) {
        console.error("Ошибка при приглашении бота:", error);
        alert(
            "Не удалось пригласить бота. Пожалуйста, повторите попытку позже.",
        );
    }
}

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

const handleSearch = debounce((event) => {
    const searchTerm = event.target.value.toLowerCase();
    const serverCards = document.querySelectorAll('.server-card');

    serverCards.forEach(card => {
        const serverName = card.querySelector('.server-name').textContent.toLowerCase();
        card.style.display = serverName.includes(searchTerm) ? 'block' : 'none';
    });
}, 300);

const addEventListeners = () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    return () => {
        if (searchInput) {
            searchInput.removeEventListener('input', handleSearch);
        }
    };
};

document.addEventListener('DOMContentLoaded', () => {
    const cleanup = addEventListeners();
    fetchUserInfo();
    fetchServers();

    window.addEventListener('unload', cleanup);
});

window.addEventListener("load", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const guildId = urlParams.get("guild_id");
    if (guildId) {
        window.location.href = `/manage?id=${guildId}`;
    }
});

if (window.opener && window.opener !== window) {
    window.opener.postMessage({
            type: "DISCORD_BOT_ADDED"
        },
        window.location.origin,
    );
}

document.getElementById("logout-option").addEventListener("click", async () => {
    try {
        const response = await fetch("/api/logout", {
            method: "POST"
        });
        if (response.ok) {
            sessionStorage.removeItem('authChecked');
            window.location.href = "/";
        } else {
            throw new Error("Не удалось выйти из системы");
        }
    } catch (error) {
        console.error("Ошибка при выходе из системы:", error);
        alert("Не удалось выйти из системы. Пожалуйста, попробуйте снова.");
    }
});