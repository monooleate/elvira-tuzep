import { useEffect, useState } from 'preact/hooks';
import mermaid from 'mermaid';

export default function Mermaid({ chart }) {
  const [svgCode, setSvgCode] = useState('');

  useEffect(() => {
    mermaid.initialize({ startOnLoad: false });
    mermaid.render('diagram-' + Math.random(), chart, (svg) => {
      setSvgCode(svg);
    });
  }, [chart]);

  return (
    <div
      class="mermaid overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svgCode }}
    />
  );
}
