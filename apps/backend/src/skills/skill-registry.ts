import type { SkillDefinition } from '@mailgent/shared';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('skill-registry');

export class SkillRegistry {
  private skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    this.skills.set(skill.id, skill);
    log.debug({ name: skill.name, id: skill.id }, 'Skill registered');
  }

  get(id: string): SkillDefinition | undefined {
    return this.skills.get(id);
  }

  getByName(name: string): SkillDefinition | undefined {
    return Array.from(this.skills.values()).find(s => s.name === name);
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  findMatchingSkill(input: string): SkillDefinition | undefined {
    for (const skill of this.skills.values()) {
      if (!skill.isEnabled || !skill.triggerPattern) continue;
      try {
        const regex = new RegExp(skill.triggerPattern, 'i');
        if (regex.test(input)) return skill;
      } catch {
        if (input.toLowerCase().includes(skill.triggerPattern.toLowerCase())) return skill;
      }
    }
    return undefined;
  }

  unregister(id: string): void {
    this.skills.delete(id);
  }
}
