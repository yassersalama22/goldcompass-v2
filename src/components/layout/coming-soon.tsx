import { Container } from "@/components/layout/container";

/** Temporary placeholder for routes that will be built in later phases. */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <Container className="flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-gold-strong text-sm font-medium">{phase}</p>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="text-muted-foreground max-w-lg text-lg">{description}</p>
      <p className="text-muted-foreground mt-2 text-sm">Coming soon.</p>
    </Container>
  );
}
