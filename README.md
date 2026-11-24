# FloatLab

FloatLab is a browser-based IEEE 754 binary32 converter and calculator developed by Team Half-Bytes for SWEN 4342 at the University of Houston–Clear Lake.

## Features

- Enter a decimal number, 32-bit binary word, 8-digit hexadecimal word, or sign/exponent/fraction fields.
- Inspect the sign, exponent, and fraction bits and toggle individual bits.
- View the decoded decimal value, encoding, number classification, and an equation for the selected value.
- Add, subtract, and multiply two values using single-precision rounding in the browser.
- Read the built-in help for input formats and IEEE 754 number classes.

## Running locally

Open `index.html` in a browser. Alternatively, serve the directory locally:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`.

MathJax is loaded from an external service, so mathematical typesetting requires an internet connection.

## Implementation notes

The converter uses JavaScript `DataView` to read and write 32-bit floating-point encodings. Calculator results are rounded with `Math.fround()`. The calculator is a prototype, not an independent implementation of IEEE 754 arithmetic or every rounding mode.

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