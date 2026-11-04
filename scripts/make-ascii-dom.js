// Generates src/components/gradient-ascii-dom.tsx from references/GradientASCII.tsx.
// The reference is a web component (Tailwind classes, 'use client'); a DOM component needs the
// 'use dom' directive, a `dom` prop, and plain inline styles. Run again if the reference changes.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
let s = fs.readFileSync(path.join(root, 'references', 'GradientASCII.tsx'), 'utf8').replace(/\r\n/g, '\n');

function replaceOnce(from, to, label) {
  if (!s.includes(from)) throw new Error(`patch failed: ${label}`);
  s = s.replace(from, to);
}

replaceOnce(
  "'use client';",
  ["'use dom';", '', '/* eslint-disable react-hooks/refs -- vendored reference code, kept as written */'].join('\n'),
  'directive',
);
replaceOnce(
  "export interface GradientASCIIProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {",
  "export interface GradientASCIIProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {\n  dom?: import('expo/dom').DOMProps;",
  'props',
);
replaceOnce(
  "  className = '',\n  style,\n  ...rest\n}: GradientASCIIProps) => {",
  "  className = '',\n  style,\n  dom: _dom,\n  ...rest\n}: GradientASCIIProps) => {",
  'destructure',
);
replaceOnce(
  "className={['relative h-full w-full overflow-hidden', className].filter(Boolean).join(' ')}\n      style={style}",
  // Fixed to the viewport: a percentage height collapses to zero because the page above has no height.
  "className={className}\n      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', ...style }}",
  'container',
);
replaceOnce(
  '<canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />',
  "<canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%' }} aria-hidden=\"true\" />",
  'canvas',
);
replaceOnce(
  "const DEFAULT_COLORS = ['#1e3fd8', '#f6f8ff', '#a5d8ff', '#38bdf8'];",
  "const DEFAULT_COLORS = ['#0a2a8f', '#2f8bff', '#a5d8ff', '#f4f4f6'];",
  'palette',
);

// The reference kills the WebGL context on cleanup. React runs effects twice in development, and the
// second run then gets the dead context from the same canvas: every shader fails silently.
replaceOnce(
  "      gl.getExtension('WEBGL_lose_context')?.loseContext();\n",
  '',
  'keep the context alive',
);

// Trace the first frame, because a blank canvas gives no clue on a phone.
replaceOnce(
  '    if (!field || !halo || !blur || !composite) return undefined;',
  [
    '    if (!field || !halo || !blur || !composite) {',
    "      console.error('ASCII programs missing', { field: !!field, halo: !!halo, blur: !!blur, composite: !!composite });",
    '      return undefined;',
    '    }',
  ].join('\n'),
  'program trace',
);
replaceOnce(
  ['      gl.uniform1f(cu.uFrame, frameSeed);', '      gl.drawArrays(gl.TRIANGLES, 0, 3);', '    };'].join('\n'),
  [
    '      gl.uniform1f(cu.uFrame, frameSeed);',
    '      gl.drawArrays(gl.TRIANGLES, 0, 3);',
    '      if (!(window as unknown as { __asciiLogged?: boolean }).__asciiLogged) {',
    '        (window as unknown as { __asciiLogged?: boolean }).__asciiLogged = true;',
    "        console.log('ASCII first draw', { w: canvas.width, h: canvas.height, error: gl.getError(), lost: gl.isContextLost(), atlas: !!atlas, reduce });",
    '      }',
    '    };',
  ].join('\n'),
  'draw trace',
);

// Report shader problems: the reference fails silently, which is hard to debug on a phone.
replaceOnce(
  ['  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;', '  gl.deleteShader(shader);'].join('\n'),
  [
    '  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;',
    "  console.error('ASCII shader compile failed', gl.getShaderInfoLog(shader));",
    '  gl.deleteShader(shader);',
  ].join('\n'),
  'compile log',
);
replaceOnce(
  ['  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {', '    gl.deleteProgram(program);'].join('\n'),
  [
    '  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {',
    "    console.error('ASCII program link failed', gl.getProgramInfoLog(program));",
    '    gl.deleteProgram(program);',
  ].join('\n'),
  'link log',
);

fs.writeFileSync(path.join(root, 'src', 'components', 'gradient-ascii-dom.tsx'), s);
console.log('written', s.split('\n').length, 'lines');
