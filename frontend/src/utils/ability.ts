import { Ability, AbilityBuilder } from "@casl/ability";

export function buildAbilityFor(capabilities: string[] = [], isSuperuser = false): Ability {
  const { can, rules } = new AbilityBuilder(Ability);

  if (isSuperuser) {
    can("manage", "all");
  } else {
    for (const cap of capabilities) {
      const [resource, action] = cap.split(":");
      if (resource && action) {
        can(action, resource);
      }
    }
  }

  return new Ability(rules);
}
