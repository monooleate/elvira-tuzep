import { useState } from 'preact/hooks';
import OfferModal from '../widgets/OfferModal';
import Button from './Button.tsx';


export default function ModalWrapper({ product, price, unit, quantity }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>

      <Button variant='primary' class='mt-6' text='Ajánlatkérés' onClick={() => setShowModal(true)}/>
      

      {showModal && (
        <OfferModal
          product={product}
          price={price}
          quantity={quantity}
          unit={unit}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}