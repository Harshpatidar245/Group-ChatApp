// "use client";
// import { io } from "socket.io-client";

// export const socket = io("http://localhost:3000", {
//   transports: ["websocket"],
// });

// lib/socketClient.ts
import { io } from "socket.io-client";

// Connect to same origin the page was served from.
// This avoids localhost hardcoding and works in prod/dev.
export const socket = io({
  transports: ["websocket"],
  // no URL -> connect to current origin
});
