import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isRelevantListing,
  listingTerms,
  providerTerms,
  scoreApplicant,
  scoreListingForProvider,
  scoreProviderSearch,
  tokenize,
  type ListingProfile,
  type ProviderProfile,
  type ProviderStats,
} from "./matching.ts";

const designer: ProviderProfile = {
  keywords: ["Diseño gráfico", "logos", "identidad visual"],
  skills: [
    { slug: "graphic-design", name: "Diseño gráfico", category: "Diseño", level: 5 },
    { slug: "branding", name: "Logos e identidad visual", category: "Diseño", level: 4 },
  ],
};

const developer: ProviderProfile = {
  keywords: ["react", "node", "postgres"],
  skills: [{ slug: "full-stack", name: "Desarrollo full stack", category: "Programación", level: 5 }],
};

const logoListing: ListingProfile = {
  title: "Logo para una cafetería",
  category: "Diseño",
  keywords: ["logo", "branding", "cafeteria"],
  budgetMon: 10,
};

const stats = (overrides: Partial<ProviderStats> = {}): ProviderStats => ({
  providerScore: 3.5,
  completedAsProvider: 0,
  portfolioCount: 0,
  ...overrides,
});

describe("tokenize", () => {
  it("ignora tildes, mayúsculas, palabras vacías y plurales sencillos", () => {
    assert.deepEqual(tokenize("Diseño GRÁFICO para los logos"), ["diseno", "grafico", "logo"]);
  });

  it("conserva tecnologías con símbolos y siglas cortas", () => {
    assert.deepEqual(tokenize("C# y node.js"), ["c#", "node.js"]);
    assert.deepEqual(tokenize("Diseño UI/UX"), ["diseno", "ui", "ux"]);
  });

  it("no mutila palabras que terminan en doble s", () => {
    assert.deepEqual(tokenize("business css"), ["business", "css"]);
  });
});

describe("scoreListingForProvider", () => {
  const createdAt = new Date("2026-10-15T00:00:00Z");
  const now = new Date("2026-10-17T00:00:00Z");
  const listing = { ...logoListing, createdAt };

  it("recomienda la solicitud de logos a la diseñadora y no al desarrollador", () => {
    const forDesigner = scoreListingForProvider(listing, designer, 4.5, now);
    const forDeveloper = scoreListingForProvider(listing, developer, 4.5, now);
    assert.ok(forDesigner.score > forDeveloper.score + 40, `${forDesigner.score} vs ${forDeveloper.score}`);
    assert.ok(forDesigner.reasons.some((reason) => reason.startsWith("Coincide en")));
    assert.ok(forDesigner.reasons.includes("Categoría: Diseño"));
  });

  it("una solicitud nueva puntúa más que la misma solicitud antigua", () => {
    const old = { ...listing, createdAt: new Date("2026-08-01T00:00:00Z") };
    assert.ok(scoreListingForProvider(listing, designer, 3.5, now).score > scoreListingForProvider(old, designer, 3.5, now).score);
  });

  it("nunca sale del rango 0 a 100", () => {
    const { score } = scoreListingForProvider(listing, designer, 5, now);
    assert.ok(score >= 0 && score <= 100);
  });
});

