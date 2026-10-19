const { PeerServer } = require("peer");

const port = Number(process.env.PORT) || 9000;

const server = PeerServer({
  port,
  path: "/peerjs",
  proxied: true,
  allow_discovery: false
});

server.on("connection", client => {
  console.log("Connected:", client.getId());
});

server.on("disconnect", client => {
  console.log("Disconnected:", client.getId());
});

console.log(`PeerJS server started on port ${port}`);
