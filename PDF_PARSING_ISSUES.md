# PDF Parsing Issues - RESOLVED ✅

## Problem
Some PDFs were failing to be analyzed with the error: "PDF nie zawiera tekstu (to zeskanowany obraz)".

## Root Cause
The issue was that scanned PDFs (PDFs containing images without a text layer) were being rejected instead of processed. The code took different paths:
- **Photo path**: Sends image to OpenAI Vision API (GPT-4o-mini) which can OCR the image
- **PDF path**: Uses `pdf-parse` to extract embedded text only

When a PDF was scanned (image-only, no text layer), the code would throw an error instead of processing the image.

## Solution Implemented
Modified `convex/ocr.ts` to detect scanned PDFs and automatically fall back to Vision API:

1. Try `pdf-parse` to extract text from PDF
2. If text is empty (scanned PDF detected):
   - Use `pdfjs-dist` to render the first page as an image
   - Use `node-canvas` to create an image buffer
   - Convert to base64 PNG
   - Send to `processImageWithOpenAI()` (same path as photos)

This way, scanned PDFs now go through exactly the same Vision API path as camera photos.

## Dependencies Added
- `pdfjs-dist`: For rendering PDF pages to canvas
- `canvas`: Node.js canvas implementation for image generation

## Technical Details
```typescript
// When PDF has no text layer:
1. pdfjs-dist loads the PDF document
2. Gets first page and creates viewport (2x scale for quality)
3. node-canvas creates a canvas element
4. PDF page is rendered to canvas
5. Canvas is converted to base64 PNG
6. Image is sent to Vision API (same as camera photos)
```

## Result
✅ Scanned PDFs (receipts/invoices saved as image-only PDFs) now work seamlessly, just like taking a photo with the camera.
✅ Text-based PDFs continue to work as before (faster, using text extraction)
✅ No user action required - automatic fallback handles both cases
