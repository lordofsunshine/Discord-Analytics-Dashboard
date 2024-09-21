const express = require("express");
const https = require("https");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");
const path = require("path");
const cookieParser = require("cookie-parser");
const moment = require("moment");
const NodeCache = require("node-cache");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(express.json());
app.use(cookieParser());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildPresences,
  ],
});

client.login(process.env.DISCORD_BOT_TOKEN);

const analyticsCache = new NodeCache({ stdTTL: 300 });

const isAuthenticated = (req, res, next) => {
  if (req.cookies.discord_access_token) {
    next();
  } else {
    res.redirect("/");
  }
};

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/servers.html", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "servers.html"));
});

app.get("/manage.html", isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "manage.html"));
});

app.get("/api/login", (req, res) => {
  const authorizeUrl = `https://discord.com/api/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.json({ url: authorizeUrl });
});

app.get("/callback", async (req, res) => {
  const { code } = req.query;
  if (code) {
    try {
      const tokenResponse = await exchangeCode(code);
      res.cookie("discord_access_token", tokenResponse.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      res.redirect("/servers.html");
    } catch (error) {
      console.error("Ошибка при обмене кодом:", error);
      res.status(500).send("Не удалось выполнить проверку подлинности");
    }
  } else {
    res.status(400).send("Код не указан");
  }
});

app.get("/api/servers", isAuthenticated, async (req, res) => {
  const accessToken = req.cookies.discord_access_token;
  try {
    const userGuilds = await getUserGuilds(accessToken);
    const botGuilds = client.guilds.cache.map((guild) => guild.id);
    const filteredServers = userGuilds.filter((guild) => {
      const permissions = new PermissionsBitField(BigInt(guild.permissions));
      return (
        guild.owner ||
        permissions.has(PermissionsBitField.Flags.ManageGuild) ||
        permissions.has(PermissionsBitField.Flags.Administrator)
      );
    });
    const servers = await Promise.all(
      filteredServers.map(async (guild) => {
        const botGuild = client.guilds.cache.get(guild.id);
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          hasBot: botGuilds.includes(guild.id),
          memberCount: botGuild ? botGuild.memberCount : "N/A",
        };
      }),
    );
    res.json(servers);
  } catch (error) {
    console.error("Ошибка при выборе серверов:", error);
    res.status(500).json({ error: "Не удалось получить доступ к серверам" });
  }
});

app.get("/api/analytics/:serverId", isAuthenticated, async (req, res) => {
  const { serverId } = req.params;
  const { startDate, endDate } = req.query;
  const cacheKey = `${serverId}_${startDate}_${endDate}`;

  let stats = analyticsCache.get(cacheKey);
  if (stats) {
    return res.json(stats);
  }

  const guild = client.guilds.cache.get(serverId);

  if (!guild) {
    return res
      .status(404)
      .json({ error: "Сервер не найден или бот не является участником." });
  }

  try {
    stats = await getServerStats(guild, moment(startDate), moment(endDate));
    analyticsCache.set(cacheKey, stats);
    res.json(stats);
  } catch (error) {
    console.error("Аналитика выдала ошибку:", error);
    res.status(500).json({
      error: "Не удалось получить аналитические данные",
      details: error.message,
    });
  }
});

app.get("/api/user", isAuthenticated, async (req, res) => {
  const accessToken = req.cookies.discord_access_token;
  try {
    const userData = await getUserData(accessToken);
    res.json(userData);
  } catch (error) {
    console.error("Ошибка при получении пользовательских данных:", error);
    res
      .status(500)
      .json({ error: "Не удалось получить пользовательские данные" });
  }
});

app.get("/api/bot-invite", isAuthenticated, (req, res) => {
  const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${process.env.DISCORD_CLIENT_ID}&permissions=8&scope=bot`;
  res.json({ url: inviteUrl });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie("discord_access_token");
  res.json({ success: true });
});

app.get("/api/roles/:serverId", isAuthenticated, async (req, res) => {
  const { serverId } = req.params;
  const guild = client.guilds.cache.get(serverId);

  if (!guild) {
    return res
      .status(404)
      .json({ error: "Сервер не найден или бот не является участником" });
  }

  try {
    const roles = await guild.roles.fetch();
    const botMember = guild.members.cache.get(client.user.id);
    const rolesData = roles
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        memberCount: role.members.size,
        createdAt: role.createdAt,
        canManage:
          botMember.roles.highest.comparePositionTo(role) > 0 &&
          guild.ownerId !== role.id,
      }))
      .sort((a, b) => b.position - a.position);
    res.json(rolesData);
  } catch (error) {
    console.error("Ошибка при выборе ролей:", error);
    res
      .status(500)
      .json({ error: "Не удалось получить роли", details: error.message });
  }
});

