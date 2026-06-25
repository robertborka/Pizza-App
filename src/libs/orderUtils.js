import { roundTo, safeNumber } from "./formatters";

export const VALID_ORDER_STATUSES = [
  "Nouă",
  "În pregătire",
  "Pe drum",
  "Livrată",
  "Anulată",
];

export function normalizeOrderStatus(value, fallback = "Nouă") {
  const status = String(value || "").trim();

  if (VALID_ORDER_STATUSES.includes(status)) {
    return status;
  }

  return fallback;
}

export function getOrderProductQuantity(product) {
  const quantity = safeNumber(product?.quantity, 1);

  if (quantity <= 0) {
    return 1;
  }

  return Math.round(quantity);
}

export function getOrderProductUnitPrice(product) {
  const quantity = getOrderProductQuantity(product);
  const directPrice = safeNumber(
    product?.price ?? product?.basePrice ?? product?.unitPrice,
    null
  );

  if (directPrice !== null && directPrice >= 0) {
    return roundTo(directPrice, 2);
  }

  const lineTotal = safeNumber(product?.lineTotal ?? product?.total, null);

  if (lineTotal !== null && lineTotal >= 0) {
    return roundTo(lineTotal / quantity, 2);
  }

  return 0;
}

export function getOrderProductLineTotal(product) {
  const explicitLineTotal = safeNumber(product?.lineTotal ?? product?.total, null);

  if (explicitLineTotal !== null && explicitLineTotal >= 0) {
    return roundTo(explicitLineTotal, 2);
  }

  return roundTo(getOrderProductUnitPrice(product) * getOrderProductQuantity(product), 2);
}

export function normalizeOrderProduct(product = {}) {
  const unitPrice = getOrderProductUnitPrice(product);
  const quantity = getOrderProductQuantity(product);
  const lineTotal = getOrderProductLineTotal({
    ...product,
    price: unitPrice,
    quantity,
  });

  return {
    ...product,
    productId: String(product.productId || product._id || product.id || ""),
    _id: String(product._id || product.productId || product.id || ""),
    name: String(product.name || "Produs").trim() || "Produs",
    description: String(product.description || "").trim(),
    image: product.image || "/pizza.png",
    price: unitPrice,
    basePrice: unitPrice,
    quantity,
    lineTotal,
  };
}

export function normalizeOrderProducts(products) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products.map(normalizeOrderProduct);
}

export function calculateOrderProductsTotal(products) {
  return roundTo(
    normalizeOrderProducts(products).reduce((sum, product) => {
      return sum + getOrderProductLineTotal(product);
    }, 0),
    2
  );
}

export function getOrderTotal(order) {
  const explicitTotal = safeNumber(order?.totalPrice, null);

  if (explicitTotal !== null && explicitTotal > 0) {
    return roundTo(explicitTotal, 2);
  }

  return calculateOrderProductsTotal(order?.products);
}
