// src/components/widgets/ContactFormHandler.jsx
import { useEffect } from 'preact/hooks';

export default function ContactFormHandler() {
  useEffect(() => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const handleSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      const data = {
        name: formData.get('name') || '',
        email: formData.get('email') || '',
        phone: formData.get('phone') || '',
        message: formData.get('message') || '',
        quantity: '',
        product: {
          name: '',
          slug: '',
          price: '',
          sku: '',
        },
      };

      try {
        const res = await fetch('/api/offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await res.json();
        if (res.ok && result.success) {
          alert('Köszönjük, üzeneted elküldtük!');
          form.reset();
        } else {
          alert(result.error || 'Hiba történt az elküldés során.');
        }
      } catch (err) {
        alert('Hálózati hiba: ' + err.message);
      }
    };

    form.addEventListener('submit', handleSubmit);
    return () => form.removeEventListener('submit', handleSubmit);
  }, []);

  return null;
}
