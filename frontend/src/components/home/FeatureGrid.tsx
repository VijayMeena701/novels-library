'use client';

import { Card } from '../../components/ui/card';
import { FEATURES } from '../../lib/home-utils';

export function FeatureGrid() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <Card key={feature.title} className="p-5 transition-shadow hover:shadow-elevated">
          <feature.icon className="size-8 text-primary/70" />
          <h3 className="mt-3 text-sm font-semibold text-foreground">{feature.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-copy">{feature.description}</p>
        </Card>
      ))}
    </section>
  );
}
