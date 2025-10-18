import { useState } from 'preact/hooks';
import QuantitySelector from './QuantitySelector.jsx';
import ModalWrapper from '../ui/ModalWrapper.js';

export default function ProductInteractiveBlock({ product }) {
  const [quantity, setQuantity] = useState(1);
  

  function resolveFinalPrice(product) {
    const now = new Date();

    // Segédfüggvény, ami megmondja, hogy a discount dátuma még érvényes-e
    const isValidDiscount = (dateStr) => {
      if (!dateStr) return true; // ha nincs dátum megadva, tekintsük érvényesnek
      const discountDate = new Date(dateStr);
      return discountDate > now; // csak ha jövőbeni a dátum
    };

    const candidates = [
      {
        base: product.price,
        discount: product.discountPrice,
        validUntil: product.discountValidUntil,
        unit: "Ft/db",
      },
      {
        base: product.mprice,
        discount: product.discountMPrice,
        validUntil: product.discountValidUntil,
        unit: "Ft/m",
      },
      {
        base: product.m2price,
        discount: product.discountM2Price,
        validUntil: product.discountValidUntil,
        unit: "Ft/m²",
      },
      {
        base: product.m3price,
        discount: product.discountM3Price,
        validUntil: product.discountValidUntil,
        unit: "Ft/m³",
      },
      {
        base: product.palprice,
        discount: product.discountPalPrice,
        validUntil: product.discountValidUntil,
        unit: "Ft/raklap",
      },
    ];

    for (const c of candidates) {
      if (c.base != null && c.base > 0) {
        const discountActive =
          c.discount != null && c.discount < c.base && isValidDiscount(c.validUntil);
        const finalPrice = discountActive ? c.discount : c.base;
        return {
          price: finalPrice,
          unit: c.unit,
          hasDiscount: discountActive,
        };
      }
    }

    return { price: null, unit: "", hasDiscount: false };
  }

let { price, unit} = resolveFinalPrice(product);



  return (
    <>
      <QuantitySelector
        unitPrice={price}
        quantity={quantity}
        unit={unit}
        setQuantity={setQuantity}
      />

    <p class="text-xs text-gray-500 mt-4">
      Az árváltozás jogát fenntartjuk. Az ajánlatkéréskori ár nem garantált.
    </p>

      
      <ModalWrapper
        product={product}
        price={price}
        quantity={quantity}
        unit={unit}
      />
    </>
  );
}
