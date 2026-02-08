// src/components/widgets/ContactFormHandler.jsx
import { useEffect } from 'preact/hooks';

export default function ContactFormHandler() {
  useEffect(() => {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const handleSubmit = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);

      try {
        const res = await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData).toString(),
        });

        if (res.ok) {
          window.location.href = '/koszonjuk';
        } else {
          alert('Hiba történt az elküldés során. Kérjük próbáld újra.');
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
