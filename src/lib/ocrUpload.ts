import * as pdfjsLib from "pdfjs-dist";

const PDF_MIME = "application/pdf";
const MAX_DIMENSION = 1200;
const WEBP_QUALITY = 0.70;

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

type PreparedUpload = {
  blob: Blob;
  type: string;
};

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się wczytać obrazu do kompresji."));
    };
    image.src = url;
  });
}

function blobFromCanvas(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nie udało się wygenerować pliku obrazu."));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

async function convertImageBlobToWebp(blob: Blob): Promise<PreparedUpload> {
  const image = await loadImageFromBlob(blob);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nie udało się przygotować canvas do kompresji obrazu.");
  }

  context.drawImage(image, 0, 0, width, height);
  const webpBlob = await blobFromCanvas(canvas, "image/webp", WEBP_QUALITY);
  return { blob: webpBlob, type: "image/webp" };
}

async function renderPdfPageToWebp(page: pdfjsLib.PDFPageProxy): Promise<PreparedUpload | null> {
  const viewport = page.getViewport({ scale: 1.5 });
  const scale = Math.min(1, MAX_DIMENSION / Math.max(viewport.width, viewport.height));
  const scaledViewport = page.getViewport({ scale: 1.5 * scale });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return null;

  canvas.width = Math.max(1, Math.round(scaledViewport.width));
  canvas.height = Math.max(1, Math.round(scaledViewport.height));

  await page.render({ canvasContext: context, canvas, viewport: scaledViewport }).promise;
  const webpBlob = await blobFromCanvas(canvas, "image/webp", WEBP_QUALITY);
  return { blob: webpBlob, type: "image/webp" };
}

export async function prepareOcrUploads(files: File[]): Promise<PreparedUpload[]> {
  const prepared: PreparedUpload[] = [];

  for (const file of files) {
    if (file.type === PDF_MIME || file.name.toLowerCase().endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = Math.min(3, pdf.numPages);

      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        const rendered = await renderPdfPageToWebp(page);
        if (rendered) {
          prepared.push(rendered);
        }
      }
      continue;
    }

    prepared.push(await convertImageBlobToWebp(file));
  }

  return prepared;
}
