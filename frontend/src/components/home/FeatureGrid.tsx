'use client';

import { Card } from '../../components/ui/card';
import { FEATURES } from '../../lib/home-utils';

export function FeatureGrid() {
  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <Card key={feature.title} className="rounded-2xl p-4 transition-shadow hover:shadow-elevation-4 sm:p-5">
          <div className="flex size-11 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <feature.icon className="size-5" />
          </div>
          <h3 className="mt-4 text-base font-bold text-primary">{feature.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{feature.description}</p>
        </Card>
      ))}
    </section>
  );
}
