"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import OpenAI from "openai";

function getOpenAI() {
  return new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });
}

const DEFAULT_VISION_MODEL = "gpt-4o-mini";

function extractJsonBlock(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const withoutFences = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  if (withoutFences.startsWith("{") || withoutFences.startsWith("[")) {
    return withoutFences;
  }

  const firstObj = withoutFences.indexOf("{");
  const lastObj = withoutFences.lastIndexOf("}");
  if (firstObj !== -1 && lastObj > firstObj) {
    return withoutFences.slice(firstObj, lastObj + 1);
  }

  const firstArr = withoutFences.indexOf("[");
  const lastArr = withoutFences.lastIndexOf("]");
  if (firstArr !== -1 && lastArr > firstArr) {
    return withoutFences.slice(firstArr, lastArr + 1);
  }

  return withoutFences;
}

function normalizeAmount(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const text = String(value).replace(",", ".").replace(/[^\d.-]/g, "").trim();
  if (!text) return "";
  const parsed = Number.parseFloat(text);
  if (!Number.isFinite(parsed) || parsed <= 0) return "";
  return parsed.toFixed(2);
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const getFileUrl = action({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) return null;
    return url;
  },
});

interface ProcessedReceiptItem {
  description: string;
  amount: string;
  categoryId: string | null;
  subcategoryId: string | null;
}

interface ProcessReceiptResult {
  items: ProcessedReceiptItem[];
  rawText: string;
  modelUsed: string;
}

export const processReceiptWithAI = action({
  args: {
    storageIds: v.array(v.id("_storage")),
    categories: v.any(),
    isPdf: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<ProcessReceiptResult> => {
    try {
      console.log("=== processReceiptWithAI START ===", {
        storageIdCount: args.storageIds.length,
        isPdf: args.isPdf,
        firstStorageId: args.storageIds[0]
      });
      
      // PDF path: Extract text and process
      if (args.isPdf) {
        const url = await ctx.storage.getUrl(args.storageIds[0]);
        if (!url) throw new Error("File not found");
        
        console.log("Fetching PDF from storage");
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        console.log("PDF downloaded:", arrayBuffer.byteLength, "bytes");
        
        try {
          const pdfParseModule = await import("pdf-parse");
          // @ts-ignore
          const pdfParse = pdfParseModule.default || pdfParseModule;
          const buffer = Buffer.from(arrayBuffer);
          
          // Try parsing with minimal options
          const data = await pdfParse(buffer, { max: 0 });
          const pdfText = data?.text ?? "";
          
          console.log("PDF text extracted:", {
            length: pdfText.length,
            hasText: !!pdfText.trim(),
            firstChars: pdfText.substring(0, 100)
          });
          
          if (!pdfText.trim()) {
            // PDF parsed but no text - it's a scanned image
            // Fall through to Vision API by converting PDF to image
            console.log("PDF has no text layer - treating as scanned image, using Vision API");
            
            try {
              // Use pdfjs-dist to render the first page as an image
              const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
              
              // Load the PDF document
              const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(arrayBuffer),
              });
              const pdfDoc = await loadingTask.promise;
              
              // Get the first page
              const page = await pdfDoc.getPage(1);
              const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
              
              // Create a canvas using node-canvas
              const { createCanvas } = await import("canvas");
              const canvas = createCanvas(viewport.width, viewport.height);
              const context = canvas.getContext("2d");
              
              // Render the page to canvas
              await page.render({
                canvasContext: context as any,
                viewport: viewport,
                canvas: canvas as any,
              }).promise;
              
              // Convert canvas to base64 image
              const base64Data = canvas.toDataURL("image/png").split(",")[1];
              
              console.log("Successfully converted PDF page to image, sending to Vision API");
              return await processImageWithOpenAI(base64Data, "image/png", args.categories);
              
            } catch (renderErr: any) {
              console.error("Failed to render PDF as image:", renderErr);
              throw new Error(
                "PDF nie zawiera tekstu i nie udało się go przekonwertować na obraz. " +
                "Spróbuj zrobić zdjęcie paragonu aparatem w aplikacji."
              );
            }
          }
          
          console.log(`PDF text extraction successful, processing with AI`);
          return await processTextWithOpenAI(pdfText, args.categories);
          
        } catch (err: any) {
          // Log the actual error for debugging
          console.error("PDF parsing error details:", {
            message: err.message,
            name: err.name,
            stack: err.stack?.substring(0, 200)
          });
          
          // If it's our custom error message, rethrow it
          if (err.message?.includes("nie zawiera tekstu") || err.message?.includes("przekonwertować") || err.message?.includes("Błąd AI")) {
            throw err;
          }
          
          // For any other error, provide generic message
          throw new Error(
            `Nie udało się odczytać PDF: ${err.message}. ` +
            "Spróbuj użyć aparatu w aplikacji aby zrobić zdjęcie paragonu."
          );
        }
      }

      // Image path: use OpenAI vision
      console.log("Processing as image");
      const url = await ctx.storage.getUrl(args.storageIds[0]);
      if (!url) throw new Error("File not found");

      const imageRes = await fetch(url);
      const arrayBuffer = await imageRes.arrayBuffer();
      const base64Data = Buffer.from(arrayBuffer).toString('base64');
      const mimeType = imageRes.headers.get("content-type") || "image/jpeg";
      
      console.log("Image loaded, sending to Vision API");

      return await processImageWithOpenAI(base64Data, mimeType, args.categories);
    } catch (error: any) {
      console.error("=== FATAL ERROR in processReceiptWithAI ===", {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
      throw error;
    }
  }
});

async function processTextWithOpenAI(
  text: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } = 
    prepareCategoryData(categories);

  const truncatedText = text.slice(0, 4000);
  
  console.log("Processing text with OpenAI:", {
    textLength: text.length,
    truncatedLength: truncatedText.length,
    preview: truncatedText.substring(0, 200)
  });
  
  const prompt = buildPrompt(categoryPromptData, truncatedText);

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: DEFAULT_VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { 
          role: "system", 
          content: "Jesteś ekspertem OCR specjalizującym się w odczycie paragonów i faktur. KRYTYCZNE: Gdy widzisz 'Opust' lub 'Rabat' pod produktem, MUSISZ użyć ceny z linii rabatu, NIE oryginalnej ceny. Zawsze używaj KOŃCOWEJ ceny po rabacie. Dla faktur, czytaj pozycje z tabeli i używaj wartości z kolumny 'Kwota'."
        },
        { role: "user", content: prompt }
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    console.log("OpenAI response received:", {
      contentLength: content.length,
      preview: content.substring(0, 200)
    });
    
    const result = parseAndNormalizeResponse(content, categoryIds, subcategoryIdsByCategory, DEFAULT_VISION_MODEL);
    console.log("Parsed result:", {
      itemCount: result.items.length,
      items: result.items.map(i => ({ desc: i.description, amt: i.amount }))
    });
    
    return result;
  } catch (err: any) {
    console.error("OpenAI error:", err);
    throw new Error(`Błąd AI: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`);
  }
}

