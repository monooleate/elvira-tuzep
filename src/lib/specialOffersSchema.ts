// ~/lib/specialOffersSchema.ts

import { getDiscountBadge } from "~/lib/discounts";

export function getProductPrice(product: any) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return Math.min(...product.variants.map(v => v.price));
  }
  return product.price || product.priceFrom || null;
}

export function hasStock(product: any) {
  if (Array.isArray(product.variants) && product.variants.length > 0) {
    return product.variants.some(v => typeof v.stock === 'number' && v.stock > 0);
  }
  return typeof product.stock === 'number' && product.stock > 0;
}

export function buildSpecialOffersItemList(discounted: any[]) {
  if (!discounted || discounted.length === 0) return null;

  // Szűrés: csak érvényes akciók
  const activeDiscounted = discounted.filter((p: any) => {
    if (!p) return false;
    return getDiscountBadge(p).hasDiscount;
  });

  if (activeDiscounted.length === 0) return null;

  const base = "https://elviratuzep.hu";
  const STORE_ID = `${base}/#store`;

  const shippingDetailsHU = {
    "@type": "OfferShippingDetails",
    "shippingRate": { "@type": "MonetaryAmount", "value": 0, "currency": "HUF" },
    "shippingDestination": { "@type": "DefinedRegion", "addressCountry": "HU" },
    "deliveryTime": {
      "@type": "ShippingDeliveryTime",
      "handlingTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 0, "unitCode": "d" },
      "transitTime": { "@type": "QuantitativeValue", "minValue": 0, "maxValue": 4, "unitCode": "d" }
    }
  };

  const merchantReturnPolicyHU = {
    "@type": "MerchantReturnPolicy",
    "applicableCountry": "HU",
    "returnPolicyCategory": "https://schema.org/MerchantReturnFiniteReturnWindow",
    "merchantReturnLink": `${base}/visszakuldes`,
    "returnMethod": "https://schema.org/ReturnInStore",
    "returnFees": "https://schema.org/FreeReturn",
    "returnShippingFeesAmount": { "@type": "MonetaryAmount", "value": "0", "currency": "HUF" },
    "merchantReturnDays": 14,
    "returnWindow": { "@type": "QuantitativeValue", "value": 14, "unitCode": "DAY" },
    "itemCondition": "https://schema.org/NewCondition",
    "restockingFee": { "@type": "MonetaryAmount", "value": "0", "currency": "HUF" },
    "refundType": "https://schema.org/FullRefund",
    "refundProcessingTime": { "@type": "QuantitativeValue", "value": 2, "unitCode": "DAY" }
  };

  function endOfMonthISO(base = new Date()) {
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const yyyy = end.getFullYear();
    const mm = String(end.getMonth() + 1).padStart(2, '0');
    const dd = String(end.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "name": "Akciós termékeink",
    "description": "Aktuális akciós termékek az Elvira Tüzép kínálatából",
    "itemListOrder": "https://schema.org/ItemListOrderDescending",
    "numberOfItems": activeDiscounted.length,
    "itemListElement": activeDiscounted.map((p: any, i: number) => {
      const categorySlug = p?.categorySlug ?? p?.category ?? "egyeb";
      const slug = p?.slug;
      const url = slug ? `${base}/termekek/${categorySlug}/${slug}` : `${base}/termekek`;
      const productId = slug ? `${url}#product` : `${base}/termekek#product-${i}`;

      const basePrice =
        typeof p?.price === "number" ? p.price
        : typeof p?.priceFrom === "number" ? p.priceFrom
        : null;

      const discount = getDiscountBadge(p);

      // schema-ba ár kell, ha nincs basePrice, ne is építsd be
      const finalPrice =
        basePrice !== null && discount.hasDiscount && typeof discount.discountPercent === "number"
          ? Math.round(basePrice * (1 - discount.discountPercent / 100))
          : basePrice;

      const image = p?.image ?? p?.meta?.image ?? p?.images?.[0]?.src ?? null;
      const availability = hasStock(p) 
        ? "https://schema.org/InStock" 
        : "https://schema.org/PreOrder";

      const firstVariant = Array.isArray(p.variants) && p.variants.length > 0 
        ? p.variants[0] 
        : null;

      const priceValidUntil = firstVariant?.discountValidUntil 
        ?? p?.discountValidUntil 
        ?? endOfMonthISO();

      return {
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Product",
          "@id": productId,
          "url": url,
          "name": p?.name ?? "Névtelen termék",
          ...(image ? { "image": image } : {}),
          "description": p?.description || `${p?.name} – akciós ajánlat kedvező áron`,
          "brand": { "@type": "Brand", "name": p?.brandName ?? "Elvira Tüzép" },
          "seller": { "@id": STORE_ID },
          "offers": {
            "@type": "Offer",
            "@id": `${productId}-offer`,
            "price": finalPrice,
            "priceCurrency": "HUF",
            "availability": availability,
            "url": url,
            "itemCondition": "https://schema.org/NewCondition",
            "seller": { "@id": STORE_ID },
            "priceValidUntil": priceValidUntil,
            "shippingDetails": shippingDetailsHU,
            "hasMerchantReturnPolicy": merchantReturnPolicyHU
          }
        }
      };
    })
  };
}