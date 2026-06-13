export type MessageType = "category_savings" | "cashback" | "subscription" | "loyalty";

export type StaticMessageTemplate = {
  key: string;
  locale: string;
  messageType: MessageType;
  titleTemplate: string;
  bodyTemplate: string;
  requiredVariables: string[];
};

export const staticTemplates: StaticMessageTemplate[] = [
  {
    key: "category_savings_default",
    locale: "pl-PL",
    messageType: "category_savings",
    titleTemplate: "Mozecie oszczedzic na {categoryName}",
    bodyTemplate:
      "Wydajecie okolo {monthlySpend} miesiecznie na {categoryName}. Oferta {merchantName} moze dac okolo {estimatedSavings} oszczednosci.",
    requiredVariables: ["categoryName", "monthlySpend", "merchantName", "estimatedSavings"],
  },
  {
    key: "subscription_default",
    locale: "pl-PL",
    messageType: "subscription",
    titleTemplate: "Sprawdzcie tansza opcje abonamentu",
    bodyTemplate:
      "Przy regularnych oplatach w tej kategorii {merchantName} moze byc dobra alternatywa. Szacowana korzysc: {estimatedSavings}.",
    requiredVariables: ["merchantName", "estimatedSavings"],
  },
];

export function getStaticTemplate(messageType: MessageType, locale = "pl-PL") {
  return (
    staticTemplates.find((template) => template.messageType === messageType && template.locale === locale) ??
    staticTemplates.find((template) => template.messageType === messageType) ??
    staticTemplates[0]
  );
}
