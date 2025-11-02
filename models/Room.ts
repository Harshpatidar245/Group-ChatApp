import mongoose from "mongoose";

const RoomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

const Room = mongoose.models.Room || mongoose.model("Room", RoomSchema);
export default Room;
