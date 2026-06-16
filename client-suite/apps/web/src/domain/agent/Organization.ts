export type OrgNodeType = 'department' | 'team' | 'person' | 'agent';

export interface OrgNode {
  id: string;
  name: string;
  type: OrgNodeType;
  role?: string;
  skills?: string[];
  agentId?: string;
  matrixUserId?: string;
  children?: OrgNode[];
}

export interface OrgMember {
  id: string;
  name: string;
  type: 'person' | 'agent';
  role: string;
  department: string;
  team: string;
  skills: string[];
  agentId?: string;
  matrixUserId?: string;
}

export function flattenMembers(nodes?: OrgNode[], dept = '', team = ''): OrgMember[] {
  const members: OrgMember[] = [];
  for (const node of nodes ?? []) {
    const currentDept = node.type === 'department' ? node.name : dept;
    const currentTeam = node.type === 'team' ? node.name : team;
    if (node.type === 'person' || node.type === 'agent') {
      members.push({
        id: node.id,
        name: node.name,
        type: node.type,
        role: node.role ?? '',
        department: currentDept,
        team: currentTeam,
        skills: node.skills ?? [],
        agentId: node.agentId,
        matrixUserId: node.matrixUserId,
      });
    }
    if (node.children) {
      members.push(...flattenMembers(node.children, currentDept, currentTeam));
    }
  }
  return members;
}
