import { describe, it, expect } from 'vitest';
import {
  cpuToDockerCpus,
  memoryToDockerMemory,
  toDockerResourceArgs,
} from './resource-converter.js';

describe('cpuToDockerCpus', () => {
  it('1000m → 1.0(1 核)', () => {
    expect(cpuToDockerCpus('1000m')).toBe(1);
  });
  it('500m → 0.5(半核)', () => {
    expect(cpuToDockerCpus('500m')).toBe(0.5);
  });
  it('250m → 0.25', () => {
    expect(cpuToDockerCpus('250m')).toBe(0.25);
  });
  it('4000m → 4.0', () => {
    expect(cpuToDockerCpus('4000m')).toBe(4);
  });
  it('纯数字视为核数:2 → 2', () => {
    expect(cpuToDockerCpus('2')).toBe(2);
  });
  it('无法识别格式 → null', () => {
    expect(cpuToDockerCpus('invalid')).toBeNull();
    expect(cpuToDockerCpus('')).toBeNull();
  });
});

describe('memoryToDockerMemory', () => {
  it('512Mi → 512m(MiB≈MB)', () => {
    expect(memoryToDockerMemory('512Mi')).toBe('512m');
  });
  it('1Gi → 1024m', () => {
    expect(memoryToDockerMemory('1Gi')).toBe('1024m');
  });
  it('2Gi → 2048m', () => {
    expect(memoryToDockerMemory('2Gi')).toBe('2048m');
  });
  it('256Mi → 256m', () => {
    expect(memoryToDockerMemory('256Mi')).toBe('256m');
  });
  it('4Gi → 4096m', () => {
    expect(memoryToDockerMemory('4Gi')).toBe('4096m');
  });
  it('8Gi → 8192m', () => {
    expect(memoryToDockerMemory('8Gi')).toBe('8192m');
  });
  it('无法识别 → null', () => {
    expect(memoryToDockerMemory('abc')).toBeNull();
  });
});

describe('toDockerResourceArgs', () => {
  it('1000m/512Mi → cpus 1, memory 512m', () => {
    expect(toDockerResourceArgs({ cpu: '1000m', memory: '512Mi' })).toEqual({
      cpus: '1',
      memory: '512m',
    });
  });
  it('2000m/2Gi → cpus 2, memory 2048m', () => {
    expect(toDockerResourceArgs({ cpu: '2000m', memory: '2Gi' })).toEqual({
      cpus: '2',
      memory: '2048m',
    });
  });
  it('500m/256Mi → cpus 0.5, memory 256m', () => {
    expect(toDockerResourceArgs({ cpu: '500m', memory: '256Mi' })).toEqual({
      cpus: '0.5',
      memory: '256m',
    });
  });
  it('CPU 无法识别 → 用 fallback cpu,memory 正常转换', () => {
    expect(toDockerResourceArgs({ cpu: 'bad', memory: '1Gi' })).toEqual({
      cpus: '1.0',
      memory: '1024m',
    });
  });
  it('memory 无法识别 → 用 fallback memory,cpu 正常转换', () => {
    expect(toDockerResourceArgs({ cpu: '1000m', memory: 'bad' })).toEqual({
      cpus: '1',
      memory: '2g',
    });
  });
  it('自定义 fallback 生效', () => {
    expect(
      toDockerResourceArgs({ cpu: 'bad', memory: 'bad' }, { cpus: '0.5', memory: '512m' })
    ).toEqual({ cpus: '0.5', memory: '512m' });
  });
});
