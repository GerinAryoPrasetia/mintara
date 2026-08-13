export function buildCurl(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
): string {
  const parts: string[] = [`curl -X ${method.toUpperCase()} '${url}'`]

  for (const [key, value] of Object.entries(headers)) {
    parts.push(`  -H '${key}: ${value}'`)
  }

  const bodyMethods = ['POST', 'PUT']
  if (bodyMethods.includes(method.toUpperCase()) && body !== undefined && body !== null) {
    parts.push(`  -d '${JSON.stringify(body)}'`)
  }

  return parts.join(' \\\n')
}
