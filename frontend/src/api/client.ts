const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000"

export async function apiClient<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`)
  if (!res.ok) {
    const err = await res
      .json()
      .catch(() => ({ error: "unknown", detail: res.statusText }))
    throw new Error(err.detail || err.error || "API error")
  }
  return res.json()
}
