import { useState, useEffect } from 'preact/hooks';

export default function NegyzetmeterKalkulator() {
  const [length, setLength] = useState(''); // in meters
  const [width, setWidth] = useState('');   // in cm
  const [quantity, setQuantity] = useState('1');
  const [pricePerSquare, setPricePerSquare] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [firstTime, setFirstTime] = useState(true);
  const [errors, setErrors] = useState({});

  const parse = (val) => {
    if (typeof val === 'string') {
      return parseFloat(val.replace(',', '.')) || 0;
    }
    if (typeof val === 'number') {
      return val;
    }
    return 0;
  };

  const areaPerPiece = (parse(width) * (parse(length) * 100)) / 10_000;
  const totalArea = areaPerPiece * parse(quantity);
  const piecesPerSquare = areaPerPiece > 0 ? Math.floor(1 / areaPerPiece) : 0;
  const totalPrice = totalArea * parse(pricePerSquare);

  useEffect(() => {
    if (!firstTime) {
      setShowResult(true);
    }
  }, [length, width, quantity, pricePerSquare]);

  const validateInputs = () => {
    const newErrors = {};
    if (parse(length) > 50) newErrors.length = 'Hosszúság nem lehet nagyobb, mint 50 m';
    if (parse(width) > 150) newErrors.width = 'Szélesség nem lehet nagyobb, mint 150 cm';
    if (parse(quantity) > 10000) newErrors.quantity = 'Darabszám nem lehet nagyobb, mint 10000';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <section className="bg-white dark:bg-gray-900 shadow-lg rounded-2xl p-6 md:p-8 max-w-xl mx-auto my-8">
      <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">
        Faanyag Négyzetméter és Ár Kalkulátor
      </h2>

      <div className="grid grid-cols-1 gap-4 justify-items-center">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hossz (m)</label>
          <input
            type="number"
            min="0"
            max="50"
            step="0.01"
            className="w-32 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={length}
            onChange={(e) => setLength(e.target.value || '')}
          />
          {errors.length && <p className="text-red-600 text-sm mt-1">{errors.length}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Szélesség (cm)</label>
          <input
            type="number"
            min="0"
            max="150"
            className="w-32 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={width}
            onChange={(e) => setWidth(e.target.value || '')}
          />
          {errors.width && <p className="text-red-600 text-sm mt-1">{errors.width}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Darabszám (db)</label>
          <input
            type="number"
            min="0"
            max="10000"
            className="w-32 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value || '')}
          />
          {errors.quantity && <p className="text-red-600 text-sm mt-1">{errors.quantity}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">m² ár (Ft)</label>
          <input
            type="number"
            min="0"
            className="w-32 p-2 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            value={pricePerSquare}
            onChange={(e) => setPricePerSquare(e.target.value || '')}
          />
        </div>
      </div>

      {!showResult && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => {
              if (validateInputs()) {
                setShowResult(true);
                setFirstTime(false);
              }
            }}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-xl transition"
          >
            Számítás indítása
          </button>
        </div>
      )}

      {showResult && (
        <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2 text-gray-800 dark:text-gray-100 text-center">
          <p><strong>1 db fedett terület:</strong> {areaPerPiece.toFixed(3)} m²</p>
          <p><strong>Teljes felület:</strong> {totalArea.toFixed(3)} m²</p>
          <p><strong>1 m²-ből kijön:</strong> {piecesPerSquare} db</p>
          <p><strong>Teljes ár:</strong> {totalPrice.toLocaleString('hu-HU')} Ft</p>
        </div>
      )}
    </section>
  );
}
