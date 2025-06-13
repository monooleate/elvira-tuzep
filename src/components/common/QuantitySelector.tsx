export default function QuantitySelector({ unitPrice, unit, quantity, setQuantity }) {
  const decrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const increment = () => {
    setQuantity(quantity + 1);
  };

  const handleChange = (value) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed > 0) setQuantity(parsed);
  };

  const total = quantity * unitPrice;

  return (
    <div class="mt-6 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg max-w-sm">
      <div class="flex items-center justify-start gap-3">
        <button
          onClick={decrement}
          class="px-3 py-1 bg-gray-300 dark:bg-gray-700 rounded text-lg font-bold hover:bg-gray-400 dark:hover:bg-gray-600"
          aria-label="Csökkentés"
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          class="w-16 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-medium text-lg appearance-none"
          value={quantity}
          onInput={(e) => handleChange(e.target.value)}
        />
        <button
          onClick={increment}
          class="px-3 py-1 bg-gray-300 dark:bg-gray-700 rounded text-lg font-bold hover:bg-gray-400 dark:hover:bg-gray-600"
          aria-label="Növelés"
        >
          +
        </button>

        <span class="text-sm text-gray-700 dark:text-gray-300 ml-2">
          {unit} <span class="text-gray-500 dark:text-gray-400">({total.toLocaleString('hu-HU')} Ft)</span>
        </span>
      </div>
    </div>
  );
}