async function processImageWithOpenAI(
  base64Data: string,
  mimeType: string,
  categories: any
): Promise<ProcessReceiptResult> {
  const { categoryPromptData, categoryIds, subcategoryIdsByCategory } = 
    prepareCategoryData(categories);

  const prompt = buildPrompt(categoryPromptData);

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: DEFAULT_VISION_MODEL,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: "Jesteś ekspertem OCR specjalizującym się w odczycie paragonów. KRYTYCZNE: Gdy widzisz 'Opust' lub 'Rabat' pod produktem, MUSISZ użyć ceny z linii rabatu, NIE oryginalnej ceny. Zawsze używaj KOŃCOWEJ ceny po rabacie."
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = resp.choices[0].message.content ?? "{}";
    return parseAndNormalizeResponse(content, categoryIds, subcategoryIdsByCategory, DEFAULT_VISION_MODEL);
  } catch (err: any) {
    console.error("OpenAI vision error:", err);
    throw new Error(`Błąd AI: ${err?.message || "Nieznany błąd"}. Spróbuj ponownie.`);
  }
}

function prepareCategoryData(categories: any) {
  const categoriesArray = Array.isArray(categories) ? categories : [];
  const categoryIds = new Set<string>();
  const subcategoryIdsByCategory = new Map<string, Set<string>>();
  
  const categoryPromptData = categoriesArray.map((category: any) => {
    const categoryId = asString(category?._id);
    const categoryName = asString(category?.name);
    const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];

    if (categoryId) categoryIds.add(categoryId);

    const subSet = new Set<string>();
    const subcategories = subs.map((sub: any) => {
      const subId = asString(sub?._id);
      const subName = asString(sub?.name);
      if (subId) subSet.add(subId);
      return { id: subId, name: subName };
    });

    if (categoryId) {
      subcategoryIdsByCategory.set(categoryId, subSet);
    }

    return {
      id: categoryId,
      name: categoryName,
      subcategories,
    };
  });

  return { categoryPromptData, categoryIds, subcategoryIdsByCategory };
}

