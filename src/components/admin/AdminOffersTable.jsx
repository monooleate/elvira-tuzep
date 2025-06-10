import { useState } from 'preact/hooks';

export default function AdminOffersTable({ ajanlatok }) {
  return (
    <div class="overflow-x-auto">
      <table class="min-w-full table-auto border border-gray-300">
        <thead class="sticky top-0 z-20 bg-blue-100 shadow-sm">
          <tr>
            <th class="border px-4 py-2 text-left">Név</th>
            <th class="border px-4 py-2 text-left">Email</th>
            <th class="border px-4 py-2 text-left">Telefon</th>
            <th class="border px-4 py-2 text-left">Termék</th>
            <th class="border px-4 py-2 text-left">Db</th>
            <th class="border px-4 py-2 text-left">EÁr (Ft)</th>
            <th class="border px-4 py-2 text-left">VÁr (Ft)</th>
            <th class="border px-4 py-2 text-left">Üzenet</th>
            <th class="border px-4 py-2 text-left">Beküldve</th>
            <th class="border px-4 py-2 text-center">K</th>
            <th class="border px-4 py-2 text-center">RR</th>
            <th class="border px-4 py-2 text-center">RT</th>
            <th class="border px-4 py-2 text-center">Mentés</th>
          </tr>
        </thead>
        <tbody>
          {ajanlatok.map((item) => (
            <OfferRow key={item.id} item={item} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


function OfferRow({ item }) {
  const [contacted, setContacted] = useState(item.contacted || false);
  const [orderRecorded, setOrderRecorded] = useState(item.orderRecorded || false);
  const [orderCompleted, setOrderCompleted] = useState(item.orderCompleted || false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);

  const quantity = item.quantity || 1;
  const unitPrice = item.product?.price || 0;
  const totalPrice = quantity * unitPrice;

  const saveStatus = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/offerUpdate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          contacted,
          orderRecorded,
          orderCompleted,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setSaveMessage({ error: true, text: data.error || 'Hiba a mentés során' });
      } else {
        setSaveMessage({ error: false, text: 'Állapot mentve' });
      }
    } catch (error) {
      setSaveMessage({ error: true, text: 'Hálózati hiba: ' + error.message });
    }
    setSaving(false);
  };

  return (
    <tr class="even:bg-gray-50">
      <td class="border px-4 py-2">{item.name}</td>
      <td class="border px-4 py-2">{item.email}</td>
      <td class="border px-4 py-2">{item.phone}</td>
      <td class="border px-4 py-2">{item.product.name}</td>
      <td class="border px-4 py-2">{quantity}</td>
      <td class="border px-4 py-2">{unitPrice.toLocaleString("hu-HU")}</td>
      <td class="border px-4 py-2">{totalPrice.toLocaleString("hu-HU")}</td>
      <td class="border px-4 py-2">{item.message}</td>
      <td class="border px-4 py-2">{new Date(item.receivedAt).toLocaleString("hu-HU")}</td>

      <td class="border px-4 py-2 text-center">
        <input type="checkbox" checked={contacted} onChange={(e) => setContacted(e.target.checked)} />
      </td>
      <td class="border px-4 py-2 text-center">
        <input type="checkbox" checked={orderRecorded} onChange={(e) => setOrderRecorded(e.target.checked)} />
      </td>
      <td class="border px-4 py-2 text-center">
        <input type="checkbox" checked={orderCompleted} onChange={(e) => setOrderCompleted(e.target.checked)} />
      </td>
      <td class="border px-4 py-2 text-center">
        <button
          onClick={saveStatus}
          disabled={saving}
          class={`px-3 py-1 rounded text-white ${saving ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {saving ? 'Mentés...' : 'Mentés'}
        </button>
        {saveMessage && (
          <p class={`mt-1 text-sm ${saveMessage.error ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage.text}
          </p>
        )}
      </td>
    </tr>
  );
}
