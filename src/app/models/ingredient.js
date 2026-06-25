import { model, models, Schema } from "mongoose";

const IngredientSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      trim: true,
      index: true,
    },

    image: {
      type: String,
      default: "",
    },

    aliases: {
      type: Array,
      default: [],
    },

    price: {
      type: Number,
      default: 0,
    },

    extraPrice: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const Ingredient =
  models?.Ingredient || model("Ingredient", IngredientSchema);