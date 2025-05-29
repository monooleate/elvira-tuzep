import { useState } from 'preact/hooks';
import QuantitySelector from './QuantitySelector.jsx';
import ModalWrapper from '../ui/ModalWrapper.js';

export default function ProductInteractiveBlock({ product }) {
  const [quantity, setQuantity] = useState(1);

  const price = product.discountPrice || (
    product.discountPercent
      ? Math.round(product.price * (1 - product.discountPercent / 100))
      : product.price
  );

  return (
    <>
      <QuantitySelector
        unitPrice={price}
        quantity={quantity}
        setQuantity={setQuantity}
      />
      
      <ModalWrapper
        product={product}
        quantity={quantity}
      />
    </>
  );
}
