const net = require("net");

const defultProcess = {
  env: {
    TELNET_MODE_SWITCH: "CTRL+]",
    TELNET_AUTH_METHOD: "NTLM",
    TELNET_LOCAL_ECHO: "off",
    TELNET_NEW_LINE_MODE: "CR & LF",
    TELNET_TERMINAL_MODE: "Console",
    PREFERRED_TERMINAL_TYPE: "ANSI",
  },
};

async function waitForData(socket) {
  return new Promise((resolve) => {
    socket.once("data", (data) => {
      const args = data.toString().split(" ");
      const ip = args[0];
      const port = args[1];
      resolve([ip, port]);
    });
  });
}

async function waitForMessage(socket) {
  return new Promise((resolve, reject) => {
    socket.once("data", (command) => {
      const data = command.toString().trim();
      resolve(data);
    });
  });
}

const server = net.createServer(async (socket) => {
  console.log("Клиент подключен");
  async function handleRequest() {
    const data = await waitForMessage(socket);
    const command = data.toLowerCase();

    switch (command) {
      case "open":
        await handleOpenCommand(socket);
        break;
      case "close":
        console.log("Нет активных подключений");
        break;
      case "quit":
        socket.end("Сервер закрыл соединение");
        break;
      case "display":
        handleDisplayCommand(socket);
        break;
      case "send":
        break;
      case "help":
        socket.write("Поддерживаемыми командами являются: \n\n\n");
        socket.write("close                 закрыть текущее подключениe \n");
        socket.write("display               отобразить параметры операции \n");
        socket.write(
          "open имя_узла [Порт]  подключиться к сайту (по умолчанию, Порт = 23) \n"
        );
        socket.write("quit                  выйти из telnet \n");
        socket.write(
          'set                   установить параметры ("set ?" для вывода их списка) \n'
        );
        socket.write("send                  отправить строки на сервер \n");
        socket.write(
          "status                вывести сведения о текущем состоянии \n"
        );
        socket.write(
          'unset                 сбросить параметры ("unset ?" для вывода их списка) \n'
        );
        socket.write("help                  вывести справку \n");
        break;
      default:
        if (command.startsWith("set")) {
          handleSetCommand(socket, data);
        } else if (command.startsWith("unset")) {
          handleUnsetCommand(socket, data);
        } else if (command.startsWith("send")) {
          const [, data, ...args] = command.split(" ");
          socket.write(`\nОтправлена строка ${data}\n`);
        }
    }
    socket.write("Введите команду для взаимодействия с протоколом telnet: ");
    await handleRequest();
  }

  socket.on("end", () => {
    console.log("Клиент отключился");
  });

  socket.on("error", (err) => {
    console.error("Клиент отключился с ошибкой:", err.message);
  });

  socket.write("Введите команду для взаимодействия с протоколом telnet: ");
  await handleRequest();
});

async function handleOpenCommand(socket) {
  let isConnected = false;
  socket.write("Введите IP-адрес и номер порта (по умолчанию 23): ");
  const [ip, port] = await waitForData(socket);
  const client = new net.Socket();

  client.on("connect", () => {
    isConnected = true;
    console.log(`Подключение к ${ip}:${port}`);
    socket.write(
      "Подключено к серверу. Введите send <Сообщение> для отправки данных.\n"
    );
  });

  client.on("data", (data) => {
    socket.write(data.toString());
  });

  client.on("close", () => {
    isConnected = false;
    console.log(`Соединение с сервером по адресу ${ip}:${port} закрыто`);
    socket.write("Соединение закрыто.\n");
  });

  client.on("error", (err) => {
    isConnected = false;
    console.error("Ошибка подключения к серверу:", err.message);
    socket.write("Не удалось подключиться к серверу из-за ошибки...\n");
  });

  socket.on("data", (data) => {
    if (data.toString().trim() === "status") {
      const statusMessage = isConnected
        ? `Подключение установлено по адресу ${ip}:${port}\n`
        : "Соединение закрыто или еще не установлено.\n";
      socket.write(statusMessage);
    } else if (isConnected) {
      // Обработка остальных команд, когда установлено соединение
      const trimmedData = data.toString().trim();
      const command = trimmedData.split(" ")[0].toLowerCase();
      if (command === "send") {
        const message = trimmedData.substring(trimmedData.indexOf(" ") + 1);
        if (message) {
          client.write(message + "\r\n");
          socket.write("Сообщение отправлено.\n");
        } else {
          socket.write("Не введено сообщение для отправки.\n");
        }
      } else if (command === "close") {
        client.end();
      }
    }
  });

  try {
    client.connect({ port: port || 23, host: ip });
  } catch (err) {
    isConnected = false;
    console.error("Ошибка при подключении к серверу:", err.message);
    socket.write("Не удалось подключиться к серверу из-за ошибки...\n");
    socket.write(
      "Проверьте IP-адрес и порт, который Вы используете для подключения.\n"
    );
  }
}