describe("scoreApplicant", () => {
  it("a igual encaje, gana quien tiene mejor calificación", () => {
    const rated = scoreApplicant(logoListing, designer, stats({ providerScore: 4.8, completedAsProvider: 12 }), 10);
    const unrated = scoreApplicant(logoListing, designer, stats(), 10);
    assert.ok(rated.breakdown.total > unrated.breakdown.total);
  });

  it("una calificación excelente no compensa no saber hacer el trabajo", () => {
    const wrongSkills = scoreApplicant(logoListing, developer, stats({ providerScore: 5, completedAsProvider: 30 }), 10);
    const rightSkills = scoreApplicant(logoListing, designer, stats({ providerScore: 4, completedAsProvider: 3 }), 10);
    assert.ok(rightSkills.breakdown.total > wrongSkills.breakdown.total, `${rightSkills.breakdown.total} vs ${wrongSkills.breakdown.total}`);
  });

  it("penaliza un precio por encima del presupuesto", () => {
    const within = scoreApplicant(logoListing, designer, stats(), 10);
    const over = scoreApplicant(logoListing, designer, stats(), 25);
    assert.equal(within.breakdown.price, 100);
    assert.equal(over.breakdown.price, 40);
    assert.ok(over.reasons.includes("Su precio supera tu presupuesto"));
  });

  it("sin precio ni presupuesto el factor de precio es neutro", () => {
    assert.equal(scoreApplicant({ ...logoListing, budgetMon: null }, designer, stats(), 10).breakdown.price, 50);
    assert.equal(scoreApplicant(logoListing, designer, stats(), null).breakdown.price, 50);
  });

  it("el desglose no supera 100 y explica la calificación", () => {
    const { breakdown, reasons } = scoreApplicant(logoListing, designer, stats({ providerScore: 5, completedAsProvider: 100, portfolioCount: 9 }), 5);
    assert.ok(breakdown.total <= 100);
    assert.ok(reasons[0].startsWith("Calificación 5.0"));
  });
});

describe("scoreProviderSearch", () => {
  const terms = new Set(["logo", "branding"]);

  it("la relevancia y la calificación mueven el orden", () => {
    const query = { terms, skillSlugs: ["branding"] };
    const relevantRated = scoreProviderSearch(query, designer, stats({ providerScore: 4.7, completedAsProvider: 8 }));
    const relevantNew = scoreProviderSearch(query, designer, stats());
    const irrelevantRated = scoreProviderSearch(query, developer, stats({ providerScore: 4.7, completedAsProvider: 8 }));
    assert.ok(relevantRated > relevantNew);
    assert.ok(relevantRated > irrelevantRated);
  });

  it("sin búsqueda, ordena por reputación", () => {
    const query = { terms: new Set<string>(), skillSlugs: [] };
    assert.ok(scoreProviderSearch(query, developer, stats({ providerScore: 4.9 })) > scoreProviderSearch(query, designer, stats()));
  });
});

describe("términos", () => {
  it("el perfil incluye palabras clave, nombres y slugs de habilidades", () => {
    const terms = providerTerms(designer);
    for (const expected of ["diseno", "grafico", "logo", "identidad", "branding"]) assert.ok(terms.has(expected), expected);
  });

  it("la solicitud toma palabras clave y título", () => {
    const terms = listingTerms(logoListing);
    for (const expected of ["logo", "branding", "cafeteria"]) assert.ok(terms.has(expected), expected);
  });
});

describe("isRelevantListing", () => {
  const designer: ProviderProfile = {
    keywords: ["ilustracion digital"],
    skills: [{ slug: "graphic-design", name: "Diseño gráfico", category: "Diseño", level: 5 }],
  };

  it("avisa cuando comparten términos con el título o las palabras clave", () => {
    assert.equal(isRelevantListing({ title: "Logo e ilustración digital", category: null, keywords: [] }, designer), true);
    assert.equal(isRelevantListing({ title: "Necesito algo", category: null, keywords: ["diseno grafico"] }, designer), true);
  });

  it("avisa cuando la categoría coincide con la de sus habilidades", () => {
    assert.equal(isRelevantListing({ title: "Afiche para evento", category: "Diseño", keywords: [] }, designer), true);
  });

  it("no avisa si no hay ninguna coincidencia real", () => {
    assert.equal(isRelevantListing({ title: "API REST con JWT", category: "Programación", keywords: ["nodejs"] }, designer), false);
  });

  it("no avisa a un perfil sin habilidades ni palabras clave", () => {
    assert.equal(isRelevantListing({ title: "Logo", category: "Diseño", keywords: ["logo"] }, { keywords: [], skills: [] }), false);
  });
});
