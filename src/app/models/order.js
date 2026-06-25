import { model, models, Schema } from "mongoose";

const OrderProductSchema = new Schema(
  {
    productId: {
      type: String,
      default: "",
    },

    _id: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    category: {
      type: Schema.Types.Mixed,
      default: null,
    },

    ingredients: {
      type: Array,
      default: [],
    },

    basePrice: {
      type: Number,
      default: 0,
    },

    price: {
      type: Number,
      default: 0,
    },

    quantity: {
      type: Number,
      default: 1,
    },

    lineTotal: {
      type: Number,
      default: 0,
    },
  },
  { _id: false, strict: false }
);

const DeliveryEstimateSchema = new Schema(
  {
    estimatedDeliveryMinutes: {
      type: Number,
      default: 0,
    },

    preparationMinutes: {
      type: Number,
      default: 0,
    },

    drivingMinutes: {
      type: Number,
      default: 0,
    },

    distanceKm: {
      type: Number,
      default: 0,
    },

    estimatedArrival: {
      type: Date,
      default: null,
    },

    routeSource: {
      type: String,
      default: "",
    },

    routeApproximate: {
      type: Boolean,
      default: false,
    },

    restaurant: {
      type: Schema.Types.Mixed,
      default: null,
    },

    customer: {
      type: Schema.Types.Mixed,
      default: null,
    },

    route: {
      type: Schema.Types.Mixed,
      default: null,
    },

    aiPrediction: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false, strict: false }
);

const OrderSchema = new Schema(
  {
    products: {
      type: [OrderProductSchema],
      default: [],
    },

    totalPrice: {
      type: Number,
      default: 0,
    },

    status: {
      type: String,
      enum: ["Nouă", "În pregătire", "Pe drum", "Livrată", "Anulată"],
      default: "Nouă",
    },

    paid: {
      type: Boolean,
      default: false,
    },

    customerName: {
      type: String,
      default: "",
    },

    phone: {
      type: String,
      default: "",
    },

    city: {
      type: String,
      default: "",
    },

    address: {
      type: String,
      default: "",
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

    notes: {
      type: String,
      default: "",
    },

    userEmail: {
      type: String,
      default: "",
      lowercase: true,
      trim: true,
    },

    deliveryEstimate: {
      type: DeliveryEstimateSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

export const Order = models?.Order || model("Order", OrderSchema);