import { model, models, Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: {
      type: String,
      default: "",
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      default: "",
    },

    googleId: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    admin: {
      type: Boolean,
      default: false,
    },

    phone: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "Brașov",
    },

    street: {
      type: String,
      default: "",
    },

    streetNumber: {
      type: String,
      default: "",
    },

    building: {
      type: String,
      default: "",
    },

    entrance: {
      type: String,
      default: "",
    },

    floor: {
      type: String,
      default: "",
    },

    apartment: {
      type: String,
      default: "",
    },

    defaultNotes: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const User = models?.User || model("User", UserSchema);