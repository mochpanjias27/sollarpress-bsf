import katex from 'katex';
import 'katex/dist/katex.min.css';

// Render rumus LaTeX dengan KaTeX.
export default function Tex({ children, block = false }) {
  const html = katex.renderToString(String(children), { displayMode: block, throwOnError: false, strict: false });
  return block
    ? <div className="eqbox" dangerouslySetInnerHTML={{ __html: html }} />
    : <span dangerouslySetInnerHTML={{ __html: html }} />;
}
