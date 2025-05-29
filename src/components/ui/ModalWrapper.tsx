import { useState } from 'preact/hooks';
import OfferModal from '../widgets/OfferModal';

export default function ModalWrapper({ product, quantity }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        class="mt-4 px-4 py-2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800 font-semibold transition"
        onClick={() => setShowModal(true)}
      >
        Rendelési szándék beküldése
      </button>
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