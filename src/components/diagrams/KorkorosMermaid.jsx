import Mermaid from './Mermaid.jsx';

export default function KorkorosMermaid() {
  const diagram = `
    graph LR
      A[🌳 Fa nő a természetben] --> B[CO₂-t köt meg]
      B --> C[🏭 Feldolgozás]
      C --> D[🧱 Brikett készül]
      D --> E[🔥 Elégetés]
      E --> F[🌫️ CO₂ visszakerül a légkörbe]
      F --> A
  `;

    return (
    <div class="my-8">
      <h3 class="text-xl font-semibold mb-2">🌱 A brikett CO₂-körforgása</h3>
      <Mermaid chart={diagram} />
      <p class="text-sm text-gray-600 mt-2">Ez a körfolyamat biztosítja, hogy a fa brikett égetése karbonsemleges legyen.</p>
    </div>
  );
}