function buildPrompt(categoryPromptData: any[], documentText?: string) {
  const textSection = documentText 
    ? `Tekst dokumentu:\n${documentText}\n\n`
    : "";

  return `Jesteś asystentem OCR i kategoryzacji wydatków domowych.
Przeanalizuj ${documentText ? "poniższy tekst" : "obraz"} paragonu lub faktury (język polski lub angielski) i zwróć pozycje zakupowe.

${textSection}KRYTYCZNE ZASADY ODCZYTU:

1) TYPY DOKUMENTÓW:
   - PARAGON: Lista produktów z cenami, może zawierać rabaty
   - FAKTURA: Dokument z pozycjami "Opis", "Ilość", "Cena jednostkowa", "Kwota"
   
2) DLA FAKTUR:
   - Czytaj pozycje z tabeli faktury
   - Kolumny: Opis, Ilość, Cena jednostkowa, Podatek, Kwota
   - Użyj wartości z kolumny "Kwota" jako amount
   - Ignoruj sumy częściowe, sumy końcowe, należne kwoty
   - Przykład: "Extra Usage | 1 | 5,00 USD" → description="Extra Usage", amount="5.00"

3) DLA PARAGONÓW - STRUKTURA KOLUMN:
   - Nazwa produktu (może być w wielu liniach)
   - PTU (stawka VAT: A, B, C, itp.)
   - Ilość (np. "1 x", "2 x", "0.385 x")
   - Cena jednostkowa
   - Wartość (cena końcowa dla tej pozycji)

4) RABATY I OPUSTY - NAJWAŻNIEJSZE:
   - Jeśli pod produktem jest linia "Opust" lub "Rabat" - TO JEST RABAT, NIE OSOBNY PRODUKT
   - Wartość po rabacie jest w kolumnie "Wartość" w linii z rabatem
   - ZAWSZE używaj wartości KOŃCOWEJ (po rabacie) jako amount
   
   PRZYKŁAD Z PARAGONU:
   Linia 1: SerekAlmeJogurt150g    C    3x    6.49    19.47
   Linia 2:     Opust                                   -6.49
   Linia 3:                                             12.98
   
   POPRAWNIE: description="Serek Alme Jogurt 150g", amount="12.98"
   BŁĘDNIE: amount="19.47" ❌

5) CZYTANIE LINIA PO LINII:
   - Czytaj od góry do dołu
   - Dla każdego produktu znajdź jego KOŃCOWĄ wartość (ostatnia kolumna)
   - Jeśli następna linia to "Opust" - użyj wartości KOŃCOWEJ po rabacie

6) IGNORUJ:
   - Linie z samym słowem "Opust" lub "Rabat" (to nie są produkty)
   - Sumy częściowe, VAT, "OPUSTY ŁĄCZNIE", "Suma PTU"
   - "Suma częściowa", "Suma", "Należna kwota", "DO ZAPŁATY"
   - Płatność, reszta, kody kreskowe, numery transakcji
   - Opakowania zwrotne (np. "But Plastik kaucja")

7) NORMALIZACJA NAZW:
   - Usuń kody VAT z nazw (A, B, C)
   - Rozwiń skróty: "Sok1loBraSadoo.75l" → "Sok 1l Bra Sadoo 0,75l"
   - Popraw wielkość liter: "MLEKO" → "Mleko"
   - Dla faktur: użyj dokładnej nazwy z kolumny "Opis"

8) WALUTY:
   - Rozpoznaj walutę: PLN, USD, EUR, etc.
   - Konwertuj do formatu z kropką: "5,00 USD" → "5.00"
   - Zachowaj tylko liczbę bez waluty w amount

9) KATEGORYZACJA:
   - Wybierz najlepsze categoryId i subcategoryId z listy poniżej
   - Jeżeli niepewne, wpisz null

FORMAT ODPOWIEDZI:
- amount: string z kropką jako separator dziesiętny, np. "12.98" (bez waluty)
- description: pełna, znormalizowana nazwa produktu lub usługi
- ZAWSZE używaj ceny KOŃCOWEJ (po rabacie jeśli jest)

Dozwolone kategorie i podkategorie:
${JSON.stringify(categoryPromptData, null, 2)}

Zwróć TYLKO poprawny JSON bez Markdown:
{
  "rawText": "krótka transkrypcja kluczowych linii",
  "items": [
    {
      "description": "Pełna nazwa produktu lub usługi",
      "amount": "12.98",
      "categoryId": "id_lub_null",
      "subcategoryId": "id_lub_null"
    }
  ]
}`;
}

function parseAndNormalizeResponse(
  content: string,
  categoryIds: Set<string>,
  subcategoryIdsByCategory: Map<string, Set<string>>,
  modelUsed: string
): ProcessReceiptResult {
  try {
    const parsed = JSON.parse(extractJsonBlock(content) || "{}");
    const parsedItems = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];

    const normalizedItems = parsedItems.map((item: any) => {
      const description = asString(item?.description) || "Nieznana pozycja";
      const amount = normalizeAmount(item?.amount);

      const categoryIdCandidate = asString(item?.categoryId);
      const categoryId = categoryIds.has(categoryIdCandidate) ? categoryIdCandidate : null;

      const subcategoryIdCandidate = asString(item?.subcategoryId);
      const isSubcategoryAllowed =
        !!categoryId &&
        !!subcategoryIdCandidate &&
        !!subcategoryIdsByCategory.get(categoryId)?.has(subcategoryIdCandidate);

      return {
        description,
        amount,
        categoryId,
        subcategoryId: isSubcategoryAllowed ? subcategoryIdCandidate : null,
      };
    });

    const rawText = asString(parsed?.rawText);
    return {
      items: normalizedItems,
      rawText,
      modelUsed,
    };
  } catch (e) {
    console.error("Failed to parse AI JSON:", content);
    return {
      items: [],
      rawText: "",
      modelUsed,
    };
  }
}
