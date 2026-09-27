// Search in Open Food Facts, a free database with millions of packaged products.
// https://world.openfoodfacts.org — no key needed, called straight from the browser.

export interface OffProduct {
  name: string
  brand: string
  kcal: number // per 100 g
  protein: number
  carbs: number
  fat: number
  servingGrams: number | null
}

interface OffResponse {
  products?: {
    product_name?: string
    product_name_de?: string
    brands?: string
    serving_quantity?: number | string
    nutriments?: Record<string, number | string | undefined>
  }[]
}

export async function searchOpenFoodFacts(query: string): Promise<OffProduct[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: '15',
    fields: 'product_name,product_name_de,brands,nutriments,serving_quantity',
  })
  const res = await fetch(`https://de.openfoodfacts.org/cgi/search.pl?${params}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  if (!res?.ok) throw new Error('Open Food Facts ist gerade nicht erreichbar. Bist du online?')
  const data = (await res.json()) as OffResponse

  return (data.products ?? [])
    .map((p) => {
      const n = p.nutriments ?? {}
      return {
        name: p.product_name_de || p.product_name || '',
        brand: (p.brands ?? '').split(',')[0].trim(),
        kcal: Math.round(Number(n['energy-kcal_100g'] ?? 0)),
        protein: Number(n.proteins_100g ?? 0),
        carbs: Number(n.carbohydrates_100g ?? 0),
        fat: Number(n.fat_100g ?? 0),
        servingGrams: Number(p.serving_quantity) || null,
      }
    })
    .filter((p) => p.name && p.kcal > 0)
}
