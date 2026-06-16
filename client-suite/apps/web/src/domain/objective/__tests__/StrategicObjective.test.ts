import { describe, it, expect } from 'vitest';
import { StrategicObjective } from '../StrategicObjective';

describe('StrategicObjective', () => {
  it('create generates draft with defaults', () => {
    const l0 = StrategicObjective.create({
      direction: '增长',
      description: '年度增长目标',
      coreConstraints: [],
      timeHorizon: 'annual',
    });
    expect(l0.id).toMatch(/^l0-/);
    expect(l0.status).toBe('draft');
    expect(l0.linkedL1Ids).toHaveLength(0);
    expect(l0.confidenceScore).toBe(0);
  });

  it('fromProps preserves all fields', () => {
    const l0 = StrategicObjective.fromProps({
      id: 'l0-1',
      direction: 'test',
      description: 'desc',
      coreConstraints: [{ id: 'c1', description: 'budget', type: 'budget', isMandatory: true }],
      confidenceScore: 0.5,
      timeHorizon: 'quarterly',
      linkedL1Ids: ['l1-1'],
      status: 'active',
      createdAt: 1000,
      updatedAt: 2000,
    });
    expect(l0.coreConstraints).toHaveLength(1);
    expect(l0.linkedL1Ids).toEqual(['l1-1']);
  });

  it('activate sets status to active', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    });
    const active = l0.activate();
    expect(active.status).toBe('active');
    expect(active.isActive).toBe(true);
  });

  it('pause sets status to paused', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    }).activate();
    expect(l0.pause().status).toBe('paused');
  });

  it('achieve sets status to achieved', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    }).activate();
    expect(l0.achieve().status).toBe('achieved');
  });

  it('linkL1 adds l1Id', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    });
    const linked = l0.linkL1('l1-a').linkL1('l1-b');
    expect(linked.linkedL1Ids).toEqual(['l1-a', 'l1-b']);
  });

  it('linkL1 is idempotent', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    });
    const linked = l0.linkL1('l1-a').linkL1('l1-a');
    expect(linked.linkedL1Ids).toEqual(['l1-a']);
  });

  it('unlinkL1 removes l1Id', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    })
      .linkL1('l1-a')
      .linkL1('l1-b');
    const unlinked = l0.unlinkL1('l1-a');
    expect(unlinked.linkedL1Ids).toEqual(['l1-b']);
  });

  it('updateConfidence clamps to [0,1]', () => {
    const l0 = StrategicObjective.create({
      direction: 'x',
      description: 'x',
      coreConstraints: [],
      timeHorizon: 'annual',
    });
    expect(l0.updateConfidence(1.5).confidenceScore).toBe(1);
    expect(l0.updateConfidence(-0.3).confidenceScore).toBe(0);
    expect(l0.updateConfidence(0.75).confidenceScore).toBe(0.75);
  });

  it('mandatoryConstraints filters correctly', () => {
    const l0 = StrategicObjective.fromProps({
      id: 'l0-1',
      direction: 'x',
      description: 'x',
      coreConstraints: [
        { id: 'c1', description: 'mandatory', type: 'budget', isMandatory: true },
        { id: 'c2', description: 'optional', type: 'resource', isMandatory: false },
      ],
      confidenceScore: 0,
      timeHorizon: 'annual',
      linkedL1Ids: [],
      status: 'active',
      createdAt: 1000,
      updatedAt: 1000,
    });
    expect(l0.mandatoryConstraints).toHaveLength(1);
    expect(l0.mandatoryConstraints[0].id).toBe('c1');
  });
});
