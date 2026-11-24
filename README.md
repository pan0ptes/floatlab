# FloatLab

FloatLab is a browser-based IEEE 754 binary32 converter and calculator developed by Team Half-Bytes for SWEN 4342 at the University of Houston–Clear Lake.

## Features

- Enter a decimal number, 32-bit binary word, 8-digit hexadecimal word, or sign/exponent/fraction fields (binary, or `0x` hex per field). The converter and both calculator operands use the same input component.
- Inspect the sign, exponent, and fraction bits in binary and in hex (for example `0x0 / 0x82 / 0x540000`), and toggle individual bits.
- View the decoded value, exact decimal expansion, ULP, neighboring binary32 encodings, classification, and live equation.
- Add, subtract, and multiply two binary32 operands using an integer-significand arithmetic core with round-to-nearest, ties-to-even. Each operand and the result show their class (normalized, denormalized, zero, infinity, NaN), and the result shows the guard/round/sticky bits.
- Read the built-in help for input formats, number classes, a worked addition example, and how to read the G/R/S line.

## Running locally

Open `index.html` in a browser. Alternatively, serve the directory locally:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`.

MathJax 3.2.2 (`tex-svg.js`, Apache-2.0) is vendored in `vendor/mathjax/`, so the page works offline and from `file://`. All conversion and arithmetic logic runs locally in the browser.

## Implementation notes

The independent `float32-core.js` module parses decimal inputs into exact rational values using `BigInt`, then performs addition, subtraction and multiplication using integer significands and powers of two. The module rounds results to binary32 with round-to-nearest, ties-to-even, including normal, subnormal and special values. `DataView` is used by the interface to display the decoded decimal value, and by tests as a reference. Division, alternate precision formats, directed rounding modes and exception flags are outside the current scope.

## Tests

Run `node --test tests/float32.test.cjs` from the repository root (Node.js 18 or newer). The suite checks boundary values, ties-to-even, special-value behavior, the S/E/M hex helpers, classification of every class, and differential comparisons against `Math.fround` (uniform random plus targeted generators for cancellation, subnormals, multiplication underflow, near-max overflow, exact ties and large exponent gaps).

## Quick checks

| Decimal input | Expected hexadecimal word |
| --- | --- |
| `13.25` | `41540000` |
| `1` | `3F800000` |
| `-0` | `80000000` |
| `0.1` | `3DCCCCCD` |
| `Infinity` | `7F800000` |

## Project

Team Half-Bytes · University of Houston–Clear Lake · SWEN 4342