import { useState } from 'preact/hooks';
import OfferModal from '../widgets/OfferModal';
import Button from './Button.tsx';


export default function ModalWrapper({ product, quantity }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>

      <Button variant='primary' class='mt-6' text='Ajánlatkérés' onClick={() => setShowModal(true)}/>
      

      {showModal && (
        <OfferModal
          product={product}
          quantity={quantity}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}