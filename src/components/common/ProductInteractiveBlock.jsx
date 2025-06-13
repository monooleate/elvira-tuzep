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
      
      <ModalWrapper
        product={product}
        price={price}
        quantity={quantity}
        unit={unit}
      />
    </>
  );
}
