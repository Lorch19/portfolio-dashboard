const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function apiClient<T>(path: string, params?: Record<string, string>): Promise<T> {
  let url = `${BASE_URL}${path}`
  if (params) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value) searchParams.set(key, value)
    }
    const qs = searchParams.toString()
    if (qs) url += `?${qs}`
  }
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "unknown", detail: res.statusText }))
    throw new Error(err.detail || err.error || "API error")
  }
  return res.json()
}
