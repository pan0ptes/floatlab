# FloatLab

FloatLab is a browser-based IEEE 754 binary32 converter and calculator developed by Team Half-Bytes for SWEN 4342 at the University of Houston–Clear Lake.

## Features

- Enter a decimal number, 32-bit binary word, 8-digit hexadecimal word, or sign/exponent/fraction fields.
- Inspect the sign, exponent, and fraction bits and toggle individual bits.
- View the decoded value, exact decimal expansion, ULP, neighboring binary32 encodings, classification, and live equation.
- Add, subtract, and multiply binary32 operands using an integer-significand arithmetic core with round-to-nearest, ties-to-even.
- Read the built-in help for input formats and IEEE 754 number classes.

## Running locally

Open `index.html` in a browser. Alternatively, serve the directory locally:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`.

MathJax is loaded from an external service, so mathematical typesetting requires an internet connection. All conversion and arithmetic logic runs locally in the browser.

## Implementation notes

The independent `float32-core.js` module parses decimal inputs into exact rational values using `BigInt`, then performs addition, subtraction and multiplication using integer significands and powers of two. The module rounds results to binary32 with round-to-nearest, ties-to-even, including normal, subnormal and special values. `DataView` is used by the interface to display the decoded decimal value, and by tests as a reference. Division, alternate precision formats, directed rounding modes and exception flags are outside the current scope.

## Tests

Run `node --test tests/float32.test.cjs` from the repository root (Node.js 18 or newer). The suite checks boundary values, ties-to-even, special-value behavior and randomized differential comparisons.

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