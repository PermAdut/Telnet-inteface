const net = require("net");

const client = new net.Socket();

client.connect(8080,() => {
  console.log("Connected to server");
});

client.on("error", (err) => {
  console.error("Error:", err.message);
  client.end();
  process.stdin.pause();
});

client.on("close", () => {
  console.log("Connection closed");
  client.end();
  process.stdin.end();
});

client.on("data", (data) => {
  console.log(data.toString());
});

// Обработка ввода данных от пользователя
process.stdin.on("data", (input) => {
  // Отправляем данные на сервер
  client.write(input);
});
