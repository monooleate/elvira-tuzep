import { useState } from 'preact/hooks';
import QuantitySelector from './QuantitySelector.jsx';
import ModalWrapper from '../ui/ModalWrapper.js';

export default function ProductInteractiveBlock({ product }) {
  const [quantity, setQuantity] = useState(1);
  
  let basePrice = product.price;
  let unit = 'darab';

  if (!basePrice || basePrice === 0) {
    if (product.m2price && product.m2price > 0) {
      basePrice = product.m2price;
      unit = 'm²';
    } else if (product.m3price && product.m3price > 0) {
      basePrice = product.m3price;
      unit = 'm³';
    } else if (product.mprice && product.mprice > 0) {
      basePrice = product.mprice;
      unit = 'm';
    } else if (product.palprice && product.palprice > 0) {
      basePrice = product.palprice;
      unit = 'raklap';
    }
  }

  const price = product.discountPrice || (
    product.discountPercent
      ? Math.round(basePrice * (1 - product.discountPercent / 100))
      : basePrice
  );


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