async function handleDisplayCommand(socket) {
  const modeSwitch = process.env.TELNET_MODE_SWITCH;
  const authMethod = process.env.TELNET_AUTH_METHOD;
  const localEcho = process.env.TELNET_LOCAL_ECHO;
  const newLineMode = process.env.TELNET_NEW_LINE_MODE;
  const terminalMode = process.env.TELNET_TERMINAL_MODE;
  const preferredTerminalType = process.env.PREFERRED_TERMINAL_TYPE;
  socket.write(`Символ переключения режима: '${modeSwitch}\n`);
  socket.write(`Проверка подлинности ${authMethod} - включена \n`);
  socket.write(`Вывод локального эха - ${localEcho}\n`);
  socket.write(
    `Режим новой строки - Символ <ВВОД> будет отправляться как ${newLineMode}\n`
  );
  socket.write(`Текущий режим: ${terminalMode}\n`);
  socket.write("РЕЖИМ ТЕРМИНАЛА \n");
  socket.write(`Предпочитаемый тип терминала ${preferredTerminalType}\n`);
}

async function handleSetCommand(socket, data) {
  const [command, ...args] = data.split(" ");

  if (args.length === 0 || args[0] === "?") {
    socket.write(
      "\nУстановка параметров доступна для следующих переменных: \n"
    );
    socket.write("TELNET_MODE_SWITCH - Символ переключения режима \n");
    socket.write("TELNET_AUTH_METHOD - Метод аутентификации \n");
    socket.write("TELNET_LOCAL_ECHO - Локальный эхо-режим \n");
    socket.write("TELNET_NEW_LINE_MODE - Режим новой строки \n");
    socket.write("TELNET_TERMINAL_MODE - Режим терминала \n");
    socket.write("PREFERRED_TERMINAL_TYPE - Предпочитаемый тип терминала \n");
  } else {
    const variable = args.shift().toUpperCase();
    const value = args.join(" ");

    switch (variable) {
      case "TELNET_MODE_SWITCH":
      case "TELNET_AUTH_METHOD":
      case "TELNET_LOCAL_ECHO":
      case "TELNET_NEW_LINE_MODE":
      case "TELNET_TERMINAL_MODE":
      case "PREFERRED_TERMINAL_TYPE":
        process.env[variable] = value;
        socket.write(`${variable} установлено значение: ${value}\n`);
        break;
      default:
        socket.write(`Неизвестная настройка: ${variable} \n`);
    }
  }
}

async function handleUnsetCommand(socket, data) {
  const [command, variable, ...rest] = data.split(" ");
  if (variable === "?" || !variable) {
    socket.write("nВы можете сбросить следующие переменные: n");
    socket.write("TELNET_MODE_SWITCH - Символ переключения режима n");
    socket.write("TELNET_AUTH_METHOD - Метод аутентификации n");
    socket.write("TELNET_LOCAL_ECHO - Локальный эхо-режим n");
    socket.write("TELNET_NEW_LINE_MODE - Режим новой строки n");
    socket.write("TELNET_TERMINAL_MODE - Режим терминала n");
    socket.write("PREFERRED_TERMINAL_TYPE - Предпочитаемый тип терминала n");
  } else {
    const varToUnset = variable.toUpperCase();
    if (Object.keys(process.env).includes(varToUnset)) {
      process.env[varToUnset] = defultProcess.env[varToUnset];
      socket.write(`Значение переменной ${varToUnset} сброшено. \n`);
    } else {
      socket.write(`Переменная ${varToUnset} не найдена.\n`);
    }
  }
}

server.listen(8080, () => {
  console.log("Сервер слушает порт 8080");
});
