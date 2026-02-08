export function matchNutritionApi(url: URL): boolean {
  return url.pathname.startsWith("/api/nutrition/")
}
