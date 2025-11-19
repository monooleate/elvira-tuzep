import { useState, useEffect, useRef } from 'preact/hooks';
import Button from '../ui/Button.tsx';
import { createPortal } from 'preact/compat';

export default function OfferModal({ product, unit, price, quantity, onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState(null);

  const modalRef = useRef(null);
  

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) onClose();
  };

  const validate = () => {
    const newErrors = {};
    if (!name.trim()) newErrors.name = 'A név megadása kötelező.';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) newErrors.email = 'Az email megadása kötelező.';
    else if (!emailRegex.test(email)) newErrors.email = 'Érvénytelen email cím.';

    const phoneRegex = /^[+0-9\s-]*$/;
    if (phone.trim() && !phoneRegex.test(phone)) newErrors.phone = 'Csak számokat, szóközt, kötőjelet és + jelet tartalmazhat.';

    if (message.trim().length > 0 && message.trim().length < 5)
      newErrors.message = 'A megjegyzés legalább 5 karakter legyen.';

    if (!acceptedDisclaimer) newErrors.disclaimer = 'A hozzájárulás kötelező.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    const payload = {
      name,
      email,
      phone,
      message,
      quantity,
      unit,
      product: {
        name: product.title || product.name,
        slug: product.slug,
        price: price,
        unit: unit,
        sku: product.sku,
      },
    };

    try {
      const response = await fetch('/api/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSubmitted(true);
        if (typeof gtag === 'function') {
          gtag('event', 'ads_conversion_Ismer_s_1', {
            // opcionálisan adhatsz át értéket is
            // value: price || 0,
            // currency: 'HUF'
            name: product.title || product.name,
            slug: product.slug,
            price: price,
            unit: unit,
            sku: product.sku,
          });
  }
      } else {
        setServerError(result.error || 'Ismeretlen hiba történt.');
      }
    } catch (err) {
      setServerError('Hálózati hiba: ' + err.message);
    }
  };

  return createPortal(
    <div
      ref={modalRef}
      onClick={handleBackdropClick}
      class="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
    >
      <div class="bg-white dark:bg-gray-900 p-6 rounded shadow-lg max-w-md w-full relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          class="absolute top-2 right-2 text-gray-500 hover:text-black dark:hover:text-white"
        >
          ✖
        </button>

        {submitted ? (
          <div class="text-center space-y-4">
            <p class="text-green-600 dark:text-green-400 font-semibold">
              Köszönjük, az ajánlatkérés elküldve!
            </p>
            <Button text="OK" onClick={onClose} variant="primary" />
          </div>
        ) : (
          <>
            {serverError && (
              <div class="mb-4 p-3 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded border border-red-400 dark:border-red-600">
                {serverError}
              </div>
            )}
            <form onSubmit={handleSubmit} class="space-y-4" noValidate>
              <h2 class="text-lg font-bold mb-2 text-gray-800 dark:text-gray-100">Ajánlatot kérek</h2>

              <div class="bg-gray-100 dark:bg-gray-800 p-3 rounded text-sm text-gray-800 dark:text-gray-200 mb-3">
                <div><strong>Termék:</strong> {product.title || product.name}</div>
                <div><strong>Cikkszám:</strong> {product.sku}</div>
                <div><strong>Mennyiség:</strong> {quantity} db</div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Név"
                  class="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={name}
                  onInput={(e) => setName(e.target.value)}
                />
                {errors.name && <p class="text-red-600 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <input
                  type="email"
                  placeholder="Email"
                  class="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onInput={(e) => setEmail(e.target.value)}
                />
                {errors.email && <p class="text-red-600 text-sm mt-1">{errors.email}</p>}
              </div>

              <div>
                <input
                  type="tel"
                  placeholder="Telefonszám"
                  class="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={phone}
                  onInput={(e) => setPhone(e.target.value)}
                />
                {errors.phone && <p class="text-red-600 text-sm mt-1">{errors.phone}</p>}
              </div>

              <div>
                <textarea
                  placeholder="Megjegyzés"
                  class="w-full p-2 border rounded bg-white text-black dark:bg-gray-800 dark:text-white dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  value={message}
                  onInput={(e) => setMessage(e.target.value)}
                />
                {errors.message && <p class="text-red-600 text-sm mt-1">{errors.message}</p>}
              </div>

              <div class="flex items-start space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  id="disclaimer"
                  checked={acceptedDisclaimer}
                  onChange={(e) => setAcceptedDisclaimer(e.target.checked)}
                  class="mt-1"
                />
                <label for="disclaimer" class="select-none">
                  Az űrlap elküldésével hozzájárulsz ahhoz, hogy személyes adataidat a kapcsolatfelvétel céljából kezeljük.
                </label>
              </div>
              {errors.disclaimer && <p class="text-red-600 text-sm mt-1">{errors.disclaimer}</p>}

              <div class="flex justify-center mt-4">
                <Button variant="primary" type="submit" class="mx-auto" text="Küldés" />
              </div>
            </form>
          </>
        )}
      </div>
    </div>,
  document.body
  );
}
