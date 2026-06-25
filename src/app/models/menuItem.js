import { model, models, Schema } from "mongoose";

const MenuItemSchema = new Schema(
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

    description: {
      type: String,
      default: "",
    },

    basePrice: {
      type: Number,
      default: 0,
    },

    price: {
      type: Number,
      default: 0,
    },

    image: {
      type: String,
      default: "",
    },

    available: {
      type: Boolean,
      default: true,
    },

    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    ingredients: [
      {
        type: Schema.Types.ObjectId,
        ref: "Ingredient",
      },
    ],

    sizes: {
      type: Array,
      default: [],
    },

    extraIngredientPrices: {
      type: Array,
      default: [],
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const MenuItem =
  models?.MenuItem || model("MenuItem", MenuItemSchema);