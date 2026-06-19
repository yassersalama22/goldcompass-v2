/**
 * Renders a JSON-LD <script> for structured data. Pass a schema.org object
 * (or array of objects) as `data`.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Structured data is build-time/server-rendered, not user input.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
