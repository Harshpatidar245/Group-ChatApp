
import { io } from "socket.io-client";

export const socket = io({
  transports: ["websocket"],
  // no URL -> connect to current origin
});
