// models/Message.ts
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IMessage extends Document {
  room: string; // room name (string) — keep simple
  sender: string;
  message: string;
  createdAt: Date;
}

const MessageSchema: Schema = new Schema({
  room: { type: String, required: true, index: true },
  sender: { type: String, required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const Message: Model<IMessage> =
  (mongoose.models.Message as Model<IMessage>) ||
  mongoose.model<IMessage>("Message", MessageSchema);

  export default Message;