import { model, models, Schema } from "mongoose";

const CategorySchema = new Schema(
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
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const Category = models?.Category || model("Category", CategorySchema);