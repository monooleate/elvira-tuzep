import { useState } from 'preact/hooks';
import { Eye, EyeOff } from 'lucide-preact';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loggedIn, setLoggedIn] = useState(false);

  const handleSubmit = (e: Event) => {
    e.preventDefault();

    if (username === 'admin' && password === 'jelszo123') {
      setLoggedIn(true);
    } else {
      setError('Hibás felhasználónév vagy jelszó');
    }
  };

  if (loggedIn) {
    return (
      <div class="text-center text-green-600 font-semibold">
        Sikeres bejelentkezés! 🎉
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} class="space-y-5">
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Felhasználónév</label>
        <input
          type="text"
          class="w-full border rounded px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="pl. admin"
          value={username}
          onInput={(e) => setUsername((e.target as HTMLInputElement).value)}
        />
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Jelszó</label>
        <div class="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            class="w-full border rounded px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="••••••••"
            value={password}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
          />
          <button
            type="button"
            class="absolute top-2.5 right-2 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPassword(!showPassword)}
            aria-label="Jelszó mutatása"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      {error && <p class="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition duration-200"
      >
        Bejelentkezés
      </button>
    </form>
  );
}
