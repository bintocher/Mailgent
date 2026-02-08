import { v4 as uuid } from 'uuid';
import type { AgentGroup } from '@mailgent/shared';
import type { GroupRepository } from '../db/repositories/group.repo';
import type { AgentRepository } from '../db/repositories/agent.repo';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('group-manager');

export class GroupManager {
  constructor(
    private groupRepo: GroupRepository,
    private agentRepo: AgentRepository,
    private eventBus: EventBus,
  ) {}

  createGroup(params: {
    name: string;
    description: string;
    email: string;
    specializations?: string[];
    maxMembers?: number;
    projectId: string;
  }): AgentGroup {
    const group: AgentGroup = {
      id: uuid(),
      name: params.name,
      description: params.description,
      email: params.email,
      memberAgentIds: [],
      maxMembers: params.maxMembers || 10,
      specializations: params.specializations || [],
      projectId: params.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.groupRepo.create(group);
    log.info({ id: group.id, name: group.name }, 'Group created');
    return group;
  }

  assignAgent(groupId: string, agentId: string): void {
    const group = this.groupRepo.findById(groupId);
    if (!group) throw new Error(`Group ${groupId} not found`);

    if (group.memberAgentIds.length >= group.maxMembers) {
      throw new Error(`Group ${group.name} is full (max ${group.maxMembers} members)`);
    }

    this.groupRepo.addMember(groupId, agentId);
    this.agentRepo.update(agentId, { groupId });
    log.info({ groupId, agentId }, 'Agent assigned to group');
  }

  removeAgent(groupId: string, agentId: string): void {
    this.groupRepo.removeMember(groupId, agentId);
    this.agentRepo.update(agentId, { groupId: undefined });
    log.info({ groupId, agentId }, 'Agent removed from group');
  }

  setLead(groupId: string, agentId: string): void {
    this.groupRepo.update(groupId, { leadAgentId: agentId });
    log.info({ groupId, agentId }, 'Group lead set');
  }

  getGroupByEmail(email: string): AgentGroup | undefined {
    return this.groupRepo.findByEmail(email);
  }

  getAll(): AgentGroup[] {
    return this.groupRepo.findAll();
  }

  getById(id: string): AgentGroup | undefined {
    return this.groupRepo.findById(id);
  }

  deleteGroup(id: string): void {
    this.groupRepo.delete(id);
    log.info({ id }, 'Group deleted');
  }
}
