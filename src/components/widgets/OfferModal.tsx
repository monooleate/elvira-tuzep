import { useState } from 'preact/hooks';

export default function OfferModal({ product, quantity, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      name,
      email,
      phone,
      message,
      quantity,
      product: {
        name: product.name,
        slug: product.slug,
        price: product.discountPrice || product.price,
        sku: product.sku,
      }
    };

    try {
      const response = await fetch('/api/offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
      } else {
        alert("Hiba történt: " + (result.error || "Ismeretlen hiba"));
      }
    } catch (err) {
      alert("Hiba a kérés közben: " + err.message);
    }
  };

  return (
    <div class="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div class="bg-white dark:bg-gray-900 p-6 rounded shadow-lg max-w-md w-full relative">
        <button onClick={onClose} class="absolute top-2 right-2 text-gray-500 hover:text-black dark:hover:text-white">✖</button>

        {submitted ? (
          <div class="text-green-600 text-center font-semibold">
            Köszönjük, az ajánlatkérés elküldve!
          </div>
        ) : (
          <form onSubmit={handleSubmit} class="space-y-4">
            <h2 class="text-lg font-bold mb-2">Ajánlatot kérek</h2>

            <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200 mb-3">
              <div><strong>Termék:</strong> {product.name}</div>
              <div><strong>Cikkszám:</strong> {product.sku}</div>
              <div><strong>Darabszám:</strong> {quantity} db</div>
              <div><strong>Egységár:</strong> {product.price} Ft</div>
              <div>
  <strong>Ajánlat ára:</strong> {(quantity * product.price).toLocaleString()} Ft
</div>
            </div>

            <input type="text" required placeholder="Név" class="w-full p-2 border rounded"
              value={name} onInput={(e) => setName(e.target.value)} />
            <input type="email" required placeholder="Email" class="w-full p-2 border rounded"
              value={email} onInput={(e) => setEmail(e.target.value)} />
            <input type="tel" placeholder="Telefonszám" class="w-full p-2 border rounded"
              value={phone} onInput={(e) => setPhone(e.target.value)} />
            <textarea placeholder="Megjegyzés" class="w-full p-2 border rounded" rows="3"
              value={message} onInput={(e) => setMessage(e.target.value)} />
            <button type="submit" class="w-full bg-blue-600 text-white py-2 rounded">Küldés</button>
          </form>
        )}
      </div>
    </div>
  );
}
