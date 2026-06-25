import { model, models, Schema } from "mongoose";

const ChatbotLogSchema = new Schema(
  {
    userEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },

    userName: {
      type: String,
      default: "",
    },

    isAdmin: {
      type: Boolean,
      default: false,
    },

    userMessage: {
      type: String,
      default: "",
    },

    assistantReply: {
      type: String,
      default: "",
    },

    intent: {
      type: String,
      default: "",
    },

    aiUsed: {
      type: Boolean,
      default: false,
    },

    source: {
      type: String,
      default: "",
    },

    suggestedProducts: {
      type: Array,
      default: [],
    },

    cartProductsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const ChatbotLog =
  models?.ChatbotLog || model("ChatbotLog", ChatbotLogSchema);