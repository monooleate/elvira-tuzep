import { useState, useEffect } from 'preact/hooks';

export default function FirewoodComparisonCalculator() {
  const [offerA, setOfferA] = useState({ price: '', unit: 'szort_m3', deliveryIncluded: true, deliveryCost: '' });
  const [offerB, setOfferB] = useState({ price: '', unit: 'erdei_m3', deliveryIncluded: true, deliveryCost: '' });
  const [moisture, setMoisture] = useState(20);
  const [dryDensity, setDryDensity] = useState(550);
  
  const [conversion, setConversion] = useState({
    m3_to_erdei: '1.67',
    erdei_to_ton: '1.4',
    szort_to_m3: '0.45',
    tomor_to_erdei: '1.43'
  });
  const [result, setResult] = useState(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  const parseInput = (val) => parseFloat(val?.toString().replace(',', '.')) || 0;

  const getDensity = () => {
    const moistureFraction = parseInput(moisture) / 100;
    return Math.round(dryDensity * (1 + moistureFraction));
  };

  const [calculatedDensity, setCalculatedDensity] = useState(getDensity());

  const convertToErdeiM3 = (price, unit, conv) => {
    const m3ToErdei = parseInput(conv.m3_to_erdei);
    const erdeiToTon = parseInput(conv.erdei_to_ton);
    const szortToTomor = parseInput(conv.szort_to_m3);
    const tomorToErdei = parseInput(conv.tomor_to_erdei);
    const density = calculatedDensity;

    switch (unit) {
      case 'm3':
        return price / m3ToErdei;
      case 'erdei_m3':
        return price;
      case 'tonna':
        return price * density * tomorToErdei / 1000;
      case 'mazsa':
        return (price * 10) * density * tomorToErdei / 1000;
      case 'szort_m3':
        return price / (szortToTomor * tomorToErdei);
      case 'rakott_m3':
        return price / m3ToErdei;
      case 'tomor_m3':
        return price / tomorToErdei;
      default:
        return null;
    }
  };

const compare = () => {
  setHasCalculated(true);

  const parsedPriceA = parseInput(offerA.price);
  const parsedPriceB = parseInput(offerB.price);
  const deliveryA = offerA.deliveryIncluded ? 0 : parseInput(offerA.deliveryCost);
  const deliveryB = offerB.deliveryIncluded ? 0 : parseInput(offerB.deliveryCost);

  // először csak az alapárakat váltjuk át
  const convertedA = convertToErdeiM3(parsedPriceA, offerA.unit, conversion);
  const convertedB = convertToErdeiM3(parsedPriceB, offerB.unit, conversion);

  if (convertedA == null || convertedB == null) {
    setResult(null);
    return;
  }

  // szállítási költség csak hozzáadódik a végső értékhez
  const finalA = convertedA + deliveryA;
  const finalB = convertedB + deliveryB;

  setResult({
    A: finalA.toFixed(0),
    B: finalB.toFixed(0),
    AExtra: deliveryA,
    BExtra: deliveryB,
    better:
      finalA < finalB
        ? 'Ajánlat A az olcsóbb'
        : finalB < finalA
        ? 'Ajánlat B az olcsóbb'
        : 'Mindkettő azonos árú',
  });
};



  useEffect(() => {
    if (hasCalculated) compare();
  }, [offerA, offerB, conversion, moisture]);

  const unitOptions = [
    { value: 'm3', label: 'Rakott m³' },
    { value: 'erdei_m3', label: 'Erdei m³' },
    { value: 'tonna', label: 'Tonna' },
    { value: 'mazsa', label: 'Mázsa' },
    { value: 'szort_m3', label: 'Szórt m³' },
    { value: 'tomor_m3', label: 'Tömör m³' }
  ];

  useEffect(() => {
    setCalculatedDensity(getDensity());
    }, [moisture, dryDensity]);

  return (
    <section className="bg-white dark:bg-gray-900 shadow-lg rounded-xl p-6 max-w-2xl mx-auto mt-8">
      <h2 className="text-xl font-bold mb-6 text-center text-gray-900 dark:text-white">
        Tűzifa ár-összehasonlító kalkulátor
      </h2>

      <div className="grid sm:grid-cols-2 gap-6">
        {[['A', offerA, setOfferA], ['B', offerB, setOfferB]].map(([label, offer, setter]) => (
          <div key={label}>
            <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Ajánlat {label}</h3>
            <input
              type="text"
              className="w-full p-2 mb-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
              placeholder="Pl. 34990"
              value={offer.price}
              onInput={(e) => setter((prev) => ({ ...prev, price: e.currentTarget.value }))}
            />
            <select
              className="w-full p-2 mb-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
              value={offer.unit}
              onChange={(e) => setter((prev) => ({ ...prev, unit: e.currentTarget.value }))}
            >
              {unitOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                checked={offer.deliveryIncluded}
                onChange={() => setter((prev) => ({ ...prev, deliveryIncluded: !prev.deliveryIncluded }))}
                className="mr-2"
              />
              <label className="text-gray-700 dark:text-gray-300">
                Szállítás benne van az árban
              </label>
            </div>
            {!offer.deliveryIncluded && (
              <input
                type="number"
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Szállítási díj (Ft)"
                value={offer.deliveryCost}
                onInput={(e) => setter((prev) => ({ ...prev, deliveryCost: e.currentTarget.value }))}
              />
            )}
          </div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Nedvességtartalom (%):
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="1"
            value={moisture}
            onInput={(e) => setMoisture(e.currentTarget.value)}
            className="w-full p-2 mt-1 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kalkulált sűrűség: <strong>{getDensity()} kg/m³</strong>
          </p>
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            Száraz fa sűrűsége (kg/m³):
          </label>
          <input
            type="number"
            step="1"
            value={dryDensity}
            onInput={(e) => setDryDensity(parseInput(e.currentTarget.value))}
            className="w-full mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            1 erdei m³ hány tonna?
          </label>
          <input
            type="number"
            step="0.01"
            value={conversion.erdei_to_ton}
            onInput={(e) => setConversion((prev) => ({ ...prev, erdei_to_ton: e.currentTarget.value }))}
            className="w-full mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            1 szórt m³ hány tömör m³?
          </label>
          <input
            type="number"
            step="0.01"
            value={conversion.szort_to_m3}
            onInput={(e) => setConversion((prev) => ({ ...prev, szort_to_m3: e.currentTarget.value }))}
            className="w-full mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            1 tömör m³ hány erdei m³?
          </label>
          <input
            type="number"
            step="0.01"
            value={conversion.tomor_to_erdei}
            onInput={(e) => setConversion((prev) => ({ ...prev, tomor_to_erdei: e.currentTarget.value }))}
            className="w-full mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-700 dark:text-gray-300">
            1 rakott m³ hány erdei m³?
          </label>
          <input
            type="number"
            step="0.01"
            value={conversion.m3_to_erdei}
            onInput={(e) =>
              setConversion((prev) => ({
                ...prev,
                m3_to_erdei: e.currentTarget.value,
              }))
            }
            className="w-full mt-1 p-2 border rounded bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
          />
        </div>

      </div>

      <button
        onClick={compare}
        className="w-full mt-6 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded"
      >
        Számol
      </button>

      {result && (
        <div className="mt-6 border-t pt-4 border-gray-200 dark:border-gray-700 text-center">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">Eredmény</h3>
          <p className="text-gray-700 dark:text-gray-300">
            Ajánlat A: <strong>{result.A} Ft / erdei m³</strong> {result.AExtra > 0 && `(szállítás: +${result.AExtra} Ft)`}
          </p>
          <p className="text-gray-700 dark:text-gray-300">
            Ajánlat B: <strong>{result.B} Ft / erdei m³</strong> {result.BExtra > 0 && `(szállítás: +${result.BExtra} Ft)`}
          </p>
          <p className="mt-3 font-bold text-green-700 dark:text-green-400 text-lg">
            ✅ {result.better}
          </p>
        </div>
      )}
    </section>
  );
}