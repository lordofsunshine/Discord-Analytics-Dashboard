document.addEventListener("DOMContentLoaded", function () {
    const urlParams = new URLSearchParams(window.location.search);
    const serverId = urlParams.get("id");
    let dateRange = "today";
    let analyticsData = null;
    let currentPage = 1;
    const rolesPerPage = 10;

    const chartColors = {
        blue: "rgba(59, 130, 246, 0.8)",
        lightBlue: "rgba(147, 197, 253, 0.8)",
        green: "rgba(16, 185, 129, 0.8)",
        red: "rgba(239, 68, 68, 0.8)",
        yellow: "rgba(245, 158, 11, 0.8)",
    };

    const charts = {
        channelEngagement: createChart("channel-engagement-chart", "bar"),
        topActiveUsers: createChart("users-chart", "bar"),
        activityByHour: createChart("activity-chart", "line"),
        memberGrowth: createChart("growth-chart", "line"),
        messageTypes: createChart("message-type-chart", "doughnut"),
        rolesDistribution: createChart("roles-chart", "pie"),
    };

    document
        .getElementById("today")
        ?.addEventListener("click", () => setDateRange("today"));
    document
        .getElementById("this-month")
        ?.addEventListener("click", () => setDateRange("this-month"));
    document
        .getElementById("custom-date-input")
        ?.addEventListener("change", handleCustomDateChange);

    document
        .getElementById("search-form")
        ?.addEventListener("submit", function (e) {
            e.preventDefault();
            handleSearch();
        });
    document
        .getElementById("search-input")
        ?.addEventListener("input", handleSearch);

    document
        .getElementById("overview-link")
        ?.addEventListener("click", showOverview);
    document.getElementById("roles-link")?.addEventListener("click", showRoles);

    document
        .getElementById("back-button")
        ?.addEventListener("click", () => window.history.back());
    document
        .getElementById("roles-back-button")
        ?.addEventListener("click", showOverview);

    const modal = document.getElementById("delete-modal");
    const cancelDelete = document.getElementById("cancel-delete");
    const confirmDelete = document.getElementById("confirm-delete");
    let currentRoleId = null;

    cancelDelete?.addEventListener("click", closeModal);
    confirmDelete?.addEventListener("click", deleteRole);

    fetchUserData();

    function setDateRange(range) {
        dateRange = range;
        document
            .querySelectorAll("#today, #this-month, #custom-date-input")
            .forEach((el) =>
                el.classList.remove("bg-blue-500", "text-white", "active"),
            );
        if (range === "today" || range === "this-month") {
            document
                .getElementById(range)
                ?.classList.add("bg-blue-500", "text-white");
        } else {
            document
                .getElementById("custom-date-input")
                ?.classList.add("active");
        }
        fetchAnalytics();
    }

    function handleCustomDateChange(event) {
        const selectedDate = event.target.value;
        setDateRange(selectedDate);
    }

    function handleSearch() {
        const searchTerm =
            document.getElementById("search-input")?.value.toLowerCase() || "";
        if (!analyticsData) return;

        const filteredData = {
            activeChannels: filterObject(
                analyticsData.activeChannels,
                searchTerm,
            ),
            topActiveUsers: filterObject(
                analyticsData.topActiveUsers,
                searchTerm,
            ),
            activityByHour: filterObject(
                analyticsData.activityByHour,
                searchTerm,
            ),
            memberGrowth: filterObject(analyticsData.memberGrowth, searchTerm),
            rolesDistribution: filterObject(
                analyticsData.rolesDistribution,
                searchTerm,
            ),
            messageTypes: filterObject(analyticsData.messageTypes, searchTerm),
        };

        updateAnalytics(filteredData);

        if (document.getElementById("roles-content").style.display !== "none") {
            const rolesTableBody = document.getElementById("roles-table-body");
            const rows = rolesTableBody?.getElementsByTagName("tr") || [];
            for (let row of rows) {
                const roleName =
                    row
                        .getElementsByTagName("td")[0]
                        ?.textContent.toLowerCase() || "";
                if (roleName.includes(searchTerm)) {
                    row.style.display = "";
                } else {
                    row.style.display = "none";
                }
            }
        }
    }

    function filterObject(obj, searchTerm) {
        return Object.fromEntries(
            Object.entries(obj).filter(([key]) =>
                key.toLowerCase().includes(searchTerm),
            ),
        );
    }

    async function fetchAnalytics() {
        const now = new Date();
        let startDate, endDate;

        switch (dateRange) {
            case "today":
                startDate = new Date(now.setHours(0, 0, 0, 0));
                endDate = new Date();
                break;
            case "this-month":
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date();
                break;
            default:
                startDate = new Date(dateRange);
                endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 1);
                break;
        }

        showLoaders();

        try {
            const response = await fetch(
                `/api/analytics/${serverId}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
            );
            if (!response.ok) {
                if (response.status === 404) {
                    alert(
                        "Сервер не найден, или бот не является участником этого сервера.",
                    );
                    window.location.href = "/servers.html";
                    return;
                }
                throw new Error("Не удалось получить аналитические данные");
            }
            analyticsData = await response.json();
            updateAnalytics(analyticsData);
        } catch (error) {
            console.error("Аналитика выдала ошибку:", error);
            const errorMessage = document.getElementById("error-message");
            if (errorMessage) {
                errorMessage.textContent =
                    "Не удалось получить аналитические данные. Пожалуйста, повторите попытку позже.";
                errorMessage.style.display = "block";
            }
        } finally {
            hideLoaders();
        }
    }

    function updateAnalytics(data) {
        const sortedChannels = Object.entries(data.activeChannels).sort(
            (a, b) => b[1] - a[1],
        );
        const mostActiveChannel = sortedChannels[0];
        const mostActiveChannelElement = document.getElementById(
            "most-active-channel",
        );
        if (mostActiveChannelElement) {
            mostActiveChannelElement.textContent = mostActiveChannel
                ? mostActiveChannel[0]
                : "-";
        }
        updateChart(
            charts.channelEngagement,
            formatChartData(data.activeChannels, 5),
            "bar",
        );

        updateChart(
            charts.topActiveUsers,
            formatChartData(data.topActiveUsers, 10),
            "bar",
        );

        updateChart(
            charts.activityByHour,
            formatChartData(data.activityByHour),
            "line",
        );
        const peakHour = Object.entries(data.activityByHour).reduce((a, b) =>
            a[1] > b[1] ? a : b,
        )[0];
        const peakHoursElement = document.getElementById("peak-hours");
        if (peakHoursElement) {
            peakHoursElement.textContent = `${peakHour}:00 - ${(parseInt(peakHour) + 1) % 24}:00`;
        }

        const totalMembers = Object.values(data.memberGrowth).reduce(
            (a, b) => a + b,
            0,
        );
        const memberCountElement = document.getElementById("member-count");
        if (memberCountElement) {
            memberCountElement.textContent = `${totalMembers} участников`;
        }
        updateChart(
            charts.memberGrowth,
            formatChartData(data.memberGrowth),
            "line",
        );

        updateChart(
            charts.messageTypes,
            formatChartData(data.messageTypes),
            "doughnut",
        );

        updateChart(
            charts.rolesDistribution,
            formatChartData(data.rolesDistribution, 5),
            "pie",
        );

        updateServerTitle(data.serverName);
    }

    function updateServerTitle(serverName) {
        const serverTitleElement = document.getElementById("server-title");
        if (serverTitleElement && serverName) {
            if (serverName.length > 20) {
                serverTitleElement.textContent =
                    serverName.substring(0, 20) + "...";
                serverTitleElement.title = serverName;
            } else {
                serverTitleElement.textContent = serverName;
            }
        }
    }

    function formatChartData(data, limit = null) {
        let sortedData = Object.entries(data).sort((a, b) => b[1] - a[1]);
        if (limit) sortedData = sortedData.slice(0, limit);
        return {
            labels: sortedData.map(([key]) => key),
            datasets: [
                {
                    data: sortedData.map(([, value]) => value),
                    backgroundColor: Object.values(chartColors),
                    borderColor: Object.values(chartColors).map((color) =>
                        color.replace("0.8", "1"),
                    ),
                    borderWidth: 1,
                },
            ],
        };
    }

    function createChart(canvasId, type) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error(`Canvas с ID ${canvasId} не был найден.`);
            return null;
        }
        const ctx = canvas.getContext("2d");
        return new Chart(ctx, {
            type: type,
            data: {
                labels: [],
                datasets: [
                    {
                        data: [],
                        backgroundColor: Object.values(chartColors),
                        borderColor: Object.values(chartColors).map((color) =>
                            color.replace("0.8", "1"),
                        ),
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                },
                scales:
                    type !== "pie" && type !== "doughnut"
                        ? {
                              x: {
                                  display: true,
                                  grid: {
                                      display: false,
                                  },
                              },
                              y: {
                                  display: true,
                                  beginAtZero: true,
                                  grid: {
                                      display: false,
                                  },
                              },
                          }
                        : {},
            },
        });
    }

    function updateChart(chart, newData, type) {
        if (!chart) return;
        chart.data.labels = newData.labels;
        chart.data.datasets[0].data = newData.datasets[0].data;
        chart.config.type = type;
        chart.update();
    }

    function showLoaders() {
        document.querySelectorAll(".loader").forEach((loader) => {
            loader.style.display = "block";
        });
    }

    function hideLoaders() {
        document.querySelectorAll(".loader").forEach((loader) => {
            loader.style.display = "none";
        });
    }

    function showOverview() {
        document.getElementById("overview-content").style.display = "block";
        document.getElementById("roles-content").style.display = "none";
        document.getElementById("overview-link")?.classList.add("bg-gray-100");
        document.getElementById("roles-link")?.classList.remove("bg-gray-100");
    }

    async function showRoles() {
        document.getElementById("overview-content").style.display = "none";
        document.getElementById("roles-content").style.display = "block";
        document
            .getElementById("overview-link")
            ?.classList.remove("bg-gray-100");
        document.getElementById("roles-link")?.classList.add("bg-gray-100");

        const rolesLoader = document.getElementById("roles-loader");
        if (rolesLoader) rolesLoader.style.display = "block";

        try {
            const response = await fetch(`/api/roles/${serverId}`);
            if (!response.ok) throw new Error("Не удалось получить роли.");
            const roles = await response.json();
            displayRoles(roles);
        } catch (error) {
            console.error("Ошибка при выборе ролей:", error);
            const errorMessage = document.getElementById("error-message");
            if (errorMessage) {
                errorMessage.textContent =
                    "Не удалось получить роли. Пожалуйста, повторите попытку позже.";
                errorMessage.style.display = "block";
            }
        } finally {
            if (rolesLoader) rolesLoader.style.display = "none";
        }
    }

    function displayRoles(roles) {
        const rolesTableBody = document.getElementById("roles-table-body");
        if (!rolesTableBody) return;

        rolesTableBody.innerHTML = "";

        roles.sort((a, b) => {
            if (a.canManage && !b.canManage) return -1;
            if (!a.canManage && b.canManage) return 1;
            return 0;
        });

        const startIndex = (currentPage - 1) * rolesPerPage;
        const endIndex = startIndex + rolesPerPage;
        const paginatedRoles = roles.slice(startIndex, endIndex);

        paginatedRoles.forEach((role) => {
            const row = document.createElement("tr");
            row.className =
                "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted";
            row.innerHTML = `
        <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
          <div class="flex items-center gap-2">
            <div class="h-4 w-4 rounded-full" style="background-color: ${role.color}"></div>
            ${role.name}
          </div>
        </td>
        <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">${role.memberCount}</td>
        <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">${formatDate(role.createdAt)}</td>
        <td class="p-4 align-middle [&:has([role=checkbox])]:pr-0">
          <div class="flex gap-2">
            <button class="delete-role inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" ${role.canManage ? "" : "disabled"} data-role-id="${role.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
              </svg>
              <span class="sr-only">Удалить</span>
            </button>
          </div>
        </td>
      `;
            rolesTableBody.appendChild(row);
        });

        document.querySelectorAll(".delete-role").forEach((button) => {
            button.addEventListener("click", function () {
                currentRoleId = this.getAttribute("data-role-id");
                openModal();
            });
        });

        updatePagination(roles.length);
    }

    function updatePagination(totalRoles) {
        const totalPages = Math.ceil(totalRoles / rolesPerPage);
        const paginationContainer = document.getElementById(
            "pagination-container",
        );
        paginationContainer.innerHTML = "";

        if (totalPages > 1) {
            const prevButton = createPaginationButton(
                "Предыдущая",
                currentPage > 1,
                () => {
                    if (currentPage > 1) {
                        currentPage--;
                        showRoles();
                    }
                },
            );
            paginationContainer.appendChild(prevButton);

            for (let i = 1; i <= totalPages; i++) {
                const pageButton = createPaginationButton(
                    i.toString(),
                    true,
                    () => {
                        currentPage = i;
                        showRoles();
                    },
                );
                if (i === currentPage) {
                    pageButton.classList.add("active-btn");
                }
                paginationContainer.appendChild(pageButton);
            }

            const nextButton = createPaginationButton(
                "Следующая",
                currentPage < totalPages,
                () => {
                    if (currentPage < totalPages) {
                        currentPage++;
                        showRoles();
                    }
                },
            );
            paginationContainer.appendChild(nextButton);
        }
    }

    function createPaginationButton(text, enabled, onClick) {
        const button = document.createElement("button");
        button.textContent = text;
        button.className = `pagination-button ${enabled ? "" : "disabled"}`;
        button.disabled = !enabled;
        button.addEventListener("click", onClick);
        return button;
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now - date);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            const hours = Math.floor(diffTime / (1000 * 60 * 60));
            if (hours === 0) {
                const minutes = Math.floor(diffTime / (1000 * 60));
                return `${minutes} ${minutes === 1 ? "минуту" : "минут"} назад`;
            }
            return `${hours} ${hours === 1 ? "час" : "часа"} назад`;
        } else if (diffDays === 1) {
            return "Вчера";
        } else if (diffDays < 7) {
            return `${diffDays} ${diffDays === 1 ? "день" : "дня"} назад`;
        } else if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks} ${weeks === 1 ? "неделю" : "недели"} назад`;
        } else if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `${months} ${months === 1 ? "месяц" : "месяца"} назад`;
        } else {
            const years = Math.floor(diffDays / 365);
            return `${years} ${years === 1 ? "год" : "года"} назад`;
        }
    }

    function openModal() {
        const modal = document.querySelector(".modal");
        modal.classList.add("show");
        modal.style.display = "block";
        modal.style.animation = "fadeIn 0.3s ease";
    }

    function closeModal() {
        const modal = document.querySelector(".modal");
        modal.style.animation = "fadeOut 0.3s ease";
        setTimeout(() => {
            modal.classList.remove("show");
            modal.style.display = "none";
        }, 300);
    }

    async function deleteRole() {
        if (!currentRoleId) return;

        try {
            const response = await fetch(
                `/api/roles/${serverId}/${currentRoleId}`,
                {
                    method: "DELETE",
                },
            );

            if (!response.ok) {
                throw new Error("Не удалось удалить роль.");
            }

            await showRoles();
            closeModal();
        } catch (error) {
            console.error("Ошибка при удалении роли:", error);
            alert("Не удалось удалить роль. Пожалуйста, попробуйте снова.");
        }
    }

    async function fetchUserData() {
        try {
            const response = await fetch("/api/user");
            if (!response.ok) {
                throw new Error("Не удалось получить пользовательские данные.");
            }
            const userData = await response.json();
            updateUserAvatar(userData.avatar);
        } catch (error) {
            console.error(
                "Ошибка при получении пользовательских данных:",
                error,
            );
        }
    }

    function updateUserAvatar(avatarUrl) {
        const userAvatar = document.getElementById("user-avatar");
        if (userAvatar && avatarUrl) {
            userAvatar.src = avatarUrl;
        }
    }

    fetchAnalytics();
});

// <button class="edit-role inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10" ${role.canManage ? "" : "disabled"}>
// <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">
// <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
// <path d="m15 5 4 4"></path>
// </svg>
// <span class="sr-only">Изменить</span>
// </button>
