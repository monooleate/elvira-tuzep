import { useState } from 'preact/hooks';
import QuantitySelector from './QuantitySelector.jsx';
import ModalWrapper from '../ui/ModalWrapper.js';

export default function ProductInteractiveBlock({ product }) {
  const [quantity, setQuantity] = useState(1);
  const info = product?.priceInfo;
  const price = info?.final ?? null;
  const unit = info?.unitLabel ?? "";



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