app.delete(
  "/api/roles/:serverId/:roleId",
  isAuthenticated,
  async (req, res) => {
    const { serverId, roleId } = req.params;
    const guild = client.guilds.cache.get(serverId);

    if (!guild) {
      return res
        .status(404)
        .json({ error: "Сервер не найден или бот не является участником" });
    }

    try {
      const role = await guild.roles.fetch(roleId);
      if (!role) {
        return res.status(404).json({ error: "Роль не найдена" });
      }

      await role.delete();
      res.json({ success: true, message: "Роль успешно удалена!" });
    } catch (error) {
      console.error("Ошибка при удалении роли:", error);
      res
        .status(500)
        .json({ error: "Не удалось удалить роль", details: error.message });
    }
  },
);

async function exchangeCode(code) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code: code,
      redirect_uri: process.env.REDIRECT_URI,
    });

    const options = {
      hostname: "discord.com",
      port: 443,
      path: "/api/oauth2/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(JSON.parse(data));
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.write(data.toString());
    req.end();
  });
}

async function getUserGuilds(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "discord.com",
      port: 443,
      path: "/api/users/@me/guilds",
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        resolve(JSON.parse(data));
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getUserData(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "discord.com",
      port: 443,
      path: "/api/users/@me",
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        const userData = JSON.parse(data);
        resolve({
          id: userData.id,
          username: userData.username,
          avatar: userData.avatar
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : null,
        });
      });
    });

    req.on("error", (error) => {
      reject(error);
    });

    req.end();
  });
}

async function getServerStats(guild, startDate, endDate) {
  const stats = {
    messagesPerDay: {},
    topActiveUsers: {},
    activityByHour: {},
    memberGrowth: {},
    activeChannels: {},
    rolesDistribution: {},
    messageTypes: {
      Текст: 0,
      Изображения: 0,
      Видео: 0,
      Файлы: 0,
      Голосовые: 0,
    },
    serverName: guild.name,
  };

  const textChannels = guild.channels.cache.filter(
    (channel) => channel.type === 0,
  );
  const fetchPromises = [];

  for (const channel of textChannels.values()) {
    fetchPromises.push(
      channel.messages
        .fetch({ limit: 100, after: startDate.valueOf() })
        .then((messages) => {
          messages.forEach((msg) => {
            if (msg.createdAt > endDate) return;
            if (msg.author.bot) return;

            const day = moment(msg.createdAt).format("YYYY-MM-DD");
            stats.messagesPerDay[day] = (stats.messagesPerDay[day] || 0) + 1;

            stats.topActiveUsers[msg.author.username] =
              (stats.topActiveUsers[msg.author.username] || 0) + 1;

            const hour = msg.createdAt.getHours();
            stats.activityByHour[hour] = (stats.activityByHour[hour] || 0) + 1;

            stats.activeChannels[channel.name] =
              (stats.activeChannels[channel.name] || 0) + 1;

            if (msg.attachments.size > 0) {
              const attachment = msg.attachments.first();
              if (attachment.contentType?.startsWith("image/")) {
                stats.messageTypes["Изображения"]++;
              } else if (attachment.contentType?.startsWith("video/")) {
                stats.messageTypes["Видео"]++;
              } else {
                stats.messageTypes["Файлы"]++;
              }
            } else if (msg.content.length > 0) {
              stats.messageTypes["Текст"]++;
            }
          });
        })
        .catch((error) => {
          console.error(
            `Ошибка при получении сообщений для канала ${channel.name}:`,
            error,
          );
        }),
    );
  }

  await Promise.allSettled(fetchPromises);

  const guildMembers = await guild.members.fetch();
  guildMembers.forEach((member) => {
    if (member.user.bot) return;
    const joinDay = moment(member.joinedAt).format("YYYY-MM-DD");
    if (moment(joinDay).isBetween(startDate, endDate, null, "[]")) {
      stats.memberGrowth[joinDay] = (stats.memberGrowth[joinDay] || 0) + 1;
    }
  });

  guild.roles.cache.forEach((role) => {
    stats.rolesDistribution[role.name] = role.members.filter(
      (member) => !member.user.bot,
    ).size;
  });

  return stats;
}

app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(port, () => {
  console.log(`Сервер, работающий по адресу http://localhost:${port} запущен!`);
});
