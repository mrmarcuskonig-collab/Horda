// product.ts — the one place a product identifies itself to the shared fan graph.
//
// ADR-0002 (platform readiness): the fan identity & behavior graph is meant to be
// written by more than one product some day. Every behavioral FACT (a claim, a
// verified presence, a follow, an attributed share) is tagged with the product
// that produced it, so those facts can later be attributed, scoped, and consented
// per product WITHOUT a data-archaeology migration.
//
// Today there is exactly one writer, Horda. New products import PRODUCT_SOURCE-style
// constants from here (or pass their own `source`) — they do NOT invent ad-hoc
// strings at call sites. Keep this list short and stable; a source string, once
// written to a fact, is forever.
export type ProductSource = 'horda' | (string & {});

/** The default writer. All current fan-behavior writes are Horda's. */
export const PRODUCT_SOURCE: ProductSource = 'horda';
